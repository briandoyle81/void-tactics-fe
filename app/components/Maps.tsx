"use client";

import React, { useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAllPresetMaps,
  useMapModes,
  useMapNames,
  mapTitleLabel,
  useMapsImpassablePositions,
  useMapsCreatorZonePositions,
  useMapsJoinerZonePositions,
  useMapsContract,
} from "../hooks/useMapsContract";
import { useGetAllMapPlacements } from "../hooks/useAIEncountersContract";
import { useAllCampaignNodes } from "../hooks/useNodeMap";
import { useAllRoguelikeNodes } from "../hooks/useRoguelikeNodeMap";
import { mapProblems } from "../utils/mapProblems";
import { MapEditScreen } from "./MapEditScreen";
import { MapPreviewCard } from "./MapPreviewCard";
import { MapsListShell } from "./MapsListShell";
import { PresetMap, MapMode } from "../types/types";
import { VOID_TACTICS_CHAIN_CHANGED_EVENT } from "../config/networks";
import { MAP_ADMIN_ADDRESS } from "../config/alpha";
import { setUrlParams, useUrlParam } from "../utils/urlState";

export default function Maps() {
  const { address } = useAccount();
  const { data: allMapsData, refetch: refetchMaps } = useGetAllPresetMaps();
  const queryClient = useQueryClient();
  const { address: mapsAddress } = useMapsContract();
  // The editor is in the URL (`map=<id>` or `map=new`, see urlState.ts):
  // refresh keeps it open, Back closes it.
  const mapParam = useUrlParam("map");
  const showEditor = mapParam != null;
  const editingMapId = mapParam && /^\d+$/.test(mapParam) ? Number(mapParam) : undefined;

  const maps = useMemo((): PresetMap[] => {
    if (!allMapsData || !Array.isArray(allMapsData) || allMapsData.length !== 3) {
      return [];
    }
    const [mapIds, blockedPositionsArray, scoringPositionsArray] = allMapsData;
    return mapIds.map((mapId: bigint, index: number) => ({
      id: Number(mapId),
      blockedPositions: blockedPositionsArray[index] || [],
      scoringPositions: scoringPositionsArray[index] || [],
    }));
  }, [allMapsData]);

  const { modeByMapId } = useMapModes(maps.map((m) => m.id));
  const { nameByMapId } = useMapNames(maps.map((m) => m.id));
  const { impassableByMapId } = useMapsImpassablePositions(maps.map((m) => m.id));
  const { creatorZoneByMapId } = useMapsCreatorZonePositions(maps.map((m) => m.id));
  const { joinerZoneByMapId } = useMapsJoinerZonePositions(maps.map((m) => m.id));

  // What each card flags opposite its key: duplicate terrain, missing fleets,
  // unused PvE maps. Maps are never hidden from this list.
  const mapIds = useMemo(() => maps.map((m) => m.id), [maps]);
  const { data: placements, isLoading: placementsLoading } = useGetAllMapPlacements(mapIds);
  const { data: campaignNodes, isLoading: campaignNodesLoading } = useAllCampaignNodes();
  const { nodes: roguelikeNodes, isLoading: roguelikeNodesLoading } = useAllRoguelikeNodes();
  const problemsByMapId = useMemo(() => {
    const usageReady = !placementsLoading && !campaignNodesLoading && !roguelikeNodesLoading;
    const missionCountByMapId = new Map<number, number>();
    const countMission = (mapId: number) => missionCountByMapId.set(mapId, (missionCountByMapId.get(mapId) ?? 0) + 1);
    campaignNodes.forEach((n) => countMission(Number(n.mapId)));
    roguelikeNodes.forEach((n) => {
      if (Number(n.kind) === 0) countMission(Number(n.mapId));
    });
    return mapProblems(
      maps.map((m) => ({
        id: m.id,
        mode: modeByMapId.get(m.id),
        blockedPositions: m.blockedPositions,
        impassablePositions: impassableByMapId.get(m.id),
        scoringPositions: m.scoringPositions,
      })),
      usageReady
        ? {
            fleetSizeByMapId: new Map(placements.map((p) => [p.mapId, p.positions.length])),
            missionCountByMapId,
          }
        : undefined,
    );
  }, [maps, modeByMapId, impassableByMapId, placements, placementsLoading, campaignNodes, campaignNodesLoading, roguelikeNodes, roguelikeNodesLoading]);

  const canCreateMaps =
    address?.toLowerCase() === MAP_ADMIN_ADDRESS.toLowerCase();

  const editingMap = useMemo(
    () => maps.find((m) => m.id === editingMapId),
    [maps, editingMapId],
  );

  useEffect(() => {
    const onChainChanged = () => {
      setUrlParams({ map: null }, { replace: true });
    };
    window.addEventListener(VOID_TACTICS_CHAIN_CHANGED_EVENT, onChainChanged);
    return () => {
      window.removeEventListener(VOID_TACTICS_CHAIN_CHANGED_EVENT, onChainChanged);
    };
  }, []);

  const handleCreateMap = () => {
    setUrlParams({ map: "new" });
  };

  const handleEditMap = (mapId: number) => {
    // Check if user is authorized to edit maps
    if (!canCreateMaps) {
      alert(
        "You are not authorized to edit maps. Only authorized addresses can edit maps."
      );
      return;
    }
    setUrlParams({ map: mapId });
  };

  const handleEditorSave = () => {
    setUrlParams({ map: null }, { back: true });
    // Refetch every Maps contract read (list, modes, impassable tiles,
    // zones). Was a full page reload, which dropped the wallet session for
    // a while and showed the Ops Console as signed out.
    const mapsKey = mapsAddress.toLowerCase();
    void queryClient.invalidateQueries({
      predicate: (query) =>
        JSON.stringify(query.queryKey, (_key, value) => (typeof value === "bigint" ? value.toString() : value))
          .toLowerCase()
          .includes(mapsKey),
    });
  };

  const handleEditorCancel = () => {
    setUrlParams({ map: null }, { back: true });
  };

  if (showEditor) {
    return (
      <MapEditScreen
        mapId={editingMapId}
        initialBlockedPositions={editingMap?.blockedPositions}
        initialScoringPositions={editingMap?.scoringPositions}
        onSaved={() => {
          void refetchMaps();
          handleEditorSave();
        }}
        onCancel={handleEditorCancel}
      />
    );
  }

  return (
    <div className="space-y-4">
      <MapsListShell
        canCreateMaps={canCreateMaps}
        onCreateMap={handleCreateMap}
        totalMaps={maps.length}
        restrictedMessage="[!] Map creation is currently restricted to authorized addresses only"
        isEmpty={maps.length === 0}
      >
        {maps.map((map) => (
          <MapPreviewCard
            key={map.id}
            map={{
              id: map.id,
              titleLabel: mapTitleLabel(map.id, nameByMapId),
              blockedPositions: map.blockedPositions,
              scoringPositions: map.scoringPositions,
              impassablePositions: impassableByMapId.get(map.id),
              creatorZonePositions: creatorZoneByMapId.get(map.id),
              joinerZonePositions: joinerZoneByMapId.get(map.id),
            }}
            modeLabel={MapMode[modeByMapId.get(map.id) ?? MapMode.Both]}
            problems={problemsByMapId.get(map.id)}
            onEdit={canCreateMaps ? () => handleEditMap(map.id) : undefined}
          />
        ))}
      </MapsListShell>
    </div>
  );
}
