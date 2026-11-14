"use client";

import { useEffect, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ship } from "../types/types";
import { AI_SHIP_ID_OFFSET, cacheShipsData } from "./useShipDataCache";
import { shipIdsKey } from "../utils/shipIdsKey";
import { viewGame } from "../near/rpc";
import { toShipFromView } from "../near/adapters/ship";
import { fetchGameMeta } from "../near/adapters/game";

/**
 * Full Ship data for the ships in a live game (both sides). Player ships
 * are NFTs (get_ship); AI ships aren't, they live in the game's match record
 * (get_sp_match / get_rl_match ai_ships), and their ids (AI_SHIP_ID_OFFSET
 * + n) repeat across matches, so they're read per game.
 */
export function useShipsByIds(shipIds: bigint[], gameId?: bigint | number) {
  // Callers often pass a fresh array each poll; key off sorted contents.
  const idsKey = shipIdsKey(shipIds);
  const stableShipIds = useMemo(
    () => idsKey.split(",").filter(Boolean).map((id) => BigInt(id)),
    [idsKey],
  );
  const gameKey = gameId != null ? String(gameId) : "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["near-ships-by-ids", gameKey, idsKey],
    queryFn: async (): Promise<Ship[]> => {
      const human = stableShipIds.filter((id) => id < AI_SHIP_ID_OFFSET);
      const hasAi = stableShipIds.some((id) => id >= AI_SHIP_ID_OFFSET);
      const [humanViews, meta] = await Promise.all([
        Promise.all(human.map((id) => viewGame("get_ship", { ship_id: id.toString() }))),
        hasAi && gameKey ? fetchGameMeta(gameKey) : Promise.resolve(null),
      ]);
      const ships: Ship[] = humanViews.filter((v) => v != null).map((v) => toShipFromView(v!));
      if (meta) {
        const wanted = new Set(stableShipIds.map(String));
        ships.push(...meta.aiShips.filter((s) => wanted.has(String(s.id))));
      }
      return ships;
    },
    enabled: stableShipIds.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // When the set of ships changes, keep drawing the ones we have until
    // the new set arrives, rather than an empty board.
    placeholderData: keepPreviousData,
  });

  const ships = useMemo(() => data ?? [], [data]);

  // cacheShipsData itself skips AI ship ids (reused across matches).
  useEffect(() => {
    if (ships.length > 0) cacheShipsData(ships);
  }, [ships]);

  return { ships, isLoading, error, refetch };
}
