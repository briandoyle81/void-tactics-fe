"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { apiMutate } from "../lib/apiMutate";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";
import { parseShipGrant, type NodeRewardShip, type ShipGrantSpec } from "../utils/shipGrant";
import type { Web2Ship } from "../types/web2Ship";

// Web2 counterpart to useShipGrants.ts: per-node reward ships from the
// RoguelikeShipGrant table (app/lib/shipGrantsWeb2.ts) through the API.

interface ShipGrantsResponse {
  grants: { nodeId: number; grant: unknown }[];
  /** Nodes whose once-only ship the signed-in player already received. */
  claimedNodeIds?: number[];
}

/** How many times the result screen asks for a win's reward ship before giving up. */
const AWARD_LOOKUPS = 5;

const PUBLIC_KEY = (nodeIds: readonly number[]) => ["ship-grants", "public", nodeIds.join(",")];
const ADMIN_KEY = ["ship-grants", "admin"];

function toMap(grants: ShipGrantsResponse["grants"] | undefined): Map<number, ShipGrantSpec> {
  const map = new Map<number, ShipGrantSpec>();
  (grants ?? []).forEach(({ nodeId, grant }) => {
    const parsed = parseShipGrant(grant);
    if (parsed) map.set(nodeId, parsed);
  });
  return map;
}

/** One node's reward ship for the signed-in player (web2's getGrant + hasClaimed). */
export function useNodeRewardShipWeb2(nodeId: number | undefined): NodeRewardShip | null {
  const ids = useMemo(() => (nodeId != null ? [nodeId] : []), [nodeId]);
  const { data } = useQuery({
    queryKey: PUBLIC_KEY(ids),
    queryFn: () => apiFetch<ShipGrantsResponse>(`/api/roguelike/ship-grants?nodeIds=${ids.join(",")}`),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
  return useMemo(() => {
    if (nodeId == null) return null;
    const grant = toMap(data?.grants).get(nodeId);
    return grant ? { grant, claimed: !!data?.claimedNodeIds?.includes(nodeId) } : null;
  }, [data, nodeId]);
}

/** Every node's reward ship plus the admin writes (web2 admin session required). */
export function useShipGrantsAdminWeb2() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ADMIN_KEY,
    queryFn: () => apiFetch<ShipGrantsResponse>("/api/admin/roguelike/ship-grants"),
    staleTime: ADMIN_DATA_STALE_MS,
  });
  const grantsByNodeId = useMemo(() => toMap(data?.grants), [data]);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["ship-grants"] }),
    [queryClient],
  );
  const setGrant = useCallback(
    async (nodeId: number, grant: ShipGrantSpec) => {
      await apiMutate("/api/admin/roguelike/ship-grants", "PUT", { nodeId, grant });
      await invalidate();
    },
    [invalidate],
  );
  const clearGrant = useCallback(
    async (nodeId: number) => {
      await apiMutate("/api/admin/roguelike/ship-grants", "DELETE", { nodeId });
      await invalidate();
    },
    [invalidate],
  );
  const resetClaim = useCallback(
    async (nodeId: number, player: string) => {
      const res = await apiMutate<{ reset: number }>("/api/admin/roguelike/ship-grants/reset-claim", "POST", {
        nodeId,
        player,
      });
      await invalidate();
      return res.reset;
    },
    [invalidate],
  );
  return { grantsByNodeId, isLoading, setGrant, clearGrant, resetClaim };
}

/** The reward ship a finished roguelike game minted for the signed-in player, if any. */
export function useRewardShipAwardWeb2(lobbyId: number | undefined, enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["ship-grants", "award", lobbyId],
    queryFn: () => apiFetch<{ ship: Web2Ship | null }>(`/api/roguelike/ship-grants/award?lobbyId=${lobbyId}`),
    enabled: enabled && lobbyId != null,
    // The award is written when the game resolves, so it can lag the result
    // screen by a moment: look again a few times, then stop (a win that
    // minted nothing never gets one).
    refetchInterval: (query) =>
      !query.state.data?.ship && query.state.dataUpdateCount < AWARD_LOOKUPS ? 3000 : false,
    refetchIntervalInBackground: false,
  });
  return data?.ship ?? null;
}
