"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateShipsReads } from "./useShipsContract";
import { baseSepolia } from "viem/chains";
import type { Abi, Address } from "viem";
import { CONTRACT_ABIS, CONTRACT_ADDRESSES_BY_CHAIN_ID } from "../config/contracts";
import { RoguelikeRun } from "../types/roguelike";
import { GAME_LENS_ADDRESS } from "./useGameLens";

const CHAIN_ID = baseSepolia.id;
const ROGUELIKE_RUN_ABI = CONTRACT_ABIS.ROGUELIKE_RUN as Abi;
export const ROGUELIKE_RUN_ADDRESS = CONTRACT_ADDRESSES_BY_CHAIN_ID[
  CHAIN_ID
].ROGUELIKE_RUN as `0x${string}`;

/** Matches every cached run read: RoguelikeRun single reads (getRun,
 * hasActiveRun, ...), batched ones (roster HP, node locks/defeats), and
 * GameLens.getRunView, which aggregates them. */
function isRoguelikeRunQuery(queryKey: readonly unknown[]): boolean {
  const runAddress = ROGUELIKE_RUN_ADDRESS.toLowerCase();
  const [kind, params] = queryKey as [unknown, Record<string, unknown> | undefined];
  if (kind === "readContract") {
    const address = (params?.address as string | undefined)?.toLowerCase();
    if (address === runAddress) return true;
    return address === GAME_LENS_ADDRESS.toLowerCase() && params?.functionName === "getRunView";
  }
  if (kind === "readContracts") {
    const contracts = params?.contracts as { address?: string }[] | undefined;
    return !!contracts?.some((c) => c.address?.toLowerCase() === runAddress);
  }
  return false;
}

/**
 * Drops every cached RoguelikeRun read (getRun, hasActiveRun, node locks,
 * roster HP, ...) so the Mission tab loads the run fresh instead of briefly
 * showing a run that just ended, and refetches owned ships so the released
 * roster no longer shows as in a fleet. Used when quitting after a lost
 * mission.
 */
export function resetRoguelikeRunQueries(queryClient: QueryClient): void {
  void invalidateShipsReads(queryClient);
  queryClient.removeQueries({ predicate: (query) => isRoguelikeRunQuery(query.queryKey) });
}

/**
 * Refetches every RoguelikeRun read after a won mission: the Mission tab
 * stays mounted during the match, so without this the run map keeps the
 * pre-mission roster HP (and cleared/locked nodes) — e.g. showing a damaged
 * fleet at full hull after its first fight.
 */
export function invalidateRoguelikeRunQueries(queryClient: QueryClient): void {
  void invalidateShipsReads(queryClient);
  void queryClient.invalidateQueries({ predicate: (query) => isRoguelikeRunQuery(query.queryKey) });
}

export function useGetRoguelikeRun(playerAddress: Address | undefined, enabled = true) {
  const result = useReadContract({
    address: ROGUELIKE_RUN_ADDRESS,
    abi: ROGUELIKE_RUN_ABI,
    chainId: CHAIN_ID,
    functionName: "getRun",
    args: playerAddress ? [playerAddress] : undefined,
    query: { enabled: enabled && !!playerAddress },
  });
  return { ...result, data: result.data as RoguelikeRun | undefined };
}

export function useHasActiveRoguelikeRun(playerAddress: Address | undefined) {
  const result = useReadContract({
    address: ROGUELIKE_RUN_ADDRESS,
    abi: ROGUELIKE_RUN_ABI,
    chainId: CHAIN_ID,
    functionName: "hasActiveRun",
    args: playerAddress ? [playerAddress] : undefined,
    query: { enabled: !!playerAddress },
  });
  return { ...result, data: result.data as boolean | undefined };
}

/**
 * Batched run HP for any of the player's ships (one multicall, not a hook per
 * ship). Stored per ship for the whole run, so a ship dropped at a resupply
 * keeps its damage. 0 means "not yet damaged this run" (fresh 100%), not
 * literally 0 HP.
 */
export function useRoguelikeRosterHP(
  playerAddress: Address | undefined,
  shipIds: bigint[],
) {
  const contracts = useMemo(
    () =>
      shipIds.map((id) => ({
        address: ROGUELIKE_RUN_ADDRESS,
        abi: ROGUELIKE_RUN_ABI,
        chainId: CHAIN_ID,
        functionName: "getShipHP" as const,
        args: playerAddress ? ([playerAddress, id] as const) : undefined,
      })),
    [playerAddress, shipIds],
  );
  const result = useReadContracts({
    contracts,
    query: { enabled: !!playerAddress && shipIds.length > 0 },
  });

  const hpByShipId = useMemo(() => {
    const map = new Map<string, number>();
    shipIds.forEach((id, i) => {
      map.set(id.toString(), (result.data?.[i]?.result as number | undefined) ?? 0);
    });
    return map;
  }, [shipIds, result.data]);

  return { ...result, hpByShipId };
}
