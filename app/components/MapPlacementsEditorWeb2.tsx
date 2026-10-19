"use client";

import React, { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { apiMutate } from "../lib/apiMutate";
import { MapDisplayWeb2 } from "./MapDisplayWeb2";
import { ShipImageWeb2 } from "./ShipImageWeb2";
import ShipCard from "./ShipCard";
import { toShipCardDataWeb2 } from "../utils/toShipCardData";
import { aiConfigToPreviewShipWeb2, type AIShipConfigWeb2 } from "../utils/aiShipConfigWeb2";
import { calculateAttributesFromContractsWeb2 } from "../utils/shipAttributesCalculatorWeb2";
import { MapPlacementsEditorCore, type PlacementRosterEntry } from "./MapPlacementsEditorCore";
import { useMapWeb2 } from "../hooks/useMapWeb2";
import { GRID_DIMENSIONS } from "../types/types";

interface AIMapPlacementWeb2 {
  id: number;
  row: number;
  col: number;
  configId: number;
}

// A soft client-side cap on encounter design (web3 reads it from the
// contract, falling back to the same 8).
const MAX_PLACEMENTS_PER_MAP = 8;

/** Web2's enemy-placement editor: placements through the admin API (see MapPlacementsEditorCore). */
export function MapPlacementsEditorWeb2({
  mapId,
  configs,
  startOpen = false,
  onClose,
}: {
  mapId: number;
  configs: AIShipConfigWeb2[];
  startOpen?: boolean;
  onClose?: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: placementsData } = useQuery({
    queryKey: ["ai-map-placements", mapId],
    queryFn: () => apiFetch<AIMapPlacementWeb2[]>(`/api/admin/ai-map-placements?mapId=${mapId}`),
  });

  const { joinerZone, isLoading: isMapLoading } = useMapWeb2(mapId, GRID_DIMENSIONS.WIDTH, GRID_DIMENSIONS.HEIGHT);

  const configById = useMemo(() => new Map(configs.map((c) => [c.id, c])), [configs]);

  // AI configs aren't real ships, so their stats are computed locally from
  // equipment/traits (as for tutorial ships).
  const roster = useMemo(
    (): PlacementRosterEntry[] =>
      configs.map((c) => {
        const ship = aiConfigToPreviewShipWeb2(c);
        const attributes = calculateAttributesFromContractsWeb2(ship);
        return {
          id: c.id,
          variant: c.traits.variant,
          cost: ship.shipData.cost,
          renderCard: (onPick) => (
            <ShipCard
              ship={toShipCardDataWeb2(ship)}
              shipImage={<ShipImageWeb2 ship={ship} className="h-full w-full" showLoadingState={false} />}
              isStarred={false}
              onToggleStar={() => {}}
              isSelected={false}
              onToggleSelection={onPick}
              onRecycleClick={() => {}}
              showInGameProperties
              inGameAttributes={attributes}
              selectionMode
              hideRecycle
              hideCheckbox
              onCardClick={onPick}
              canSelect
            />
          ),
        };
      }),
    [configs],
  );

  return (
    <MapPlacementsEditorCore
      mapId={mapId}
      roster={roster}
      savedPlacements={placementsData}
      joinerZone={isMapLoading ? undefined : joinerZone}
      maxPlacements={MAX_PLACEMENTS_PER_MAP}
      startOpen={startOpen}
      onClose={onClose}
      onSave={async (placements) => {
        await apiMutate("/api/admin/ai-map-placements", "POST", { mapId, placements });
        await queryClient.invalidateQueries({ queryKey: ["ai-map-placements", mapId] });
        return "Enemy fleet placements saved.";
      }}
      renderMap={(map) => (
        <MapDisplayWeb2
          mapId={mapId}
          className="w-full h-full"
          showPlayerOverlay
          isCreator={false}
          isCreatorViewer={false}
          showDeployZoneLabel
          ships={map.placements
            .map((p) => {
              const config = configById.get(p.configId);
              return config ? aiConfigToPreviewShipWeb2(config, p.shipId) : null;
            })
            .filter((s): s is NonNullable<typeof s> => s !== null)}
          shipPositions={map.placements.map((p) => ({ shipId: p.shipId, row: p.row, col: p.col }))}
          selectedShipId={map.selectedShipId}
          onShipSelect={map.onShipSelect}
          onShipMove={map.onShipMove}
          allowSelection
          selectableShipIds={map.selectableShipIds}
          pendingPlacementShipId={map.pendingPlacementShipId}
          onDragOver={map.onDragOver}
          onDrop={map.onDrop}
          dragOverPosition={map.dragOverPosition}
        />
      )}
    />
  );
}
