"use client";

import React, { useCallback, useMemo } from "react";
import { isAddress, type Abi, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { useAccount, useReadContracts } from "wagmi";
import { CONTRACT_ABIS, CONTRACT_ADDRESSES_BY_CHAIN_ID } from "../../config/contracts";
import { ADMIN_DATA_STALE_MS } from "../../config/queryTiming";
import { DEFAULT_MAX_SPECIAL_SLOT, validSpecialsForVariant } from "../../types/types";
import { RoguelikeNodeKind } from "../../types/roguelike";
import { useAllRoguelikeNodes } from "../../hooks/useRoguelikeNodeMap";
import { useRoguelikeNodeMapAdmin } from "../../hooks/useRoguelikeNodeMapAdmin";
import { useRoguelikeNodesWinEffects } from "../../hooks/useWinEffects";
import { resolveNodeContent, useWeb3NodeContent } from "../../hooks/useNodeContent";
import {
  SHIP_GRANT_ADDRESS,
  useIsShipGrantOwner,
  useShipGrantAdmin,
  useShipGrants,
  useShipsMaxVariant,
} from "../../hooks/useShipGrants";
import { RewardShipsAdminView, type RewardShipsAdminNode } from "./RewardShipsAdminView";
import { RewardShipSnapshotPanel } from "./RewardShipSnapshotPanel";
import { REWARD_SHIP_SNAPSHOT } from "../../config/rewardShips";
import { staleSnapshotNodeIds } from "../../utils/rewardShipSnapshot";

const CHAIN_ID = baseSepolia.id;
const GAME_ADDRESS = CONTRACT_ADDRESSES_BY_CHAIN_ID[CHAIN_ID].GAME as Address;
const GAME_ABI = CONTRACT_ABIS.GAME as Abi;

/** Web3's Reward Ships tab: ShipGrantWinEffect owner calls (see RewardShipsAdminView). */
export function RewardShipsAdmin() {
  const { address } = useAccount();
  const { nodes: allNodes, isLoading: nodesLoading } = useAllRoguelikeNodes();
  const combatNodes = useMemo(() => allNodes.filter((n) => n.kind === RoguelikeNodeKind.Combat), [allNodes]);
  const bigIds = useMemo(() => combatNodes.map((n) => n.id), [combatNodes]);
  const ids = useMemo(() => combatNodes.map((n) => Number(n.id)), [combatNodes]);

  const { contentById, isLoading: contentLoading } = useWeb3NodeContent("ROGUELIKE", bigIds);
  const { effectsByNodeId, refetch: refetchEffects } = useRoguelikeNodesWinEffects(bigIds);
  const { grantsByNodeId, isLoading: grantsLoading, refetch: refetchGrants } = useShipGrants(ids);
  const { isOwner, isLoading: ownerLoading } = useIsShipGrantOwner();
  const maxVariant = useShipsMaxVariant() ?? 2;
  const grantAdmin = useShipGrantAdmin();
  const nodeMapAdmin = useRoguelikeNodeMapAdmin();

  // Special slots per variant (Game.maxSpecialSlot), one multicall.
  const slotContracts = useMemo(
    () =>
      Array.from({ length: maxVariant }, (_, i) => ({
        address: GAME_ADDRESS,
        abi: GAME_ABI,
        chainId: CHAIN_ID,
        functionName: "maxSpecialSlot" as const,
        args: [i + 1] as const,
      })),
    [maxVariant],
  );
  const { data: slotData } = useReadContracts({ contracts: slotContracts, query: { staleTime: ADMIN_DATA_STALE_MS } });
  const specialsForVariant = useCallback(
    (variant: number) => {
      const raw = slotData?.[variant - 1]?.result;
      return validSpecialsForVariant(variant, raw != null ? Number(raw) : DEFAULT_MAX_SPECIAL_SLOT);
    },
    [slotData],
  );

  const nodes = useMemo(
    (): RewardShipsAdminNode[] =>
      combatNodes.map((n) => {
        const id = Number(n.id);
        const effects = effectsByNodeId.get(id) ?? [];
        return {
          id,
          campaignId: Number(n.campaignId),
          title: resolveNodeContent(contentById, n.id, contentLoading).title,
          hasGrantEffect: effects.some((a) => a.toLowerCase() === SHIP_GRANT_ADDRESS.toLowerCase()),
        };
      }),
    [combatNodes, effectsByNodeId, contentById, contentLoading],
  );

  const staleNodeIds = useMemo(
    () =>
      grantsLoading
        ? new Set<number>()
        : new Set(staleSnapshotNodeIds(REWARD_SHIP_SNAPSHOT, SHIP_GRANT_ADDRESS, grantsByNodeId, ids)),
    [grantsLoading, grantsByNodeId, ids],
  );

  const editBlockedReason = !address
    ? "Connect the ShipGrantWinEffect owner wallet to edit rewards."
    : ownerLoading
      ? null
      : !isOwner
        ? "This wallet doesn't own ShipGrantWinEffect, so it can only view rewards."
        : null;

  return (
    <RewardShipsAdminView
      nodes={nodes}
      grantsByNodeId={grantsByNodeId}
      isLoading={nodesLoading || grantsLoading}
      canEdit={isOwner}
      editBlockedReason={editBlockedReason}
      maxVariant={maxVariant}
      specialsForVariant={specialsForVariant}
      playerLabel="Player wallet address (0x…)"
      staleNodeIds={staleNodeIds}
      header={
        <RewardShipSnapshotPanel
          address={SHIP_GRANT_ADDRESS}
          staleCount={staleNodeIds.size}
          isLoading={nodesLoading || grantsLoading}
        />
      }
      onSave={async (nodeId, grant) => {
        const hash = await grantAdmin.setGrant(nodeId, grant);
        await refetchGrants();
        return `Reward ship saved for node #${nodeId}. (tx: ${hash.slice(0, 10)}…)`;
      }}
      onClear={async (nodeId) => {
        const hash = await grantAdmin.clearGrant(nodeId);
        await refetchGrants();
        return `Reward ship cleared for node #${nodeId}. (tx: ${hash.slice(0, 10)}…)`;
      }}
      onResetClaim={async (nodeId, player) => {
        if (!isAddress(player)) throw new Error("Enter a wallet address (0x…).");
        const hash = await grantAdmin.resetClaim(nodeId, player);
        return `Claim reset for ${player.slice(0, 8)}… on node #${nodeId}. (tx: ${hash.slice(0, 10)}…)`;
      }}
      onAttachEffect={async (nodeId) => {
        const current = effectsByNodeId.get(nodeId) ?? [];
        const hash = await nodeMapAdmin.setNodeWinEffects(BigInt(nodeId), [...current, SHIP_GRANT_ADDRESS]);
        await refetchEffects();
        return `Grant Ship added to node #${nodeId}'s win effects. (tx: ${hash.slice(0, 10)}…)`;
      }}
    />
  );
}
