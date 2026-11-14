"use client";

import { useMemo } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { invalidateShipsReads } from "./useShipsContract";
import type { Address } from "../types/chain";
import { RoguelikeRun, RunStatus } from "../types/roguelike";
import { RL_RUN_QUERY_ROOT } from "./useGameLens";
import { viewGame } from "../near/rpc";
import { toRoguelikeRun } from "../near/adapters/roguelike";
import { GAME_CONTRACT } from "../near/config";

/** Matches every cached run read: this module's, the run view, and get_run / run-HP views. */
export function isRoguelikeRunQuery(queryKey: readonly unknown[]): boolean {
  if (queryKey[0] === RL_RUN_QUERY_ROOT) return true;
  return (
    queryKey[0] === "near" &&
    queryKey[1] === GAME_CONTRACT &&
    (queryKey[2] === "get_run" || queryKey[2] === "get_run_ship_hp" || queryKey[2] === "is_rl_node_locked" || queryKey[2] === "is_rl_node_defeated")
  );
}

/**
 * Drops every cached run read so the Mission tab loads the run fresh
 * instead of briefly showing a run that just ended, and refetches owned
 * ships so the released roster no longer shows as in a fleet. Used when
 * quitting after a lost mission.
 */
export function resetRoguelikeRunQueries(queryClient: QueryClient): void {
  void invalidateShipsReads(queryClient);
  queryClient.removeQueries({ predicate: (query) => isRoguelikeRunQuery(query.queryKey) });
}

/**
 * Refetches every run read after a won mission: the Mission tab stays
 * mounted during the match, so without this the run map keeps the
 * pre-mission roster HP and cleared/locked nodes.
 */
export function invalidateRoguelikeRunQueries(queryClient: QueryClient): Promise<void> {
  void invalidateShipsReads(queryClient);
  return queryClient.invalidateQueries({ predicate: (query) => isRoguelikeRunQuery(query.queryKey) });
}

function useRunQuery(playerAddress: Address | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [RL_RUN_QUERY_ROOT, "run", playerAddress ?? ""],
    queryFn: async () => toRoguelikeRun(await viewGame("get_run", { account_id: playerAddress! })),
    enabled: enabled && !!playerAddress,
    staleTime: 10_000,
  });
}

export function useGetRoguelikeRun(playerAddress: Address | undefined, enabled = true) {
  const result = useRunQuery(playerAddress, enabled);
  return { ...result, data: result.data as RoguelikeRun | undefined };
}

export function useHasActiveRoguelikeRun(playerAddress: Address | undefined) {
  const result = useRunQuery(playerAddress, true);
  return { ...result, data: result.data ? result.data.status === RunStatus.Active : undefined };
}

/**
 * Run HP for any of the player's ships. Stored per ship for the whole run,
 * so a ship dropped at a resupply keeps its damage. 0 means "not yet
 * damaged this run" (fresh 100%), not literally 0 HP.
 */
export function useRoguelikeRosterHP(playerAddress: Address | undefined, shipIds: bigint[]) {
  const key = shipIds.map(String).join(",");
  const result = useQuery({
    queryKey: [RL_RUN_QUERY_ROOT, "hp", playerAddress ?? "", key],
    queryFn: async () =>
      Promise.all(
        shipIds.map((id) => viewGame("get_run_ship_hp", { account_id: playerAddress!, ship_id: id.toString() })),
      ),
    enabled: !!playerAddress && shipIds.length > 0,
    staleTime: 10_000,
  });
  const hpByShipId = useMemo(() => {
    const map = new Map<string, number>();
    shipIds.forEach((id, i) => map.set(id.toString(), Number(result.data?.[i] ?? 0)));
    return map;
  }, [shipIds, result.data]);
  return { ...result, hpByShipId };
}
