"use client";

import React, { useCallback, useMemo } from "react";
import { useChainAccount } from "../../near/useChainAccount";
import { useNearViews } from "../../near/useNearView";
import { ADMIN_DATA_STALE_MS } from "../../config/queryTiming";
import { DEFAULT_MAX_SPECIAL_SLOT, validSpecialsForVariant } from "../../types/types";
import { RoguelikeNodeKind } from "../../types/roguelike";
import { useAllRoguelikeNodes } from "../../hooks/useRoguelikeNodeMap";
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

/**
 * Web3's Reward Ships tab (see RewardShipsAdminView): each roguelike combat
 * node's reward ship is its ShipGrant win effect (NODE_EDITOR or owner).
 */
export function RewardShipsAdmin() {
  const { address } = useChainAccount();
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

  // Special slots per variant (get_max_special_slot).
  const slotArgs = useMemo(() => Array.from({ length: maxVariant }, (_, i) => ({ variant: i + 1 })), [maxVariant]);
  const slotResults = useNearViews("get_max_special_slot", slotArgs, { staleTime: ADMIN_DATA_STALE_MS });
  const slotData = slotResults.map((r) => r.data);
  const specialsForVariant = useCallback(
    (variant: number) => {
      const raw = slotData[variant - 1];
      return validSpecialsForVariant(variant, raw != null ? Number(raw) : DEFAULT_MAX_SPECIAL_SLOT);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slotData is rebuilt each render from cached queries
    [slotData.join(",")],
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
    ? "Sign in as the contract owner or a node editor to edit rewards."
    : ownerLoading
      ? null
      : !isOwner
        ? "This account isn't the owner or a node editor, so it can only view rewards."
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
      playerLabel="Player account"
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
        if (!player.trim()) throw new Error("Enter the player's account.");
        const hash = await grantAdmin.resetClaim(nodeId, player);
        return `Claim reset for ${player.slice(0, 8)}… on node #${nodeId}. (tx: ${hash.slice(0, 10)}…)`;
      }}
      onAttachEffect={async (nodeId) => {
        // On NEAR the grant is the effect: saving a reward ship adds it.
        const grant = grantsByNodeId.get(nodeId);
        if (!grant) throw new Error("Save a reward ship for this node first; that adds the Grant Ship effect.");
        const hash = await grantAdmin.setGrant(nodeId, grant);
        await Promise.all([refetchEffects(), refetchGrants()]);
        return `Grant Ship added to node #${nodeId}'s win effects. (tx: ${hash.slice(0, 10)}…)`;
      }}
    />
  );
}
