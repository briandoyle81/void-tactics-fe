"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "../types/chain";
import { viewGame } from "../near/rpc";
import { fetchCampaignGraph, rosterHp, toRoguelikeRun } from "../near/adapters/roguelike";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";

/** Query-key root for every roguelike run read (useRoguelikeRun's reset/invalidate helpers use it). */
export const RL_RUN_QUERY_ROOT = "near-rl-run";
export const RL_GRAPH_QUERY_ROOT = "near-rl-graph";

/**
 * The player's run, each roster ship's persisted HP (0 = not yet damaged,
 * i.e. full), and the locked/defeated flag for every node reachable in its
 * campaign. Maps are keyed by id string.
 */
export function useRoguelikeRunView(player: Address | undefined, enabled = true) {
  const result = useQuery({
    queryKey: [RL_RUN_QUERY_ROOT, "view", player ?? ""],
    queryFn: async () => {
      const raw = await viewGame("get_run", { account_id: player! });
      const run = toRoguelikeRun(raw);
      const lockedByNodeId = new Map<string, boolean>();
      const defeatedByNodeId = new Map<string, boolean>();
      if (run.campaignId > BigInt(0)) {
        const graph = await fetchCampaignGraph(run.campaignId);
        await Promise.all(
          graph.map(async ({ node }) => {
            const id = node.id.toString();
            const [locked, defeated] = await Promise.all([
              viewGame("is_rl_node_locked", { account_id: player!, node_id: id }),
              viewGame("is_rl_node_defeated", { account_id: player!, node_id: id }),
            ]);
            lockedByNodeId.set(id, locked);
            defeatedByNodeId.set(id, defeated);
          }),
        );
      }
      return { run, hpByShipId: rosterHp(raw), lockedByNodeId, defeatedByNodeId };
    },
    enabled: enabled && !!player,
    staleTime: 10_000,
  });
  const view = useMemo(
    () => ({
      run: result.data?.run,
      hpByShipId: result.data?.hpByShipId ?? new Map<string, number>(),
      lockedByNodeId: result.data?.lockedByNodeId ?? new Map<string, boolean>(),
      defeatedByNodeId: result.data?.defeatedByNodeId ?? new Map<string, boolean>(),
    }),
    [result.data],
  );
  return { ...view, isLoading: result.isLoading, refetch: result.refetch };
}

/** Every node reachable from the campaign's root (breadth-first), children included. */
export function useRoguelikeCampaignGraph(campaignId: bigint, enabled = true) {
  const result = useQuery({
    queryKey: [RL_GRAPH_QUERY_ROOT, "reachable", campaignId.toString()],
    queryFn: () => fetchCampaignGraph(campaignId),
    enabled,
    staleTime: ADMIN_DATA_STALE_MS,
  });
  const nodes = useMemo(() => (result.data ?? []).map((n) => n.node), [result.data]);
  return { ...result, nodes };
}
