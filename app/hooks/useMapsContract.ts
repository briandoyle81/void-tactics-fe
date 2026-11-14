import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapMode } from "../types/types";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";
import { STATIC_MAP_NAMES } from "../config/content";
import {
  bitmapToPositions,
  fetchAllPresetMaps,
  fetchPresetMap,
  toScoringPositions,
  type DecodedPresetMap,
  type MapPos,
} from "../near/adapters/maps";
import { viewGame } from "../near/rpc";
import { GAME_CONTRACT } from "../near/config";
import type { GameState } from "../near/generated/voidTactics";

// Preset maps live on the game contract (get_preset_map / get_map_count).
// Every list-shaped hook here shares one cached read of all maps
// (ALL_MAPS_KEY); single-map hooks read their map once (preset maps don't
// change mid-game, and editors refetch after saving).

export const ALL_MAPS_KEY = ["near-maps", "all"] as const;
export function presetMapKey(mapId: number) {
  return ["near-maps", "one", mapId] as const;
}

/** Stand-in for the old Maps contract handle: admin screens key caches off `address`. */
export function useMapsContract() {
  return { address: GAME_CONTRACT };
}

function isValidPositiveInt(n: number) {
  return Number.isFinite(n) && Number.isInteger(n) && n > 0;
}

function useAllMaps(enabled = true) {
  return useQuery({
    queryKey: ALL_MAPS_KEY,
    queryFn: fetchAllPresetMaps,
    enabled,
    staleTime: ADMIN_DATA_STALE_MS,
  });
}

function usePresetMap(mapId: number | null) {
  const enabled = mapId != null && isValidPositiveInt(mapId);
  return useQuery({
    queryKey: presetMapKey(mapId ?? 0),
    queryFn: () => fetchPresetMap(mapId!),
    enabled,
    staleTime: Infinity,
  });
}

export function useMapCount() {
  const result = useAllMaps();
  return { ...result, data: result.data ? BigInt(result.data.length) : undefined };
}

/** Every preset map as [ids, blocked positions[], scoring positions[]] (the old getAllPresetMaps tuple). */
export function useGetAllPresetMaps() {
  const result = useAllMaps();
  const data = useMemo(() => {
    if (!result.data) return undefined;
    return [
      result.data.map((m) => BigInt(m.id)),
      result.data.map((m) => m.blockedPositions),
      result.data.map((m) => m.scoringPositions),
    ] as const;
  }, [result.data]);
  return { ...result, data };
}

/** Every preset map, decoded (blocked, impassable, scoring, zones, mode). */
export function useAllPresetMapsDecoded() {
  return useAllMaps();
}

export function useGetPresetMap(mapId: number) {
  const r = usePresetMap(mapId);
  return { ...r, data: r.data?.blockedPositions };
}

export function useGetPresetScoringMap(mapId: number) {
  const r = usePresetMap(mapId);
  return { ...r, data: r.data?.scoringPositions };
}

/** A preset map's impassable (movement-blocking) tiles. */
export function useGetPresetMapImpassable(mapId: number) {
  const r = usePresetMap(mapId);
  return { ...r, data: r.data?.impassablePositions };
}

/**
 * A preset map's terrain and scoring tiles in readGameMapState's shape: a
 * game starts on an exact copy of its preset map, so a battle can draw this
 * while its own map state loads, and the Operations map preloads it for the
 * missions coming up.
 */
export function usePresetMapState(mapId: number | null) {
  const { data, isLoading } = usePresetMap(mapId);
  const state = useMemo(
    () =>
      data
        ? {
            blockedPositions: data.blockedPositions as unknown[],
            scoringPositions: data.scoringPositions as unknown[],
            impassablePositions: data.impassablePositions as unknown[],
          }
        : undefined,
    [data],
  );
  return { data: state, isLoading: mapId != null && isLoading };
}

export function useMapExists(mapId: number) {
  const r = usePresetMap(mapId);
  return { ...r, data: r.data === undefined ? undefined : r.data != null };
}

function useByMapId<T>(mapIds: number[], pick: (m: DecodedPresetMap) => T) {
  const { data, isLoading, error } = useAllMaps(mapIds.length > 0);
  const byMapId = useMemo(() => {
    const out = new Map<number, T>();
    const wanted = new Set(mapIds);
    for (const m of data ?? []) if (wanted.has(m.id)) out.set(m.id, pick(m));
    return out;
    // pick is a stable module-level accessor at every call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mapIds]);
  return { byMapId, isLoading, error };
}

const pickMode = (m: DecodedPresetMap) => m.mode;
const pickImpassable = (m: DecodedPresetMap) => m.impassablePositions;
const pickCreatorZone = (m: DecodedPresetMap) => m.creatorZone;
const pickJoinerZone = (m: DecodedPresetMap) => m.joinerZone;

export function useMapModes(mapIds: number[]) {
  const { byMapId, isLoading, error } = useByMapId<MapMode>(mapIds, pickMode);
  return { modeByMapId: byMapId, isLoading, error };
}

/**
 * Map names (web3). Not stored onchain: they come from
 * app/data/content/mapNames.ts — no RPC.
 */
export function useMapNames(mapIds: number[]) {
  const idsKey = mapIds.join(",");
  const nameByMapId = useMemo(() => {
    const map = new Map<number, string>();
    if (idsKey.length === 0) return map;
    idsKey.split(",").map(Number).forEach((id) => {
      const name = STATIC_MAP_NAMES[id];
      if (name) map.set(id, name);
    });
    return map;
  }, [idsKey]);
  return { nameByMapId, isLoading: false, isFetched: true, error: null, refetch: async () => undefined };
}

/** `Map #<id>` alone, or `Map #<id> — <name>` when the map has one. */
export function mapTitleLabel(id: number, nameByMapId: Map<number, string>): string {
  const name = nameByMapId.get(id);
  return name ? `Map #${id} — ${name}` : `Map #${id}`;
}

export function useMapsImpassablePositions(mapIds: number[]) {
  const { byMapId, isLoading, error } = useByMapId<MapPos[]>(mapIds, pickImpassable);
  return { impassableByMapId: byMapId, isLoading, error };
}

/** A map's custom creator-side deployment-zone tiles; `[]` means the engine default column band. */
export function useCreatorZonePositions(mapId: number) {
  const r = usePresetMap(mapId);
  return { ...r, data: r.data?.creatorZone };
}

/** A map's custom joiner-side deployment-zone tiles; `[]` means the engine default column band. */
export function useJoinerZonePositions(mapId: number) {
  const r = usePresetMap(mapId);
  return { ...r, data: r.data?.joinerZone };
}

export function useMapsCreatorZonePositions(mapIds: number[]) {
  const { byMapId, isLoading, error } = useByMapId<MapPos[]>(mapIds, pickCreatorZone);
  return { creatorZoneByMapId: byMapId, isLoading, error };
}

export function useMapsJoinerZonePositions(mapIds: number[]) {
  const { byMapId, isLoading, error } = useByMapId<MapPos[]>(mapIds, pickJoinerZone);
  return { joinerZoneByMapId: byMapId, isLoading, error };
}

/** A live game's own map (terrain plus the scoring tiles still in play), in readGameMapState's shape. */
export function gameMapKey(gameId: number) {
  return ["near-game-map", gameId] as const;
}

/** A game's own map (its copy of the preset, with live edits and collected crystals). */
export function toGameMapState(g: GameState) {
  return {
    blockedPositions: bitmapToPositions(g.map.blocked),
    scoringPositions: toScoringPositions(g.map.scoring),
    impassablePositions: bitmapToPositions(g.map.impassable),
  };
}

/**
 * A game's map. Read once, then kept current by every board refetch
 * (useGetGame writes the map from the same get_game), so a live map edit
 * (game_map_edited) shows with the next version change.
 */
export function useGetGameMapState(gameId: number) {
  return useQuery({
    queryKey: gameMapKey(gameId),
    queryFn: async () => {
      const g = await viewGame("get_game", { game_id: String(gameId) });
      return g ? toGameMapState(g) : null;
    },
    enabled: gameId > 0,
    staleTime: Infinity,
  });
}
