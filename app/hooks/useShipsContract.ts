import { useMemo } from "react";
import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";
import type { Ship } from "../types/types";
import { viewGame } from "../near/rpc";
import { toShipFromView } from "../near/adapters/ship";
import { shipIdsKey } from "../utils/shipIdsKey";
import { NEAR_QUERY_ROOTS } from "../near/sync/gameRefetchRegistry";
import { nearViewPrefix } from "../near/useNearView";

const SHIPS_BY_IDS_ROOT = "near-ship-list";

/** Player ships (NFTs) by id, in the given order; missing ids are skipped. */
export async function fetchShipsByIds(ids: readonly bigint[]): Promise<Ship[]> {
  const views = await Promise.all(ids.map((id) => viewGame("get_ship", { ship_id: id.toString() })));
  return views.filter((v) => v != null).map((v) => toShipFromView(v!));
}

/** Ships by id (e.g. a lobby fleet's). `ids` null/empty disables it. */
export function useShipList(ids: readonly bigint[] | null | undefined) {
  const key = shipIdsKey(ids ?? []);
  const stable = useMemo(() => key.split(",").filter(Boolean).map((id) => BigInt(id)), [key]);
  return useQuery({
    queryKey: [SHIPS_BY_IDS_ROOT, key],
    queryFn: () => fetchShipsByIds(stable),
    enabled: stable.length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Refetches every cached ship read (owned ships, ship lists, single ships):
 * state that changes outside an explicit refetch — a roguelike run ending
 * and releasing its roster (inFleet → false) — would otherwise stay stale.
 */
export function invalidateShipsReads(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [NEAR_QUERY_ROOTS.ownedShips] }),
    queryClient.invalidateQueries({ queryKey: [SHIPS_BY_IDS_ROOT] }),
    queryClient.invalidateQueries({ queryKey: nearViewPrefix("get_ship") }),
  ]).then(() => undefined);
}

/**
 * The ship reads the lobby screen makes, by their old names:
 * "getShipsByIds" ([ids]) -> Ship[]. Other names read as undefined (the
 * settings and player summary have their own hooks: useGameSettings,
 * usePlayerSummary).
 */
export function useShipsRead(functionName: string, args?: readonly unknown[]) {
  const ids = functionName === "getShipsByIds" ? ((args?.[0] as bigint[] | undefined) ?? null) : null;
  const result = useShipList(ids);
  if (functionName !== "getShipsByIds") {
    return { data: undefined, isLoading: false, error: null, refetch: result.refetch };
  }
  return result;
}
