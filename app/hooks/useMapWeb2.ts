"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { buildMapGridsFromContractMap, type MapGrids } from "../utils/mapGridUtils";
import { parseZoneTiles, type ZoneTile } from "../utils/deploymentZone";

interface MapTilesResponse {
  gridWidth: number;
  gridHeight: number;
  blockedTiles: Array<{ row: number; col: number }>;
  impassableTiles: Array<{ row: number; col: number }>;
  scoringTiles: Array<{ row: number; col: number; points: number; onlyOnce: boolean }>;
  creatorZone?: unknown;
  joinerZone?: unknown;
}

const NO_ZONE: ZoneTile[] = [];

/** A map's tiles: one query per map id, shared by battles and the Operations map's preloading. */
function mapWeb2Query(mapId: number) {
  return {
    queryKey: ["mapWeb2", mapId],
    queryFn: () => apiFetch<MapTilesResponse>(`/api/maps/${mapId}`),
    enabled: mapId > 0,
    staleTime: Infinity, // maps never change
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  };
}

/** Loads these maps into the cache ahead of their battles (the Operations map's upcoming missions). */
export function usePrefetchMapsWeb2(mapIds: readonly number[]) {
  useQueries({ queries: mapIds.map((id) => ({ ...mapWeb2Query(id), notifyOnChangeProps: [] as const })) });
}

export function useMapWeb2(mapId: number, gridWidth: number, gridHeight: number) {
  const { data, isLoading, error } = useQuery({
    ...mapWeb2Query(mapId),
    notifyOnChangeProps: ["data", "error"],
  });

  const grids = useMemo((): MapGrids => {
    // GameGridCell indexes these as fully gridHeight x gridWidth arrays
    // unconditionally (no bounds guards) — fall back to an empty-but-
    // correctly-sized grid while the map query is loading (or hasn't
    // started, e.g. mapId not yet known) instead of `[]`.
    if (!data) {
      return {
        blockedGrid: Array.from({ length: gridHeight }, () => Array(gridWidth).fill(false)),
        scoringGrid: Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0)),
        onlyOnceGrid: Array.from({ length: gridHeight }, () => Array(gridWidth).fill(false)),
        impassableGrid: Array.from({ length: gridHeight }, () => Array(gridWidth).fill(false)),
      };
    }
    return buildMapGridsFromContractMap(
      data.blockedTiles,
      data.scoringTiles,
      gridWidth,
      gridHeight,
      data.impassableTiles,
    );
  }, [data, gridWidth, gridHeight]);

  // Custom deployment zones (empty = that side uses the default columns).
  const creatorZone = useMemo(() => parseZoneTiles(data?.creatorZone) ?? NO_ZONE, [data]);
  const joinerZone = useMemo(() => parseZoneTiles(data?.joinerZone) ?? NO_ZONE, [data]);

  return { ...grids, creatorZone, joinerZone, isLoading, error };
}
