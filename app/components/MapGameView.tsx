"use client";

import React from "react";
import { GRID_DIMENSIONS } from "../types/types";
import type { GridShip, GridShipPosition } from "../types/gridDisplay";
import type { MapGrids } from "../utils/mapGridUtils";
import { mapTileArtFor } from "../utils/mapTileArt";
import { GameGrid } from "./GameGrid";
import { GameBoardLayout } from "./GameBoardLayout";

// A map drawn exactly as a battle draws it (the real GameGrid inside the
// real GameBoardLayout), with no ships. The map editor's "Game view"
// (MapEditor.tsx) shows this in place of the editing grid, with the map's
// tile art (app/utils/mapTileArt.ts). View only.

const GRID_WIDTH = GRID_DIMENSIONS.WIDTH;
const GRID_HEIGHT = GRID_DIMENSIONS.HEIGHT;

const EMPTY_GRID: (GridShipPosition | null)[][] = Array.from({ length: GRID_HEIGHT }, () =>
  Array<GridShipPosition | null>(GRID_WIDTH).fill(null),
);
const EMPTY_SHIP_MAP = new Map<number, GridShip>();
const EMPTY_CELLS: Array<{ row: number; col: number }> = [];
const EMPTY_TARGETS: Array<{ shipId: number; position: { row: number; col: number } }> = [];
const EMPTY_ID_SET = new Set<number>();
const NO_DAMAGE = { reducedDamage: 0, willKill: false, reactorCritical: false };
const noop = () => {};
const notOwned = () => false;
const noDamage = () => NO_DAMAGE;
const noAttributes = () => null;
const noShipCard = () => null;

export function MapGameView({
  mapId,
  blockedGrid,
  impassableGrid,
  scoringGrid,
  onlyOnceGrid,
}: MapGrids & { mapId?: number }) {
  return (
    <GameBoardLayout isCurrentPlayerTurn={true}>
      <div className="relative w-full [contain:layout]" style={{ aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}` }}>
        <div className="absolute inset-0 min-h-0 overflow-hidden">
          <GameGrid
            grid={EMPTY_GRID}
            shipMap={EMPTY_SHIP_MAP}
            selectedShipId={null}
            previewPosition={null}
            targetShipId={null}
            selectedWeaponType="weapon"
            draggedShipId={null}
            dragOverCell={null}
            movementRange={EMPTY_CELLS}
            shootingRange={EMPTY_CELLS}
            validTargets={EMPTY_TARGETS}
            assistableTargets={EMPTY_TARGETS}
            assistableTargetsFromStart={EMPTY_TARGETS}
            dragShootingRange={EMPTY_CELLS}
            dragValidTargets={EMPTY_TARGETS}
            isCurrentPlayerTurn={true}
            isShipOwnedByCurrentPlayer={notOwned}
            movedShipIdsSet={EMPTY_ID_SET}
            specialType={0}
            blockedGrid={blockedGrid}
            impassableGrid={impassableGrid}
            tileArt={mapTileArtFor(mapId)}
            scoringGrid={scoringGrid}
            onlyOnceGrid={onlyOnceGrid}
            calculateDamage={noDamage}
            getShipAttributes={noAttributes}
            disableTooltips={true}
            address={undefined}
            currentTurn=""
            setSelectedShipId={noop}
            setPreviewPosition={noop}
            setTargetShipId={noop}
            setSelectedWeaponType={noop}
            setDraggedShipId={noop}
            setDragOverCell={noop}
            renderShipCard={noShipCard}
          />
        </div>
      </div>
    </GameBoardLayout>
  );
}
