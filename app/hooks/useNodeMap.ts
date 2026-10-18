"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { baseSepolia } from "viem/chains";
import type { Abi } from "viem";
import { CONTRACT_ABIS, CONTRACT_ADDRESSES_BY_CHAIN_ID } from "../config/contracts";
import { CampaignNode } from "../types/types";

// Single-player (NodeMap/SinglePlayerMatch/AIEncounters) is Base Sepolia
// only — always read from that chain regardless of the connected
// wallet/picker chain, same pattern as useSinglePlayerMatch.ts.
const CHAIN_ID = baseSepolia.id;
const NODE_MAP_ABI = CONTRACT_ABIS.NODE_MAP as Abi;
const NODE_MAP_ADDRESS = CONTRACT_ADDRESSES_BY_CHAIN_ID[CHAIN_ID]
  .NODE_MAP as `0x${string}`;

export function useNodeMapContract() {
  return {
    address: NODE_MAP_ADDRESS,
    abi: NODE_MAP_ABI,
    chainId: CHAIN_ID,
  };
}

/**
 * Every node across every existing campaign — admin/export use only (the
 * "show everything, labeled by campaign" case: NodeMapAdminPanel.tsx,
 * AdminSettingsExport.tsx), not the player-facing single-active-campaign
 * graph. Reads campaignCount() then batches getNodesInCampaign(id) for ids
 * 1..count (campaigns are 1-indexed — verified live: campaignExists(0) is
 * false, campaignExists(1) is true), flattens, then batches getNode(id).
 */
export function useAllCampaignNodes() {
  const countResult = useReadContract({
    address: NODE_MAP_ADDRESS,
    abi: NODE_MAP_ABI,
    chainId: CHAIN_ID,
    functionName: "campaignCount",
  });

  const campaignIds = useMemo(() => {
    const count = countResult.data != null ? Number(countResult.data as bigint) : 0;
    return Array.from({ length: count }, (_, i) => BigInt(i + 1));
  }, [countResult.data]);

  const idsPerCampaignResult = useReadContracts({
    contracts: campaignIds.map((id) => ({
      address: NODE_MAP_ADDRESS,
      abi: NODE_MAP_ABI,
      chainId: CHAIN_ID,
      functionName: "getNodesInCampaign" as const,
      args: [id] as const,
    })),
    query: { enabled: campaignIds.length > 0 },
  });

  const nodeIds = useMemo(() => {
    const ids: bigint[] = [];
    idsPerCampaignResult.data?.forEach((r) => {
      (r.result as readonly bigint[] | undefined)?.forEach((id) => ids.push(id));
    });
    return ids;
  }, [idsPerCampaignResult.data]);

  const nodesResult = useReadContracts({
    contracts: nodeIds.map((id) => ({
      address: NODE_MAP_ADDRESS,
      abi: NODE_MAP_ABI,
      chainId: CHAIN_ID,
      functionName: "getNode" as const,
      args: [id] as const,
    })),
    query: { enabled: nodeIds.length > 0 },
  });

  const nodes = useMemo(
    () =>
      nodesResult.data
        ?.map((r) => r.result as CampaignNode | undefined)
        .filter((n): n is CampaignNode => n != null) ?? [],
    [nodesResult.data],
  );

  return {
    data: nodes,
    campaignCount: campaignIds.length,
    isLoading: countResult.isLoading || idsPerCampaignResult.isLoading || nodesResult.isLoading,
    error: countResult.error ?? idsPerCampaignResult.error ?? nodesResult.error ?? null,
    refetch: () => {
      void countResult.refetch();
      void idsPerCampaignResult.refetch();
      void nodesResult.refetch();
    },
  };
}
