"use client";

import React, { useMemo } from "react";
import { AIShipConfig, MapPosition } from "../types/types";
import { useAIEncountersAdmin } from "../hooks/useAIEncountersAdmin";
import { useGetMapPlacements, useMaxPlacementsPerMap } from "../hooks/useAIEncountersContract";
import { MapDisplay } from "./MapDisplay";
import { ShipImage } from "./ShipImage";
import ShipCard from "./ShipCard";
import { toShipCardData } from "../utils/toShipCardData";
import { aiConfigToPreviewShip } from "../utils/aiShipConfig";
import { calculateAttributesFromContracts } from "../utils/shipAttributesCalculator";
import { MapPlacementsEditorCore, type PlacementRosterEntry } from "./MapPlacementsEditorCore";

/**
 * Web3's enemy-placement editor: placements read from AIEncounters and saved
 * with setMapPlacements (see MapPlacementsEditorCore). Ids become bigint only
 * at the contract calls and MapDisplay.
 */
export function MapPlacementsEditor({
  mapId,
  configs,
  startOpen = false,
  onClose,
}: {
  mapId: bigint;
  configs: AIShipConfig[];
  startOpen?: boolean;
  onClose?: () => void;
}) {
  const { setMapPlacements } = useAIEncountersAdmin();
  const { data: placementsData, refetch } = useGetMapPlacements(mapId);
  const { data: maxPlacementsData } = useMaxPlacementsPerMap();

  const savedPlacements = useMemo(
    () =>
      placementsData
        ? placementsData.positions.map((p, i) => ({
            configId: Number(placementsData.configIds[i]),
            row: p.row,
            col: p.col,
          }))
        : undefined,
    [placementsData],
  );

  const configById = useMemo(() => new Map(configs.map((c) => [Number(c.id), c])), [configs]);

  // AI configs aren't real ships, so their stats are computed locally from
  // equipment/traits (as for tutorial ships).
  const roster = useMemo(
    (): PlacementRosterEntry[] =>
      configs.map((c) => {
        const ship = aiConfigToPreviewShip(c);
        const attributes = calculateAttributesFromContracts(ship);
        return {
          id: Number(c.id),
          variant: Number(c.traits.variant),
          cost: Number(ship.shipData.cost),
          renderCard: (onPick) => (
            <ShipCard
              ship={toShipCardData(ship)}
              shipImage={<ShipImage ship={ship} className="h-full w-full" showLoadingState={false} />}
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
      mapId={Number(mapId)}
      roster={roster}
      savedPlacements={savedPlacements}
      maxPlacements={Number(maxPlacementsData ?? 8n)}
      startOpen={startOpen}
      onClose={onClose}
      onSave={async (placements) => {
        const positions: MapPosition[] = placements.map((p) => ({ row: p.row, col: p.col }));
        const hash = await setMapPlacements(
          mapId,
          positions,
          placements.map((p) => BigInt(p.configId)),
        );
        await refetch();
        return `Enemy fleet placements saved. (tx: ${hash.slice(0, 10)}…)`;
      }}
      renderMap={(map) => (
        <MapDisplay
          mapId={Number(mapId)}
          className="w-full h-full"
          showPlayerOverlay
          isCreator={false}
          isCreatorViewer={false}
          showDeployZoneLabel
          ships={map.placements
            .map((p) => {
              const config = configById.get(p.configId);
              return config ? aiConfigToPreviewShip(config, BigInt(p.shipId)) : null;
            })
            .filter((s): s is NonNullable<typeof s> => s !== null)}
          shipPositions={map.placements.map((p) => ({ shipId: BigInt(p.shipId), row: p.row, col: p.col }))}
          selectedShipId={map.selectedShipId != null ? BigInt(map.selectedShipId) : null}
          onShipSelect={(id) => map.onShipSelect(Number(id))}
          onShipMove={(id, row, col) => map.onShipMove(Number(id), row, col)}
          allowSelection
          selectableShipIds={map.selectableShipIds.map((id) => BigInt(id))}
          pendingPlacementShipId={map.pendingPlacementShipId != null ? BigInt(map.pendingPlacementShipId) : null}
          onDragOver={map.onDragOver}
          onDrop={map.onDrop}
          dragOverPosition={map.dragOverPosition}
        />
      )}
    />
  );
}
