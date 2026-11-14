import { useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GameDataView } from "../types/types";
import { keepUnchangedGameSnapshot, keepUnchangedGamesList } from "../utils/normalizeGameDataView";
import { fetchGameDataView, fetchGameDataViews } from "../near/adapters/game";
import { fetchPlayerGameIds } from "../near/playerGames";
import { useNearView } from "../near/useNearView";
import { NEAR_QUERY_ROOTS } from "../near/sync/gameRefetchRegistry";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";
import { useGameSettings } from "../near/useGameSettings";
import type { GameSettings } from "../near/generated/voidTactics";
import { gameMapKey, toGameMapState } from "./useMapsContract";

const selectHealCap = (s: GameSettings) => s.heal_cap_percent;

/** Query key for one game; refetched by the open match (useGamePolling / NearSyncHost). */
export function gameQueryKey(gameId: number | bigint) {
  return ["near-game", String(gameId)] as const;
}

/** The contract owner (owner_id). Owner-gated admin controls check this. */
export function useGameOwner() {
  return useNearView("owner_id", {}, { staleTime: ADMIN_DATA_STALE_MS });
}

/** Global heal ceiling (% of max HP), from get_settings. */
export function useHealCapPercent() {
  return useGameSettings(selectHealCap);
}

/** Every game the player is in (see app/near/playerGames.ts), as GameDataViews, newest first. */
export function useGetGamesForPlayer(playerAddress: string, options?: { enabled?: boolean }) {
  const snapshotRef = useRef<GameDataView[] | undefined>(undefined);
  const selectedAddressRef = useRef(playerAddress);
  if (selectedAddressRef.current !== playerAddress) {
    selectedAddressRef.current = playerAddress;
    snapshotRef.current = undefined;
  }
  const select = useCallback((next: GameDataView[]) => {
    const kept = keepUnchangedGamesList(snapshotRef.current, next);
    snapshotRef.current = kept;
    return kept;
  }, []);
  return useQuery({
    queryKey: [NEAR_QUERY_ROOTS.playerGames, playerAddress],
    queryFn: async () => {
      const ids = await fetchPlayerGameIds(playerAddress);
      return fetchGameDataViews(ids);
    },
    enabled: Boolean(playerAddress) && (options?.enabled ?? true),
    staleTime: 15_000,
    select,
  });
}

/** One game as a GameDataView. Refetch it to poll; unchanged boards keep their identity. */
export function useGetGame(gameId: number) {
  const snapshotRef = useRef<GameDataView | undefined>(undefined);
  const selectedGameIdRef = useRef(gameId);
  if (selectedGameIdRef.current !== gameId) {
    selectedGameIdRef.current = gameId;
    snapshotRef.current = undefined;
  }
  const select = useCallback((next: GameDataView | null) => {
    if (!next) return undefined;
    const kept = keepUnchangedGameSnapshot(snapshotRef.current, next);
    snapshotRef.current = kept;
    return kept;
  }, []);
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: gameQueryKey(gameId),
    // The same get_game carries the game's map: keep its map query current
    // (live map edits, collected crystals) without a second read.
    queryFn: () =>
      fetchGameDataView(gameId, (state) => {
        if (queryClient.getQueryData(gameMapKey(gameId)) !== undefined) {
          queryClient.setQueryData(gameMapKey(gameId), toGameMapState(state));
        }
      }),
    enabled: gameId > 0,
    staleTime: 2_000,
    select,
  });
}

/** How many real special slots a faction has (0 = None). Owner-set, currently 3 for both variants. */
export function useMaxSpecialSlot(variant: number | undefined) {
  const args = useMemo(() => (variant != null && variant > 0 ? { variant } : null), [variant]);
  const result = useNearView("get_max_special_slot", args, { staleTime: ADMIN_DATA_STALE_MS });
  const raw = result.data;
  const parsed = raw == null ? 3 : Number(raw);
  const maxSlot = Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
  return { ...result, maxSlot };
}

/** Several games by id, as GameDataViews (missing ones skipped). */
export function useGetGamesFromIds(gameIds: number[]) {
  const key = gameIds.join(",");
  return useQuery({
    queryKey: ["near-games-by-ids", key],
    queryFn: async () => {
      const games = await Promise.all(gameIds.map((id) => fetchGameDataView(id).catch(() => null)));
      return games.filter((g): g is GameDataView => g != null);
    },
    enabled: gameIds.length > 0,
    staleTime: 15_000,
  });
}
