"use client";

import React, { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiFetch";
import { validSpecialsForVariant } from "../../types/types";
import { RoguelikeNodeKind } from "../../types/roguelike";
import { MAX_FACTION_VARIANT } from "../../config/factions";
import { useWeb2Admin } from "../../hooks/useWeb2Admin";
import { useRoguelikeAdminWeb2 } from "../../hooks/useRoguelikeAdminWeb2";
import { resolveNodeContent, useNodeContentWeb2 } from "../../hooks/useNodeContent";
import { useShipGrantsAdminWeb2 } from "../../hooks/useShipGrantsWeb2";
import { RewardShipsAdminView, type RewardShipsAdminNode } from "./RewardShipsAdminView";

interface AdminNodeRow {
  id: number;
  campaignId: number;
  kind: number;
  winEffects: string[];
}

const NODES_KEY = ["admin-roguelike-nodes", "reward-ships"];

/** Web2's Reward Ships tab: the admin API (see RewardShipsAdminView). */
export function RewardShipsAdminWeb2() {
  const isAdmin = useWeb2Admin();
  const queryClient = useQueryClient();
  const { data: rows, isLoading: nodesLoading } = useQuery({
    queryKey: NODES_KEY,
    queryFn: () => apiFetch<AdminNodeRow[]>("/api/admin/roguelike/nodes"),
  });
  const { contentById, isLoading: contentLoading } = useNodeContentWeb2("ROGUELIKE");
  const { grantsByNodeId, isLoading: grantsLoading, setGrant, clearGrant, resetClaim } = useShipGrantsAdminWeb2();
  const roguelikeAdmin = useRoguelikeAdminWeb2();

  const nodes = useMemo(
    (): RewardShipsAdminNode[] =>
      (rows ?? [])
        .filter((n) => n.kind === RoguelikeNodeKind.Combat)
        .map((n) => ({
          id: n.id,
          campaignId: n.campaignId,
          title: resolveNodeContent(contentById, n.id, contentLoading).title,
          hasGrantEffect: n.winEffects.includes("SHIP_GRANT_WIN_EFFECT"),
        })),
    [rows, contentById, contentLoading],
  );

  const specialsForVariant = useCallback((variant: number) => validSpecialsForVariant(variant), []);

  return (
    <RewardShipsAdminView
      nodes={nodes}
      grantsByNodeId={grantsByNodeId}
      isLoading={nodesLoading || grantsLoading}
      canEdit={isAdmin}
      editBlockedReason={isAdmin ? null : "Sign in with a web2 admin account to edit rewards."}
      maxVariant={MAX_FACTION_VARIANT}
      specialsForVariant={specialsForVariant}
      playerLabel="Player email"
      onSave={async (nodeId, grant) => {
        await setGrant(nodeId, grant);
        return `Reward ship saved for node #${nodeId}.`;
      }}
      onClear={async (nodeId) => {
        await clearGrant(nodeId);
        return `Reward ship cleared for node #${nodeId}.`;
      }}
      onResetClaim={async (nodeId, player) => {
        const count = await resetClaim(nodeId, player);
        return count > 0 ? `Claim reset for ${player} on node #${nodeId}.` : `${player} hadn't claimed node #${nodeId}.`;
      }}
      onAttachEffect={async (nodeId) => {
        const current = rows?.find((n) => n.id === nodeId)?.winEffects ?? [];
        await roguelikeAdmin.setNodeWinEffects(nodeId, [...current, "SHIP_GRANT_WIN_EFFECT"]);
        await queryClient.invalidateQueries({ queryKey: NODES_KEY });
        return `Grant Ship added to node #${nodeId}'s win effects.`;
      }}
    />
  );
}
