"use client";

import React, { useMemo } from "react";
import { toast } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";
import { useWeb2Admin } from "../hooks/useWeb2Admin";
import { MapEditScreenWeb2 } from "./MapEditScreenWeb2";
import { MapPreviewCard } from "./MapPreviewCard";
import { MapsListShell } from "./MapsListShell";
import { MapPosition, ScoringPosition, MapMode } from "../types/types";
import { parseZoneTiles } from "../utils/deploymentZone";
import { mapProblems } from "../utils/mapProblems";
import { setUrlParams, useUrlParam } from "../utils/urlState";

export interface Web2Map {
  id: number;
  name: string;
  gridWidth: number;
  gridHeight: number;
  blockedTiles: MapPosition[];
  impassableTiles: MapPosition[];
  scoringTiles: ScoringPosition[];
  creatorZone?: unknown;
  joinerZone?: unknown;
  mode: MapMode;
}

// Web2-mode counterpart to `Maps.tsx` — same layout, list/preview cards, and
// grid editor (shared via `MapEditor.tsx`'s data-source-agnostic props), but
// backed by `Map` rows in Postgres via `/api/maps` instead of the Maps
// contract, and gated on `useWeb2Admin()` (WEB2_ADMIN_EMAILS) instead of
// `MAP_ADMIN_ADDRESS`.
export default function MapsWeb2() {
  const canCreateMaps = useWeb2Admin();
  const { data: maps = [], refetch } = useQuery({
    queryKey: ["maps", "web2"],
    queryFn: () => apiFetch<Web2Map[]>("/api/maps"),
  });
  // What each card flags opposite its key (same as Maps.tsx). Fleets and
  // missions come from the admin routes, so only admins get those flags.
  const { data: placements } = useQuery({
    queryKey: ["ai-map-placements", "all"],
    queryFn: () => apiFetch<{ mapId: number }[]>("/api/admin/ai-map-placements"),
    enabled: canCreateMaps,
    staleTime: ADMIN_DATA_STALE_MS,
  });
  const { data: campaignNodes } = useQuery({
    queryKey: ["admin", "campaign-nodes", "all"],
    queryFn: () => apiFetch<{ mapId: number }[]>("/api/admin/campaign/nodes"),
    enabled: canCreateMaps,
    staleTime: ADMIN_DATA_STALE_MS,
  });
  const { data: roguelikeNodes } = useQuery({
    queryKey: ["admin", "roguelike-nodes", "all"],
    queryFn: () => apiFetch<{ mapId: number | null; kind: number }[]>("/api/admin/roguelike/nodes"),
    enabled: canCreateMaps,
    staleTime: ADMIN_DATA_STALE_MS,
  });
  const problemsByMapId = useMemo(() => {
    const usage =
      placements && campaignNodes && roguelikeNodes
        ? (() => {
            const fleetSizeByMapId = new Map<number, number>();
            placements.forEach((p) => fleetSizeByMapId.set(p.mapId, (fleetSizeByMapId.get(p.mapId) ?? 0) + 1));
            const missionCountByMapId = new Map<number, number>();
            const countMission = (mapId: number) =>
              missionCountByMapId.set(mapId, (missionCountByMapId.get(mapId) ?? 0) + 1);
            campaignNodes.forEach((n) => countMission(n.mapId));
            roguelikeNodes.forEach((n) => {
              if (n.kind === 0 && n.mapId != null) countMission(n.mapId);
            });
            return { fleetSizeByMapId, missionCountByMapId };
          })()
        : undefined;
    return mapProblems(
      maps.map((m) => ({
        id: m.id,
        mode: m.mode,
        blockedPositions: m.blockedTiles,
        impassablePositions: m.impassableTiles,
        scoringPositions: m.scoringTiles,
      })),
      usage,
    );
  }, [maps, placements, campaignNodes, roguelikeNodes]);
  // The editor is in the URL (`map=<id>` or `map=new`, see urlState.ts):
  // refresh keeps it open, Back closes it.
  const mapParam = useUrlParam("map");
  const showEditor = mapParam != null;
  const editingMapId = mapParam && /^\d+$/.test(mapParam) ? Number(mapParam) : undefined;

  const editingMap = useMemo(
    () => maps.find((m) => m.id === editingMapId),
    [maps, editingMapId],
  );

  const handleCreateMap = () => {
    setUrlParams({ map: "new" });
  };

  const handleEditMap = (map: Web2Map) => {
    if (!canCreateMaps) {
      toast.error("You are not authorized to edit maps.");
      return;
    }
    setUrlParams({ map: map.id });
  };

  const handleEditorSave = () => {
    setUrlParams({ map: null }, { back: true });
    refetch();
  };

  const handleEditorCancel = () => {
    setUrlParams({ map: null }, { back: true });
  };

  if (showEditor) {
    return (
      <MapEditScreenWeb2
        key={editingMapId ?? "new"}
        map={editingMap}
        onSaved={handleEditorSave}
        onCancel={handleEditorCancel}
        onMapChanged={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <MapsListShell
        canCreateMaps={canCreateMaps}
        onCreateMap={handleCreateMap}
        totalMaps={maps.length}
        restrictedMessage="[!] Map creation is currently restricted to authorized accounts only"
        isEmpty={maps.length === 0}
      >
        {maps.map((map) => (
          <MapPreviewCard
            key={map.id}
            map={{
              id: map.id,
              titleLabel: `Map #${map.id} — ${map.name}`,
              blockedPositions: map.blockedTiles,
              scoringPositions: map.scoringTiles,
              impassablePositions: map.impassableTiles,
              creatorZonePositions: parseZoneTiles(map.creatorZone) ?? [],
              joinerZonePositions: parseZoneTiles(map.joinerZone) ?? [],
            }}
            modeLabel={MapMode[map.mode]}
            problems={problemsByMapId.get(map.id)}
            onEdit={canCreateMaps ? () => handleEditMap(map) : undefined}
          />
        ))}
      </MapsListShell>
    </div>
  );
}
