"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { RoguelikeNode } from "../types/roguelike";
import { useWeb3NodeContent, mergeNodeContent, type ResolvedNodeContent } from "./useNodeContent";
import { useRoguelikeCampaignGraph, RL_GRAPH_QUERY_ROOT } from "./useGameLens";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";
import { useNearView } from "../near/useNearView";
import { toBig } from "../near/codec";
import { fetchAllRoguelikeNodes } from "../near/adapters/roguelike";
import { viewGame } from "../near/rpc";
import { ROLE } from "../near/config";
import type { RlCampaign } from "../near/generated/voidTactics";

function useRlCampaign(campaignId: bigint | undefined) {
  const args = useMemo(() => (campaignId != null ? { campaign_id: campaignId.toString() } : null), [campaignId]);
  return useNearView("get_rl_campaign", args, { staleTime: ADMIN_DATA_STALE_MS });
}

function pick<T>(result: ReturnType<typeof useRlCampaign>, f: (c: RlCampaign) => T) {
  return { ...result, data: result.data ? f(result.data) : undefined };
}

export function useCampaignAutoHealPercent(campaignId: bigint | undefined) {
  return pick(useRlCampaign(campaignId), (c) => c.auto_heal_percent);
}

/** 0 = unrestricted. */
export function useRoguelikeCampaignRequiredVariant(campaignId: bigint | undefined) {
  return pick(useRlCampaign(campaignId), (c) => c.required_variant);
}

export function useRoguelikeCampaignRootNode(campaignId: bigint | undefined) {
  return pick(useRlCampaign(campaignId), (c) => toBig(c.root_node));
}

export function useRoguelikeCampaignInitialCostCap(campaignId: bigint | undefined) {
  return pick(useRlCampaign(campaignId), (c) => toBig(c.initial_cost_cap));
}

/** Campaigns are numbered from 1; counts them by reading until the first missing id. */
export function useRoguelikeCampaignCount() {
  const result = useQuery({
    queryKey: [RL_GRAPH_QUERY_ROOT, "campaign-count"],
    queryFn: async () => {
      let n = 0;
      while (n < 100 && (await viewGame("get_rl_campaign", { campaign_id: String(n + 1) }))) n++;
      return BigInt(n);
    },
    staleTime: ADMIN_DATA_STALE_MS,
  });
  return { ...result, data: result.data };
}

/** Owner, or holds the NODE_EDITOR role. */
export function useIsRoguelikeNodeEditor(address: string | undefined) {
  const args = useMemo(() => (address ? { account_id: address } : null), [address]);
  const roles = useNearView("get_roles", args, { staleTime: ADMIN_DATA_STALE_MS });
  const owner = useNearView("owner_id", {}, { staleTime: ADMIN_DATA_STALE_MS });
  const data =
    address == null ? undefined : owner.data === address || ((roles.data ?? 0) & ROLE.NODE_EDITOR) !== 0;
  return { ...roles, data };
}

function useAllRoguelikeNodesQuery(enabled: boolean) {
  return useQuery({
    queryKey: [RL_GRAPH_QUERY_ROOT, "all"],
    queryFn: () => fetchAllRoguelikeNodes(),
    enabled,
    staleTime: ADMIN_DATA_STALE_MS,
  });
}

export function useRoguelikeNodeCount(enabled = true) {
  const result = useAllRoguelikeNodesQuery(enabled);
  return { ...result, data: result.data ? BigInt(result.data.length) : undefined };
}

/** Every roguelike node, linked into a graph or not (the map editor needs both). */
export function useAllRoguelikeNodes(enabled = true) {
  const result = useAllRoguelikeNodesQuery(enabled);
  const nodes = useMemo(() => (result.data ?? []).map((n) => n.node), [result.data]);
  return { ...result, nodes };
}

export type RoguelikeNodeWithContent = RoguelikeNode & ResolvedNodeContent;

/**
 * The roguelike graph for one campaign, content included (node text from
 * app/data/content via useWeb3NodeContent). Two sources:
 * - default: every node, which the map editor needs to see nodes not linked in yet;
 * - `reachableOnly`: only the nodes reachable from the root — all a player can visit.
 */
export function useRoguelikeGraphWithContent(
  campaignId: bigint,
  enabled = true,
  { reachableOnly = false }: { reachableOnly?: boolean } = {},
) {
  const scan = useAllRoguelikeNodes(enabled && !reachableOnly);
  const lens = useRoguelikeCampaignGraph(campaignId, enabled && reachableOnly);
  const source = reachableOnly ? lens : scan;

  const campaignNodes = useMemo(
    () => source.nodes.filter((n) => n.campaignId === campaignId),
    [source.nodes, campaignId],
  );
  const nodeIds = useMemo(() => campaignNodes.map((n) => n.id), [campaignNodes]);
  const { contentById, isLoading: contentLoading } = useWeb3NodeContent("ROGUELIKE", nodeIds);

  const nodes = useMemo(
    () => mergeNodeContent(campaignNodes, contentById, contentLoading),
    [campaignNodes, contentById, contentLoading],
  );

  const refetchNodes = source.refetch;
  const refetch = useCallback(() => refetchNodes(), [refetchNodes]);

  return { isLoading: source.isLoading, error: source.error, nodes, refetch };
}
