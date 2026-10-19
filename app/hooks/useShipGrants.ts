"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { baseSepolia } from "viem/chains";
import type { Abi, Address } from "viem";
import { CONTRACT_ABIS, CONTRACT_ADDRESSES_BY_CHAIN_ID } from "../config/contracts";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";
import type { NodeRewardShip, ShipGrantSpec } from "../utils/shipGrant";
import { REWARD_SHIP_SNAPSHOT, SNAPSHOT_REWARD_SHIPS } from "../config/rewardShips";
import { isSnapshotForContract } from "../utils/rewardShipSnapshot";

// Web3 reads and owner writes for ShipGrantWinEffect's per-node reward ships
// (docs/frontend-handoff-2026-10-19.md §2). The contract's ShipGrant tuple
// converts to the shared number-native ShipGrantSpec here and nowhere else.

const CHAIN_ID = baseSepolia.id;
const SHIP_GRANT_ABI = CONTRACT_ABIS.SHIP_GRANT_WIN_EFFECT as Abi;
const SHIPS_ABI = CONTRACT_ABIS.SHIPS as Abi;
export const SHIP_GRANT_ADDRESS = CONTRACT_ADDRESSES_BY_CHAIN_ID[CHAIN_ID].SHIP_GRANT_WIN_EFFECT as Address;
const SHIPS_ADDRESS = CONTRACT_ADDRESSES_BY_CHAIN_ID[CHAIN_ID].SHIPS as Address;

interface ShipGrantTuple {
  name: string;
  equipment: { mainWeapon: number; armor: number; shields: number; special: number };
  colors: ShipGrantSpec["colors"];
  variant: number;
  accuracy: number;
  hull: number;
  speed: number;
  shipsDestroyed: number;
  shiny: boolean;
  isFreeShip: boolean;
  oncePerAddress: boolean;
}

function fromTuple(t: ShipGrantTuple): ShipGrantSpec {
  return {
    name: t.name,
    equipment: {
      mainWeapon: Number(t.equipment.mainWeapon),
      armor: Number(t.equipment.armor),
      shields: Number(t.equipment.shields),
      special: Number(t.equipment.special),
    },
    colors: {
      h1: Number(t.colors.h1), s1: Number(t.colors.s1), l1: Number(t.colors.l1),
      h2: Number(t.colors.h2), s2: Number(t.colors.s2), l2: Number(t.colors.l2),
      h3: Number(t.colors.h3), s3: Number(t.colors.s3), l3: Number(t.colors.l3),
    },
    variant: Number(t.variant),
    accuracy: Number(t.accuracy),
    hull: Number(t.hull),
    speed: Number(t.speed),
    shipsDestroyed: Number(t.shipsDestroyed),
    shiny: t.shiny,
    isFreeShip: t.isFreeShip,
    oncePerAddress: t.oncePerAddress,
  };
}

/** Every number in a ShipGrantSpec fits the tuple's uint8/uint16/uint32 fields as-is. */
const toTuple = (spec: ShipGrantSpec): ShipGrantTuple => ({ ...spec, name: spec.name.trim() });

/**
 * The reward ship configured for each node (hasGrant + getGrant in one
 * multicall), keyed by node id; nodes without one are absent.
 */
export function useShipGrants(nodeIds: readonly number[], enabled = true) {
  const contracts = useMemo(
    () =>
      nodeIds.flatMap((id) => [
        { address: SHIP_GRANT_ADDRESS, abi: SHIP_GRANT_ABI, chainId: CHAIN_ID, functionName: "hasGrant" as const, args: [BigInt(id)] as const },
        { address: SHIP_GRANT_ADDRESS, abi: SHIP_GRANT_ABI, chainId: CHAIN_ID, functionName: "getGrant" as const, args: [BigInt(id)] as const },
      ]),
    [nodeIds],
  );
  const result = useReadContracts({
    contracts,
    query: { enabled: enabled && nodeIds.length > 0, staleTime: ADMIN_DATA_STALE_MS },
  });
  const grantsByNodeId = useMemo(() => {
    const map = new Map<number, ShipGrantSpec>();
    nodeIds.forEach((id, i) => {
      const has = result.data?.[i * 2]?.result as boolean | undefined;
      const grant = result.data?.[i * 2 + 1]?.result as ShipGrantTuple | undefined;
      if (has && grant) map.set(id, fromTuple(grant));
    });
    return map;
  }, [nodeIds, result.data]);
  return { grantsByNodeId, isLoading: result.isLoading, refetch: result.refetch };
}

/** Whether the app's reward ship snapshot was read from this deploy's contract. */
export const SNAPSHOT_IS_CURRENT = isSnapshotForContract(REWARD_SHIP_SNAPSHOT, SHIP_GRANT_ADDRESS);

/**
 * A node's reward ship as players see it: from the app's snapshot
 * (app/data/content/rewardShips.json, no RPC), or read from the chain when
 * the snapshot is from another deploy.
 */
export function useNodeGrant(nodeId: number | undefined): ShipGrantSpec | undefined {
  const ids = useMemo(() => (nodeId != null && !SNAPSHOT_IS_CURRENT ? [nodeId] : []), [nodeId]);
  const { grantsByNodeId } = useShipGrants(ids, ids.length > 0);
  if (nodeId == null) return undefined;
  return SNAPSHOT_IS_CURRENT ? SNAPSHOT_REWARD_SHIPS.get(nodeId) : grantsByNodeId.get(nodeId);
}

/** hasClaimed for the signed-in player; only read when `enabled`. */
function useHasClaimed(nodeId: number | undefined, enabled: boolean, staleTime?: number) {
  const { address } = useAccount();
  return useReadContract({
    address: SHIP_GRANT_ADDRESS,
    abi: SHIP_GRANT_ABI,
    chainId: CHAIN_ID,
    functionName: "hasClaimed",
    args: nodeId != null && address ? [BigInt(nodeId), address] : undefined,
    query: { enabled: enabled && nodeId != null && !!address, staleTime },
  });
}

/**
 * One node's reward ship for the signed-in player: the grant, and whether
 * they already received it (hasClaimed) when it's once per address.
 */
export function useNodeRewardShip(nodeId: number | undefined): NodeRewardShip | null {
  const grant = useNodeGrant(nodeId);
  const { data: claimed } = useHasClaimed(nodeId, !!grant?.oncePerAddress);
  return useMemo(() => (grant ? { grant, claimed: claimed === true } : null), [grant, claimed]);
}

/**
 * Whether the player had already claimed a once-only reward ship before this
 * game ended: read while the game is still live (`gameLive`) and then kept,
 * so the result screen can tell whether the win minted one. undefined when
 * the game was already over when it loaded.
 */
export function useRewardClaimedBeforeWin(nodeId: number | undefined, gameLive: boolean): boolean | undefined {
  const grant = useNodeGrant(nodeId);
  const { data } = useHasClaimed(nodeId, gameLive && !!grant?.oncePerAddress, Infinity);
  // Keep the first answer read during the game: the same query reads true
  // once the win's mint lands, which mustn't hide the reward.
  const [beforeWin, setBeforeWin] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (gameLive && beforeWin === undefined && typeof data === "boolean") setBeforeWin(data);
  }, [gameLive, beforeWin, data]);
  return grant && !grant.oncePerAddress ? false : beforeWin;
}

/** Ships.maxVariant(): the highest variant a grant may use. */
export function useShipsMaxVariant() {
  const { data } = useReadContract({
    address: SHIPS_ADDRESS,
    abi: SHIPS_ABI,
    chainId: CHAIN_ID,
    functionName: "maxVariant",
    query: { staleTime: ADMIN_DATA_STALE_MS },
  });
  return data != null ? Number(data) : undefined;
}

/** Whether the connected wallet owns ShipGrantWinEffect (only the owner can set grants). */
export function useIsShipGrantOwner() {
  const { address } = useAccount();
  const { data: owner, isLoading } = useReadContract({
    address: SHIP_GRANT_ADDRESS,
    abi: SHIP_GRANT_ABI,
    chainId: CHAIN_ID,
    functionName: "owner",
    query: { staleTime: ADMIN_DATA_STALE_MS },
  });
  return {
    isOwner: !!address && typeof owner === "string" && owner.toLowerCase() === address.toLowerCase(),
    isLoading,
  };
}

/** Owner writes: setGrant, clearGrant, resetClaim. Each resolves to the mined tx hash. */
export function useShipGrantAdmin() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });

  const send = useCallback(
    async (functionName: "setGrant" | "clearGrant" | "resetClaim", args: readonly unknown[]) => {
      const hash = await writeContractAsync({
        address: SHIP_GRANT_ADDRESS,
        abi: SHIP_GRANT_ABI,
        chainId: CHAIN_ID,
        functionName,
        args,
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      return hash;
    },
    [writeContractAsync, publicClient],
  );

  const setGrant = useCallback(
    (nodeId: number, spec: ShipGrantSpec) => send("setGrant", [BigInt(nodeId), toTuple(spec)]),
    [send],
  );
  const clearGrant = useCallback((nodeId: number) => send("clearGrant", [BigInt(nodeId)]), [send]);
  const resetClaim = useCallback(
    (nodeId: number, player: Address) => send("resetClaim", [BigInt(nodeId), player]),
    [send],
  );
  return { setGrant, clearGrant, resetClaim };
}
