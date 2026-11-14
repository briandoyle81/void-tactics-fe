"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { viewGame } from "../near/rpc";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";
import { RL_GRAPH_QUERY_ROOT } from "./useGameLens";
import { fetchAllRoguelikeNodes } from "../near/adapters/roguelike";
import {
  WIN_EFFECT_IDS,
  decBonusOf,
  healPercentOf,
  winEffectId,
} from "../near/adapters/winEffects";
import type { WinEffect } from "../near/generated/voidTactics";

// Roguelike win effects: each node carries an ordered list of effects with
// their values (app/near/adapters/winEffects.ts). Screens identify an effect
// kind by its id in WIN_EFFECT_IDS (what used to be the effect contract's
// address).

export const WIN_EFFECT_CATALOG = [
  { key: "DEC_BONUS_WIN_EFFECT", label: "DCC Bonus" },
  { key: "HEAL_ABOVE_FLOOR_WIN_EFFECT", label: "Heal Above Floor" },
  { key: "SHIP_GRANT_WIN_EFFECT", label: "Grant Ship" },
] as const;

/** Effect kind -> its id (stand-in for the old effect contract address). */
export function useWinEffectAddresses(): Record<string, string> {
  return WIN_EFFECT_IDS;
}

function useNodeEffectsQuery(nodeIds: readonly bigint[], enabled = true) {
  const key = nodeIds.map(String).join(",");
  return useQuery({
    queryKey: [RL_GRAPH_QUERY_ROOT, "win-effects", key],
    queryFn: async () => {
      const nodes = await Promise.all(nodeIds.map((id) => viewGame("get_rl_node", { node_id: id.toString() })));
      return nodes.map((n) => (n?.win_effects ?? []) as WinEffect[]);
    },
    enabled: enabled && nodeIds.length > 0,
    staleTime: ADMIN_DATA_STALE_MS,
  });
}

/** A node's effect ids (`data`) and the effects with their values (`effects`). */
export function useRoguelikeNodeWinEffects(nodeId: bigint | undefined) {
  const ids = useMemo(() => (nodeId != null ? [nodeId] : []), [nodeId]);
  const result = useNodeEffectsQuery(ids, nodeId != null);
  const effects = result.data?.[0];
  const data = useMemo(() => effects?.map(winEffectId), [effects]);
  return { ...result, data, effects };
}

/** Effect ids (and values) for many roguelike nodes (admin export). */
export function useRoguelikeNodesWinEffects(nodeIds: bigint[]) {
  const result = useNodeEffectsQuery(nodeIds);
  const { effectsByNodeId, rawByNodeId } = useMemo(() => {
    const ids = new Map<number, string[]>();
    const raw = new Map<number, WinEffect[]>();
    nodeIds.forEach((id, i) => {
      const effects = result.data?.[i];
      if (!effects) return;
      ids.set(Number(id), effects.map(winEffectId));
      raw.set(Number(id), effects);
    });
    return { effectsByNodeId: ids, rawByNodeId: raw };
  }, [nodeIds, result.data]);
  return { effectsByNodeId, rawByNodeId, isLoading: result.isLoading, error: result.error, refetch: result.refetch };
}

/** Every node's effects (for "campaign-wide" values). */
function useAllNodeEffects() {
  return useQuery({
    queryKey: [RL_GRAPH_QUERY_ROOT, "all"],
    queryFn: () => fetchAllRoguelikeNodes(),
    staleTime: ADMIN_DATA_STALE_MS,
  });
}

/**
 * The DCC bonus: a node's, or (no node) the value the campaign's DCC-bonus
 * nodes use (the first one found). Set campaign-wide with useWinEffectsAdmin.
 */
export function useDECBonusAmount(nodeId?: bigint) {
  const node = useRoguelikeNodeWinEffects(nodeId);
  const all = useAllNodeEffects();
  const data = useMemo(() => {
    if (nodeId != null) return decBonusOf(node.effects);
    for (const n of all.data ?? []) {
      const v = decBonusOf(n.raw.win_effects);
      if (v != null) return v;
    }
    return undefined;
  }, [nodeId, node.effects, all.data]);
  return { data, isLoading: nodeId != null ? node.isLoading : all.isLoading, refetch: nodeId != null ? node.refetch : all.refetch };
}

/** The heal-above-floor percent: a node's, or the campaign's (first found). */
export function useHealAboveFloorPercent(nodeId?: bigint) {
  const node = useRoguelikeNodeWinEffects(nodeId);
  const all = useAllNodeEffects();
  const data = useMemo(() => {
    if (nodeId != null) return healPercentOf(node.effects);
    for (const n of all.data ?? []) {
      const v = healPercentOf(n.raw.win_effects);
      if (v != null) return v;
    }
    return undefined;
  }, [nodeId, node.effects, all.data]);
  return { data, isLoading: nodeId != null ? node.isLoading : all.isLoading, refetch: nodeId != null ? node.refetch : all.refetch };
}
