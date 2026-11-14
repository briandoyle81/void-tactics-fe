"use client";

import { useQuery } from "@tanstack/react-query";
import { CampaignNode } from "../types/types";
import { viewGame } from "../near/rpc";
import { toBig } from "../near/codec";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";

/**
 * Every single-player campaign node across every campaign — admin/export
 * use only. Campaigns are numbered from 1 (read until the first missing
 * one); each lists its node ids (get_campaign), then each node is read.
 */
export function useAllCampaignNodes() {
  const result = useQuery({
    queryKey: ["near-sp-campaign-nodes", "all"],
    queryFn: async () => {
      const campaigns: Array<{ id: bigint; nodeIds: number[] }> = [];
      for (let id = 1; id <= 100; id++) {
        const c = await viewGame("get_campaign", { campaign_id: String(id) });
        if (!c) break;
        campaigns.push({ id: BigInt(id), nodeIds: c.node_ids });
      }
      const nodeIds = campaigns.flatMap((c) => c.nodeIds);
      const nodes = await Promise.all(nodeIds.map((id) => viewGame("get_node", { node_id: String(id) })));
      const out: CampaignNode[] = [];
      nodes.forEach((n, i) => {
        if (!n) return;
        out.push({
          id: BigInt(nodeIds[i]),
          campaignId: toBig(n.campaign_id),
          mapId: toBig(n.map_id),
          prerequisites: n.prerequisites.map((p) => toBig(p)),
          costLimit: toBig(n.cost_limit),
          turnTime: toBig(n.turn_time),
          maxScore: toBig(n.max_score),
          creatorGoesFirst: n.creator_goes_first,
          exists: true,
        });
      });
      return { nodes: out, campaignCount: campaigns.length };
    },
    staleTime: ADMIN_DATA_STALE_MS,
  });
  return {
    data: result.data?.nodes ?? [],
    campaignCount: result.data?.campaignCount ?? 0,
    isLoading: result.isLoading,
    error: result.error ?? null,
    refetch: () => void result.refetch(),
  };
}
