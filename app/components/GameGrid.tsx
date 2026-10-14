"use client";

import React, { useRef } from "react";
import { Attributes, ActionType } from "../types/types";
import { GridShip, GridShipPosition } from "../types/gridDisplay";
import { useGridCellSets } from "../hooks/useGridCellSets";
import { useGridPanZoom } from "../hooks/useGridPanZoom";
import { useGridEffectPreviews } from "../hooks/useGridEffectPreviews";
import { computeConfirmWidgetAnchor, selectedShipHasEffectLabel } from "../utils/gameGridRanges";
import { GameGridCell } from "./GameGridCell";
import { GameGridOverlays, GameGridMoveArrow } from "./GameGridOverlays";
import { GameGridTooltip, GameGridTooltipHoveredCell } from "./GameGridTooltip";
import { GameGridTileTooltip } from "./GameGridTileTooltip";
import { GameGridWeaponSelector } from "./GameGridWeaponSelector";
import { GameGridConfirmWidget } from "./GameGridConfirmWidget";
import { DestHoverProvider, useGridHoveredCell, useSetGridDestHoveredTile, useSetGridHoveredCell } from "./GridHover";
import { GameGridDestHoverRange } from "./GameGridDestHoverRange";

const EMPTY_SHIP_ID_SET: Set<number> = new Set();
const EMPTY_RANGE_CELLS: Array<{ row: number; col: number }> = [];
const EMPTY_TARGET_REFS: Array<{
  shipId: number;
  position: { row: number; col: number };
}> = [];
const NOOP_CONFIRM = () => {};

type SubmittedProposal = {
  selectedShipId: number;
  previewPosition: { row: number; col: number } | null;
  targetShipId: number | null;
  retreatPrepShipId: number | null;
  movementRange: Array<{ row: number; col: number }>;
};

/** Viewport bounds for a grid cell (fixed tooltip placement vs the moused tile). */
export function measureGridCellViewportBounds(
  layoutRoot: HTMLElement | null,
  row: number,
  col: number,
  fallback: {
    gridContainerViewportLeft: number;
    gridContainerViewportTop: number;
    originX: number;
    originY: number;
    cellWidth: number;
    cellHeight: number;
  },
): { left: number; top: number; right: number; bottom: number } {
  const el = layoutRoot?.querySelector(
    `[data-grid-row="${row}"][data-grid-col="${col}"]`,
  ) as HTMLElement | null;
  if (el) {
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    };
  }
  const left =
    fallback.gridContainerViewportLeft +
    fallback.originX +
    col * fallback.cellWidth;
  const top =
    fallback.gridContainerViewportTop +
    fallback.originY +
    row * fallback.cellHeight;
  return {
    left,
    top,
    right: left + fallback.cellWidth,
    bottom: top + fallback.cellHeight,
  };
}


interface GameGridProps {
  grid: (GridShipPosition | null)[][];
  allShipPositions?: readonly GridShipPosition[];
  shipMap: Map<number, GridShip>;
  selectedShipId: number | null;
  previewPosition: { row: number; col: number } | null;
  targetShipId: number | null;
  selectedWeaponType: "weapon" | "special" | "ram";
  draggedShipId: number | null;
  dragOverCell: { row: number; col: number } | null;
  movementRange: Array<{ row: number; col: number }>;
  shootingRange: Array<{ row: number; col: number }>;
  validTargets: Array<{
    shipId: number;
    position: { row: number; col: number };
  }>;
  labelTargets?: Array<{
    shipId: number;
    position: { row: number; col: number };
  }>; // Optional: when provided (GameDisplay), used for damage labels; otherwise fall back to validTargets
  assistableTargets: Array<{
    shipId: number;
    position: { row: number; col: number };
  }>;
  assistableTargetsFromStart: Array<{
    shipId: number;
    position: { row: number; col: number };
  }>;
  dragShootingRange: Array<{ row: number; col: number }>;
  dragValidTargets: Array<{
    shipId: number;
    position: { row: number; col: number };
  }>;
  isCurrentPlayerTurn: boolean;
  isShipOwnedByCurrentPlayer: (shipId: number) => boolean;
  movedShipIdsSet: Set<number>;
  specialType: number;
  specialRange?: number;
  blockedGrid: boolean[][];
  /** Movement-blocking terrain, independent of blockedGrid's LOS-only blocking. Optional — omitted renders no impassable-terrain overlay. */
  impassableGrid?: boolean[][];
  scoringGrid: number[][];
  onlyOnceGrid: boolean[][];
  calculateDamage: (
    targetShipId: number,
    weaponType?: "weapon" | "special",
    showReducedDamage?: boolean,
    shooterShipIdOverride?: number,
  ) => {
    reducedDamage: number;
    willKill: boolean;
    reactorCritical: boolean;
  };
  getShipAttributes: (shipId: number) => Attributes | null;
  disableTooltips: boolean;
  address: string | undefined;
  currentTurn: string;
  highlightedMovePosition?: { row: number; col: number } | null;
  lastMoveShipId?: number | null;
  lastMoveOldPosition?: { row: number; col: number } | null; // Old position for last move preview
  // New position for the last move (to position). When playing back weapon
  // effects for the last move, the beam should originate from this "to"
  // position rather than the old position.
  lastMoveNewPosition?: { row: number; col: number } | null;
  /** Last mover's to-tile for weapon-effect aiming, even when last-move chrome is hidden. */
  lastMoveResolvedTo?: { shipId: number; row: number; col: number } | null;
  lastMoveActionType?: ActionType | null; // When Retreat, show warp collapse at old position
  lastMoveTargetShipId?: number | null;
  lastMoveIsCurrentPlayer?: boolean | undefined; // true = blue outline, false = red outline
  /** Ramming preview destination tile. */
  rammingPreviewPosition?: { row: number; col: number } | null;
  /** True when the staged move is a ramming move. */
  isRammingMovePreview?: boolean;
  /** See useFactionAbilityConfig.ts — gates the real Ram/Repair targeting flow vs. the legacy auto-ram chains still run. */
  isFactionAbilitySupported?: boolean;
  factionAbilityRange?: number | undefined;
  factionAbilityIsHeal?: boolean;
  factionAbilityStrength?: number;
  /** When set, last-move EMP replay still shows while a ship is selected (e.g. tutorial ship-destruction). */
  showLastMoveEmpReplayWhenSelected?: boolean;
  retreatPrepShipId?: number | null;
  retreatPrepIsCreator?: boolean | null; // For retreat prep flip direction
  /**
   * **Tutorial target**: cells framed with targeting brackets (TutorialTarget)
   * (e.g. select-ship until a player ship is selected; view-enemy until an enemy ship).
   * A click target also gets a ripple and a chevron; an optional `label` (a
   * choice's name, e.g. "Save Ship") is shown with the chevron.
   * Set `hideLabel` for a highlight only (brackets, no ripple or chevron).
   */
  tutorialHighlightCells?: readonly {
    row: number;
    col: number;
    label?: string;
    hideLabel?: boolean;
  }[];
  /**
   * **Tutorial target** on a weapon choice in the confirm widget: that
   * button is framed, with a chevron above it (e.g. EMP once the EMP step's
   * target is chosen).
   */
  tutorialWeaponOption?: "weapon" | "special" | "ram";
  /** Extra clears (e.g. retreat override) after right-click deselect on the grid. */
  onGridRightClickDeselect?: () => void;
  setSelectedShipId: (shipId: number | null) => void;
  setPreviewPosition: (position: { row: number; col: number } | null) => void;
  setTargetShipId: (shipId: number | null) => void;
  setSelectedWeaponType: (type: "weapon" | "special" | "ram") => void;
  setDraggedShipId: (shipId: number | null) => void;
  setDragOverCell: (cell: { row: number; col: number } | null) => void;
  /**
   * Compute shooting range / valid targets from a hovered movement tile
   * without lifting that cell into the match parent (which would recrawl
   * GameDisplay on every pointer move).
   */
  getHoverPreview?: (cell: { row: number; col: number } | null) => {
    shootingRange: Array<{ row: number; col: number }>;
    validTargets: Array<{
      shipId: number;
      position: { row: number; col: number };
    }>;
  };
  showConfirmWidget?: boolean;
  confirmWidgetLabel?: string;
  onConfirmMove?: () => void;
  onCancelMove?: () => void;
  confirmButton?: React.ReactNode;
  /**
   * Ships that a submitted shot will put into SOS. Show live SOS art (not
   * hologram) until chain/server attributes confirm 0 HP.
   */
  optimisticSosShipIds?: Set<number>;
  /** Targets a submitted move is predicted to destroy; held until chain data confirms. */
  optimisticDestroyShipIds?: Set<number>;
  /**
   * True while the current move tx/request is in flight. The board then
   * shows the submitted move's predicted result (from the caller's game
   * state) without the proposal overlays; only the confirm widget stays, at
   * its submitted spot, locked (see GameGrid below).
   */
  isSubmitting?: boolean;
  /** Set by GameGrid while submitting: the proposal the confirm widget stays anchored to. */
  submittedProposal?: SubmittedProposal | null;
  /**
   * Builds the tooltip's ship-card content for the hovered cell. Delegated
   * to the caller because building `ShipCard`'s `ShipCardData`/`shipImage`
   * props from a raw `Ship`/`Web2Ship` is mode-specific. See
   * `GameGridTooltip`.
   */
  renderShipCard: (hoveredCell: GameGridTooltipHoveredCell) => React.ReactNode | null;
}

type HoveredCell = {
  shipId: number;
  row: number;
  col: number;
  isCreator: boolean;
  fromFleet?: boolean;
} | null;

const GameGridCells = React.memo(function GameGridCells({
  grid,
  gridLayoutRef,
  hideDestHologram,
  fleetHoveredShipId,
  shipMap,
  selectedShipId,
  previewPosition,
  targetShipId,
  selectedWeaponType,
  draggedShipId,
  isCurrentPlayerTurn,
  isShipOwnedByCurrentPlayer,
  movedShipIdsSet,
  specialType,
  blockedGrid,
  impassableGrid,
  scoringGrid,
  onlyOnceGrid,
  getShipAttributes,
  address,
  highlightedMovePosition,
  lastMoveShipId,
  lastMoveOldPosition,
  lastMoveNewPosition,
  lastMoveActionType,
  lastMoveTargetShipId,
  lastMoveIsCurrentPlayer,
  isRammingMovePreview,
  isHoldPreviewActive,
  factionAbilityIsHeal,
  isFactionAbilitySupported,
  retreatPrepShipId,
  retreatPrepIsCreator,
  isMyTurn,
  movementTileSet,
  shootingTileSet,
  tutorialHighlightKeySet,
  effectiveDragCell,
  effectiveShootingTileSet,
  effectiveValidTargetIdSet,
  validTargetIdSet,
  assistableTargetIdSet,
  assistableTargetsFromStartIdSet,
  lastMoveActionNum,
  projectedDamageByShipId,
  projectedRepairByShipId,
  destroyPreviewShipIds,
  sosPreviewShipIds,
  optimisticSosShipIds,
  isSubmitting,
  lastDragOverCellRef,
  setSelectedShipId,
  setPreviewPosition,
  setTargetShipId,
  setSelectedWeaponType,
  setHoveredCell,
  setDraggedShipId,
  setDragOverCell,
  setHoveredMoveTile,
}: {
  grid: (GridShipPosition | null)[][];
  gridLayoutRef: React.RefObject<HTMLDivElement | null>;
  hideDestHologram: boolean;
  fleetHoveredShipId: number | null;
  shipMap: Map<number, GridShip>;
  selectedShipId: number | null;
  previewPosition: { row: number; col: number } | null;
  targetShipId: number | null;
  selectedWeaponType: "weapon" | "special" | "ram";
  draggedShipId: number | null;
  isCurrentPlayerTurn: boolean;
  isShipOwnedByCurrentPlayer: (shipId: number) => boolean;
  movedShipIdsSet: Set<number>;
  specialType: number;
  blockedGrid: boolean[][];
  impassableGrid?: boolean[][];
  scoringGrid: number[][];
  onlyOnceGrid: boolean[][];
  getShipAttributes: GameGridProps["getShipAttributes"];
  address: string | undefined;
  highlightedMovePosition?: { row: number; col: number } | null;
  lastMoveShipId?: number | null;
  lastMoveOldPosition?: { row: number; col: number } | null;
  lastMoveNewPosition?: { row: number; col: number } | null;
  lastMoveActionType?: ActionType | null;
  lastMoveTargetShipId?: number | null;
  lastMoveIsCurrentPlayer?: boolean;
  isRammingMovePreview: boolean;
  isHoldPreviewActive: boolean;
  factionAbilityIsHeal: boolean;
  isFactionAbilitySupported: boolean;
  retreatPrepShipId?: number | null;
  retreatPrepIsCreator?: boolean | null;
  isMyTurn: boolean;
  movementTileSet: Set<string>;
  shootingTileSet: Set<string>;
  tutorialHighlightKeySet?: Set<string> | null;
  effectiveDragCell: { row: number; col: number } | null;
  effectiveShootingTileSet: Set<string>;
  effectiveValidTargetIdSet: Set<number>;
  validTargetIdSet: Set<number>;
  assistableTargetIdSet: Set<number>;
  assistableTargetsFromStartIdSet: Set<number>;
  lastMoveActionNum: number;
  projectedDamageByShipId: Map<number, number>;
  projectedRepairByShipId: Map<number, number>;
  destroyPreviewShipIds: Set<number>;
  sosPreviewShipIds: Set<number>;
  optimisticSosShipIds: Set<number>;
  isSubmitting: boolean;
  lastDragOverCellRef: React.RefObject<{ row: number; col: number } | null>;
  setSelectedShipId: (shipId: number | null) => void;
  setPreviewPosition: (position: { row: number; col: number } | null) => void;
  setTargetShipId: (shipId: number | null) => void;
  setSelectedWeaponType: (type: "weapon" | "special" | "ram") => void;
  setHoveredCell: (cell: HoveredCell) => void;
  setDraggedShipId: (shipId: number | null) => void;
  setDragOverCell: (cell: { row: number; col: number } | null) => void;
  setHoveredMoveTile: (cell: { row: number; col: number } | null) => void;
}) {
  const dest = effectiveDragCell ?? previewPosition;
  // Cells read the grid only in click handlers; a ref keeps a new grid
  // (every selection / preview change) from invalidating all 187 cells.
  const gridRef = useRef(grid);
  React.useLayoutEffect(() => {
    gridRef.current = grid;
  }, [grid]);
  return (
    <div
      ref={gridLayoutRef}
      className="relative z-0 grid gap-0 border border-near-black grid-cols-[repeat(17,1fr)] grid-rows-[repeat(11,1fr)] w-full h-full min-h-0 group"
    >
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <GameGridCell
            key={`cell-${rowIndex}-${colIndex}`}
            cell={cell}
            rowIndex={rowIndex}
            colIndex={colIndex}
            gridRef={gridRef}
            shipMap={shipMap}
            selectedShipId={selectedShipId}
            previewPosition={previewPosition}
            targetShipId={targetShipId}
            selectedWeaponType={selectedWeaponType}
            isHoveringThisCellAsValidTarget={
              hideDestHologram &&
              dest !== null &&
              dest.row === rowIndex &&
              dest.col === colIndex
            }
            isFleetHoveredShip={Boolean(
              fleetHoveredShipId != null &&
                cell != null &&
                fleetHoveredShipId === cell.shipId,
            )}
            draggedShipId={draggedShipId}
            isCurrentPlayerTurn={isCurrentPlayerTurn}
            isShipOwnedByCurrentPlayer={isShipOwnedByCurrentPlayer}
            movedShipIdsSet={movedShipIdsSet}
            specialType={specialType}
            blockedGrid={blockedGrid}
            impassableGrid={impassableGrid}
            scoringGrid={scoringGrid}
            onlyOnceGrid={onlyOnceGrid}
            getShipAttributes={getShipAttributes}
            address={address}
            highlightedMovePosition={highlightedMovePosition}
            lastMoveShipId={lastMoveShipId}
            lastMoveOldPosition={lastMoveOldPosition}
            lastMoveNewPosition={lastMoveNewPosition}
            lastMoveActionType={lastMoveActionType}
            lastMoveTargetShipId={lastMoveTargetShipId}
            lastMoveIsCurrentPlayer={lastMoveIsCurrentPlayer}
            isRammingMovePreview={isRammingMovePreview}
            isHoldPreviewActive={isHoldPreviewActive}
            factionAbilityIsHeal={factionAbilityIsHeal}
            isFactionAbilitySupported={isFactionAbilitySupported}
            retreatPrepShipId={retreatPrepShipId}
            retreatPrepIsCreator={retreatPrepIsCreator}
            isMyTurn={isMyTurn}
            movementTileSet={movementTileSet}
            shootingTileSet={shootingTileSet}
            tutorialHighlightKeySet={tutorialHighlightKeySet}
            effectiveDragCell={effectiveDragCell}
            effectiveShootingTileSet={effectiveShootingTileSet}
            effectiveValidTargetIdSet={effectiveValidTargetIdSet}
            validTargetIdSet={validTargetIdSet}
            assistableTargetIdSet={assistableTargetIdSet}
            assistableTargetsFromStartIdSet={assistableTargetsFromStartIdSet}
            lastMoveActionNum={lastMoveActionNum}
            projectedDamageByShipId={projectedDamageByShipId}
            projectedRepairByShipId={projectedRepairByShipId}
            destroyPreviewShipIds={destroyPreviewShipIds}
            sosPreviewShipIds={sosPreviewShipIds}
            optimisticSosShipIds={optimisticSosShipIds}
            isSubmitting={isSubmitting}
            lastDragOverCellRef={lastDragOverCellRef}
            setSelectedShipId={setSelectedShipId}
            setPreviewPosition={setPreviewPosition}
            setTargetShipId={setTargetShipId}
            setSelectedWeaponType={setSelectedWeaponType}
            setHoveredCell={setHoveredCell}
            setDraggedShipId={setDraggedShipId}
            setDragOverCell={setDragOverCell}
            setHoveredMoveTile={setHoveredMoveTile}
          />
        )),
      )}
    </div>
  );
});

const GameGridHoverSurface = React.memo(function GameGridHoverSurface({
  grid,
  gridLayoutRef,
  gridContainerRef,
  shipMap,
  selectedShipId,
  previewPosition,
  targetShipId,
  selectedWeaponType,
  draggedShipId,
  isCurrentPlayerTurn,
  isShipOwnedByCurrentPlayer,
  movedShipIdsSet,
  specialType,
  specialRange,
  blockedGrid,
  impassableGrid,
  scoringGrid,
  onlyOnceGrid,
  getShipAttributes,
  address,
  highlightedMovePosition,
  lastMoveShipId,
  lastMoveOldPosition,
  lastMoveNewPosition,
  lastMoveActionType,
  lastMoveTargetShipId,
  lastMoveIsCurrentPlayer,
  isRammingMovePreview,
  isHoldPreviewActive,
  factionAbilityIsHeal,
  isFactionAbilitySupported,
  factionAbilityStrength,
  showLastMoveEmpReplayWhenSelected,
  retreatPrepShipId,
  retreatPrepIsCreator,
  isMyTurn,
  movementTileSet,
  shootingTileSet,
  tutorialHighlightKeySet,
  tutorialHighlightCells,
  effectiveDragCell,
  effectiveDragShipId,
  effectiveShootingTileSet,
  effectiveValidTargetIdSet,
  effectiveValidTargets,
  validTargetIdSet,
  validTargets,
  labelTargets,
  assistableTargetIdSet,
  assistableTargetsFromStartIdSet,
  lastMoveActionNum,
  projectedDamageByShipId,
  projectedRepairByShipId,
  destroyPreviewShipIds,
  sosPreviewShipIds,
  optimisticSosShipIds,
  isSubmitting,
  lastDragOverCellRef,
  setSelectedShipId,
  setPreviewPosition,
  setTargetShipId,
  setSelectedWeaponType,
  setHoveredCell,
  setDraggedShipId,
  setDragOverCell,
  setHoveredMoveTile,
  allShipPositions,
  dragOverCell,
  calculateDamage,
  rammingPreviewPosition,
  selectedShipCreatorSide,
  directedWeaponBeamTargetId,
  flakEffectCells,
  findShipPositionById,
  useCompactMobileDamageLabels,
  disableTooltips,
  renderShipCard,
  getHoverPreview,
}: {
  grid: (GridShipPosition | null)[][];
  gridLayoutRef: React.RefObject<HTMLDivElement | null>;
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  shipMap: Map<number, GridShip>;
  selectedShipId: number | null;
  previewPosition: { row: number; col: number } | null;
  targetShipId: number | null;
  selectedWeaponType: "weapon" | "special" | "ram";
  draggedShipId: number | null;
  isCurrentPlayerTurn: boolean;
  isShipOwnedByCurrentPlayer: (shipId: number) => boolean;
  movedShipIdsSet: Set<number>;
  specialType: number;
  specialRange?: number;
  blockedGrid: boolean[][];
  impassableGrid?: boolean[][];
  scoringGrid: number[][];
  onlyOnceGrid: boolean[][];
  getShipAttributes: GameGridProps["getShipAttributes"];
  address: string | undefined;
  highlightedMovePosition?: { row: number; col: number } | null;
  lastMoveShipId?: number | null;
  lastMoveOldPosition?: { row: number; col: number } | null;
  lastMoveNewPosition?: { row: number; col: number } | null;
  lastMoveActionType?: ActionType | null;
  lastMoveTargetShipId?: number | null;
  lastMoveIsCurrentPlayer?: boolean;
  isRammingMovePreview: boolean;
  isHoldPreviewActive: boolean;
  factionAbilityIsHeal: boolean;
  isFactionAbilitySupported: boolean;
  factionAbilityStrength?: number;
  showLastMoveEmpReplayWhenSelected: boolean;
  retreatPrepShipId?: number | null;
  retreatPrepIsCreator?: boolean | null;
  isMyTurn: boolean;
  movementTileSet: Set<string>;
  shootingTileSet: Set<string>;
  tutorialHighlightKeySet?: Set<string> | null;
  tutorialHighlightCells?: GameGridProps["tutorialHighlightCells"];
  effectiveDragCell: { row: number; col: number } | null;
  effectiveDragShipId: number | null;
  effectiveShootingTileSet: Set<string>;
  effectiveValidTargetIdSet: Set<number>;
  effectiveValidTargets: Array<{ shipId: number; position: { row: number; col: number } }>;
  validTargetIdSet: Set<number>;
  validTargets: Array<{ shipId: number; position: { row: number; col: number } }>;
  labelTargets?: Array<{ shipId: number; position: { row: number; col: number } }>;
  assistableTargetIdSet: Set<number>;
  assistableTargetsFromStartIdSet: Set<number>;
  lastMoveActionNum: number;
  projectedDamageByShipId: Map<number, number>;
  projectedRepairByShipId: Map<number, number>;
  destroyPreviewShipIds: Set<number>;
  sosPreviewShipIds: Set<number>;
  optimisticSosShipIds: Set<number>;
  isSubmitting: boolean;
  lastDragOverCellRef: React.RefObject<{ row: number; col: number } | null>;
  setSelectedShipId: (shipId: number | null) => void;
  setPreviewPosition: (position: { row: number; col: number } | null) => void;
  setTargetShipId: (shipId: number | null) => void;
  setSelectedWeaponType: (type: "weapon" | "special" | "ram") => void;
  setHoveredCell: (cell: HoveredCell) => void;
  setDraggedShipId: (shipId: number | null) => void;
  setDragOverCell: (cell: { row: number; col: number } | null) => void;
  setHoveredMoveTile: (cell: { row: number; col: number } | null) => void;
  allShipPositions?: readonly GridShipPosition[];
  dragOverCell: { row: number; col: number } | null;
  calculateDamage: GameGridProps["calculateDamage"];
  rammingPreviewPosition: { row: number; col: number } | null;
  selectedShipCreatorSide: boolean | null;
  directedWeaponBeamTargetId: number | null;
  flakEffectCells: Array<{ row: number; col: number }>;
  findShipPositionById: (shipId: number | null | undefined) => { row: number; col: number } | null;
  useCompactMobileDamageLabels: boolean;
  disableTooltips: boolean;
  renderShipCard: (hoveredCell: GameGridTooltipHoveredCell) => React.ReactNode | null;
  getHoverPreview?: GameGridProps["getHoverPreview"];
}) {
  const hoveredCell = useGridHoveredCell();
  const isHoveringValidTarget =
    hoveredCell !== null &&
    !hoveredCell.fromFleet &&
    validTargetIdSet.has(hoveredCell.shipId);
  const overlayDestination = effectiveDragCell ?? previewPosition;
  const isHoveringDestinationAsValidTarget =
    isHoveringValidTarget &&
    hoveredCell !== null &&
    overlayDestination !== null &&
    hoveredCell.row === overlayDestination.row &&
    hoveredCell.col === overlayDestination.col;

  return (
    <>
      <GameGridCells
        grid={grid}
        gridLayoutRef={gridLayoutRef}
        hideDestHologram={isHoveringDestinationAsValidTarget}
        fleetHoveredShipId={
          hoveredCell?.fromFleet ? hoveredCell.shipId : null
        }
        shipMap={shipMap}
        selectedShipId={selectedShipId}
        previewPosition={previewPosition}
        targetShipId={targetShipId}
        selectedWeaponType={selectedWeaponType}
        draggedShipId={draggedShipId}
        isCurrentPlayerTurn={isCurrentPlayerTurn}
        isShipOwnedByCurrentPlayer={isShipOwnedByCurrentPlayer}
        movedShipIdsSet={movedShipIdsSet}
        specialType={specialType}
        blockedGrid={blockedGrid}
        impassableGrid={impassableGrid}
        scoringGrid={scoringGrid}
        onlyOnceGrid={onlyOnceGrid}
        getShipAttributes={getShipAttributes}
        address={address}
        highlightedMovePosition={highlightedMovePosition}
        lastMoveShipId={lastMoveShipId}
        lastMoveOldPosition={lastMoveOldPosition}
        lastMoveNewPosition={lastMoveNewPosition}
        lastMoveActionType={lastMoveActionType}
        lastMoveTargetShipId={lastMoveTargetShipId}
        lastMoveIsCurrentPlayer={lastMoveIsCurrentPlayer}
        isRammingMovePreview={isRammingMovePreview}
        isHoldPreviewActive={isHoldPreviewActive}
        factionAbilityIsHeal={factionAbilityIsHeal}
        isFactionAbilitySupported={isFactionAbilitySupported}
        retreatPrepShipId={retreatPrepShipId}
        retreatPrepIsCreator={retreatPrepIsCreator}
        isMyTurn={isMyTurn}
        movementTileSet={movementTileSet}
        shootingTileSet={shootingTileSet}
        tutorialHighlightKeySet={tutorialHighlightKeySet}
        effectiveDragCell={effectiveDragCell}
        effectiveShootingTileSet={effectiveShootingTileSet}
        effectiveValidTargetIdSet={effectiveValidTargetIdSet}
        validTargetIdSet={validTargetIdSet}
        assistableTargetIdSet={assistableTargetIdSet}
        assistableTargetsFromStartIdSet={assistableTargetsFromStartIdSet}
        lastMoveActionNum={lastMoveActionNum}
        projectedDamageByShipId={projectedDamageByShipId}
        projectedRepairByShipId={projectedRepairByShipId}
        destroyPreviewShipIds={destroyPreviewShipIds}
        sosPreviewShipIds={sosPreviewShipIds}
        optimisticSosShipIds={optimisticSosShipIds}
        isSubmitting={isSubmitting}
        lastDragOverCellRef={lastDragOverCellRef}
        setSelectedShipId={setSelectedShipId}
        setPreviewPosition={setPreviewPosition}
        setTargetShipId={setTargetShipId}
        setSelectedWeaponType={setSelectedWeaponType}
        setHoveredCell={setHoveredCell}
        setDraggedShipId={setDraggedShipId}
        setDragOverCell={setDragOverCell}
        setHoveredMoveTile={setHoveredMoveTile}
      />
      <GameGridDestHoverRange
        gridLayoutRef={gridLayoutRef}
        getHoverPreview={getHoverPreview}
        selectedShipId={selectedShipId}
        previewPosition={previewPosition}
        retreatPrepShipId={retreatPrepShipId}
        draggedShipId={draggedShipId}
        selectedWeaponType={selectedWeaponType}
        specialType={specialType}
        shipMap={shipMap}
        movementTileSet={movementTileSet}
      />
      <GameGridMoveArrow
        selectedShipId={selectedShipId}
        previewPosition={previewPosition}
        effectiveDragCell={effectiveDragCell}
        isHoveringDestinationAsValidTarget={isHoveringDestinationAsValidTarget}
        retreatPrepShipId={retreatPrepShipId}
        lastMoveOldPosition={lastMoveOldPosition}
        lastMoveNewPosition={lastMoveNewPosition}
        lastMoveShipId={lastMoveShipId}
        lastMoveActionType={lastMoveActionType}
        allShipPositions={allShipPositions}
        isShipOwnedByCurrentPlayer={isShipOwnedByCurrentPlayer}
        movementTileSet={movementTileSet}
      />
      <GameGridOverlays
        grid={grid}
        allShipPositions={allShipPositions}
        shipMap={shipMap}
        selectedShipId={selectedShipId}
        previewPosition={previewPosition}
        targetShipId={targetShipId}
        selectedWeaponType={selectedWeaponType}
        draggedShipId={draggedShipId}
        dragOverCell={dragOverCell}
        validTargets={validTargets}
        labelTargets={labelTargets}
        effectiveDragCell={draggedShipId && dragOverCell ? dragOverCell : null}
        effectiveDragShipId={draggedShipId}
        effectiveValidTargets={draggedShipId ? effectiveValidTargets : EMPTY_TARGET_REFS}
        isCurrentPlayerTurn={isCurrentPlayerTurn}
        isShipOwnedByCurrentPlayer={isShipOwnedByCurrentPlayer}
        specialType={specialType}
        specialRange={specialRange}
        calculateDamage={calculateDamage}
        getShipAttributes={getShipAttributes}
        gridContainerRef={gridContainerRef}
        lastMoveShipId={lastMoveShipId}
        lastMoveOldPosition={lastMoveOldPosition}
        lastMoveNewPosition={lastMoveNewPosition}
        lastMoveActionType={lastMoveActionType}
        lastMoveTargetShipId={lastMoveTargetShipId}
        rammingPreviewPosition={rammingPreviewPosition}
        isRammingMovePreview={isRammingMovePreview}
        factionAbilityIsHeal={factionAbilityIsHeal}
        factionAbilityStrength={factionAbilityStrength}
        showLastMoveEmpReplayWhenSelected={showLastMoveEmpReplayWhenSelected}
        retreatPrepShipId={retreatPrepShipId}
        tutorialHighlightCells={tutorialHighlightCells}
        movementTileSet={movementTileSet}
        selectedShipCreatorSide={selectedShipCreatorSide}
        directedWeaponBeamTargetId={directedWeaponBeamTargetId}
        flakEffectCells={flakEffectCells}
        findShipPositionById={findShipPositionById}
        useCompactMobileDamageLabels={useCompactMobileDamageLabels}
      />
      <GameGridTileTooltip gridContainerRef={gridContainerRef} disabled={disableTooltips || !!draggedShipId} />
      <GameGridTooltip
        hoveredCell={hoveredCell}
        disableTooltips={disableTooltips}
        draggedShipId={draggedShipId}
        gridContainerRef={gridContainerRef}
        gridLayoutRef={gridLayoutRef}
        renderShipCard={renderShipCard}
      />
    </>
  );
});

const GameGridBoard = React.memo(function GameGridBoard({
  grid,
  allShipPositions,
  shipMap,
  selectedShipId,
  previewPosition,
  targetShipId,
  selectedWeaponType,
  draggedShipId,
  dragOverCell,
  movementRange,
  shootingRange,
  validTargets,
  labelTargets,
  assistableTargets,
  assistableTargetsFromStart,
  dragShootingRange,
  dragValidTargets,
  isCurrentPlayerTurn,
  isShipOwnedByCurrentPlayer,
  movedShipIdsSet,
  specialType,
  specialRange,
  blockedGrid,
  impassableGrid,
  scoringGrid,
  onlyOnceGrid,
  calculateDamage,
  getShipAttributes,
  disableTooltips,
  address,
  currentTurn,
  highlightedMovePosition,
  lastMoveShipId,
  lastMoveOldPosition,
  lastMoveNewPosition,
  lastMoveResolvedTo,
  lastMoveActionType,
  lastMoveTargetShipId,
  lastMoveIsCurrentPlayer,
  rammingPreviewPosition = null,
  isRammingMovePreview = false,
  isFactionAbilitySupported = false,
  factionAbilityRange,
  factionAbilityIsHeal = false,
  factionAbilityStrength,
  showLastMoveEmpReplayWhenSelected = false,
  retreatPrepShipId,
  retreatPrepIsCreator,
  tutorialHighlightCells,
  tutorialWeaponOption,
  onGridRightClickDeselect,
  setSelectedShipId,
  setPreviewPosition,
  setTargetShipId,
  setSelectedWeaponType,
  setDraggedShipId,
  setDragOverCell,
  getHoverPreview,
  showConfirmWidget = false,
  confirmWidgetLabel = "SUBMIT",
  onConfirmMove,
  onCancelMove,
  confirmButton,
  optimisticSosShipIds = EMPTY_SHIP_ID_SET,
  optimisticDestroyShipIds = EMPTY_SHIP_ID_SET,
  isSubmitting = false,
  submittedProposal = null,
  renderShipCard,
}: GameGridProps) {
  // The confirm widget follows the submitted proposal while submitting.
  const widgetShipId = submittedProposal ? submittedProposal.selectedShipId : selectedShipId;
  const widgetPreview = submittedProposal ? submittedProposal.previewPosition : previewPosition;
  const widgetTargetId = submittedProposal ? submittedProposal.targetShipId : targetShipId;
  const widgetRetreatPrepId = submittedProposal ? submittedProposal.retreatPrepShipId : retreatPrepShipId;
  const widgetMovementRange = submittedProposal ? submittedProposal.movementRange : movementRange;
  const setHoveredCell = useSetGridHoveredCell();
  const setHoveredMoveTile = useSetGridDestHoveredTile();
  const { outerWrapperRef, gridContainerRef, zoom } = useGridPanZoom();
  /** The bordered CSS grid (cells); tracks are inset by border — use for cell math vs overlay. */
  const gridLayoutRef = useRef<HTMLDivElement>(null);
  // Track last drag over cell to prevent excessive state updates
  const lastDragOverCellRef = useRef<{ row: number; col: number } | null>(null);

  // Dest-tile hover is context state (DestHoverProvider). Do not store it here:
  // this parent recrawling 187 cells on every dest tile is the live input lag.
  const effectiveDragCell = draggedShipId && dragOverCell ? dragOverCell : null;
  const effectiveDragShipId = draggedShipId;
  const effectiveShootingRange = effectiveDragCell
    ? dragShootingRange
    : EMPTY_RANGE_CELLS;
  const effectiveValidTargets: Array<{ shipId: number; position: { row: number; col: number } }> =
    effectiveDragCell ? dragValidTargets : EMPTY_TARGET_REFS;

  /** Re-render on grid container resize so ship tooltips stay aligned with cells. */
  const [, setGridLayoutVersion] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = gridContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lastW = el.clientWidth;
    let lastH = el.clientHeight;
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect;
      const w = next?.width ?? el.clientWidth;
      const h = next?.height ?? el.clientHeight;
      if (Math.abs(w - lastW) < 0.5 && Math.abs(h - lastH) < 0.5) return;
      lastW = w;
      lastH = h;
      setGridLayoutVersion((v) => v + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [useCompactMobileDamageLabels, setUseCompactMobileDamageLabels] =
    React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setUseCompactMobileDamageLabels(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const isMyTurn = currentTurn === address;
  React.useEffect(() => {
    setHoveredCell(null);
    setHoveredMoveTile(null);
  }, [currentTurn, isCurrentPlayerTurn, setHoveredCell, setHoveredMoveTile]);
  // A clicked destination stops being a movement tile once the ship moves, so
  // its mouseleave never fires to clear the hover. Without this, selecting the
  // next ship (e.g. a second move in the same turn) reused the first ship's
  // destination as a hovered tile and drew the move arrow to it.
  React.useEffect(() => {
    setHoveredMoveTile(null);
  }, [selectedShipId, setHoveredMoveTile]);
  const selectedShipCreatorSide = React.useMemo(() => {
    if (selectedShipId == null) return null as boolean | null;
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell || cell.shipId !== selectedShipId) continue;
        if (!cell.isPreview) return cell.isCreator;
      }
    }
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell || cell.shipId !== selectedShipId) continue;
        return cell.isCreator;
      }
    }
    return null;
  }, [grid, selectedShipId]);

  const lastMoveActionNum =
    lastMoveActionType != null ? Number(lastMoveActionType) : NaN;

  const {
    directedWeaponBeamTargetId,
    flakEffectCells,
    projectedDamageByShipId,
    projectedRepairByShipId,
    destroyPreviewShipIds: stagedDestroyShipIds,
    sosPreviewShipIds,
    findShipPositionById,
  } = useGridEffectPreviews({
    grid,
    allShipPositions,
    selectedShipId,
    targetShipId,
    previewPosition,
    draggedShipId,
    effectiveDragCell,
    effectiveDragShipId,
    effectiveShootingRange,
    effectiveValidTargets,
    shootingRange,
    validTargets,
    labelTargets,
    selectedWeaponType,
    specialType,
    shipVariant: selectedShipId != null ? shipMap.get(selectedShipId)?.traits.variant : undefined,
    specialRange,
    isCurrentPlayerTurn,
    isShipOwnedByCurrentPlayer,
    lastMoveTargetShipId,
    lastMoveShipId,
    lastMoveNewPosition,
    lastMoveResolvedTo,
    factionAbilityIsHeal,
    factionAbilityStrength,
    calculateDamage,
    getShipAttributes,
  });
  // Staged prediction while aiming, plus submitted-shot predictions that must
  // outlive the staging (selection clears on send) until chain data shows the
  // ship destroyed. Cells only see the union.
  const destroyPreviewShipIds = React.useMemo(() => {
    if (optimisticDestroyShipIds.size === 0) return stagedDestroyShipIds;
    if (stagedDestroyShipIds.size === 0) return optimisticDestroyShipIds;
    return new Set([...stagedDestroyShipIds, ...optimisticDestroyShipIds]);
  }, [stagedDestroyShipIds, optimisticDestroyShipIds]);

  // Compute the best placement for the confirm widget to avoid covering the target ship,
  // weapon beam path, and move arrow. See computeConfirmWidgetAnchor for the algorithm.
  const isHoldPreviewActive = React.useMemo(() => {
    if (selectedShipId == null || previewPosition == null || isRammingMovePreview) {
      return false;
    }
    let fromRow = -1;
    let fromCol = -1;
    outer: for (let r = 0; r < grid.length; r++) {
      const row = grid[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (cell?.shipId === selectedShipId && !cell.isPreview) {
          fromRow = r;
          fromCol = c;
          break outer;
        }
      }
    }
    if (fromRow < 0) {
      fromRow = previewPosition.row;
      fromCol = previewPosition.col;
    }
    return fromRow === previewPosition.row && fromCol === previewPosition.col;
  }, [selectedShipId, previewPosition, isRammingMovePreview, grid]);

  const selfHasEffectLabel = selectedShipHasEffectLabel({
    selectedShipId,
    targetShipId,
    selectedWeaponType,
    specialType,
    shipVariant: selectedShipId != null ? shipMap.get(selectedShipId)?.traits.variant : undefined,
    factionAbilityIsHeal,
  });
  const [confirmWidgetVertical, setConfirmWidgetVertical] = React.useState<
    "above" | "below" | null
  >(null);
  React.useEffect(() => {
    setConfirmWidgetVertical(null);
  }, [widgetShipId, widgetPreview?.row, widgetPreview?.col, widgetTargetId]);
  const confirmWidgetAnchor = React.useMemo(
    () => computeConfirmWidgetAnchor({
      showConfirmWidget,
      previewPosition: widgetPreview,
      selectedShipId: widgetShipId,
      targetShipId: widgetTargetId,
      grid,
      allShipPositions,
      selfHasEffectLabel,
      preferredVertical: confirmWidgetVertical,
    }),
    [showConfirmWidget, widgetPreview, widgetShipId, widgetTargetId, grid, allShipPositions, selfHasEffectLabel, confirmWidgetVertical],
  );

  const handleGridContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setSelectedShipId(null);
      setPreviewPosition(null);
      setTargetShipId(null);
      setHoveredCell(null);
      setHoveredMoveTile(null);
      setDraggedShipId(null);
      setDragOverCell(null);
      lastDragOverCellRef.current = null;
      onGridRightClickDeselect?.();
    },
    [
      onGridRightClickDeselect,
      setSelectedShipId,
      setPreviewPosition,
      setTargetShipId,
      setHoveredCell,
      setHoveredMoveTile,
      setDraggedShipId,
      setDragOverCell,
    ],
  );

  // Pre-compute lookup Sets so per-cell checks are O(1) instead of O(n) each.
  const {
    movementTileSet,
    shootingTileSet,
    effectiveShootingTileSet,
    validTargetIdSet,
    effectiveValidTargetIdSet,
    assistableTargetIdSet,
    assistableTargetsFromStartIdSet,
    tutorialHighlightKeySet,
  } = useGridCellSets({
    movementRange,
    shootingRange,
    effectiveShootingRange,
    validTargets,
    effectiveValidTargets,
    assistableTargets,
    assistableTargetsFromStart,
    tutorialHighlightCells,
  });

  return (
    <>
      {/* Map Grid */}
      <div
        ref={outerWrapperRef}
        className="w-full h-full min-h-0 px-0 lg:px-2 overflow-hidden"
        onContextMenu={handleGridContextMenu}
      >
        <div
          ref={gridContainerRef}
          key="game-grid"
          data-grid-inner=""
          className="relative w-full h-full min-h-0"
        >
          <GameGridHoverSurface
            grid={grid}
            gridLayoutRef={gridLayoutRef}
            gridContainerRef={gridContainerRef}
            shipMap={shipMap}
            selectedShipId={selectedShipId}
            previewPosition={previewPosition}
            targetShipId={targetShipId}
            selectedWeaponType={selectedWeaponType}
            draggedShipId={draggedShipId}
            isCurrentPlayerTurn={isCurrentPlayerTurn}
            isShipOwnedByCurrentPlayer={isShipOwnedByCurrentPlayer}
            movedShipIdsSet={movedShipIdsSet}
            specialType={specialType}
            specialRange={specialRange}
            blockedGrid={blockedGrid}
            impassableGrid={impassableGrid}
            scoringGrid={scoringGrid}
            onlyOnceGrid={onlyOnceGrid}
            getShipAttributes={getShipAttributes}
            address={address}
            highlightedMovePosition={highlightedMovePosition}
            lastMoveShipId={lastMoveShipId}
            lastMoveOldPosition={lastMoveOldPosition}
            lastMoveNewPosition={lastMoveNewPosition}
            lastMoveActionType={lastMoveActionType}
            lastMoveTargetShipId={lastMoveTargetShipId}
            lastMoveIsCurrentPlayer={lastMoveIsCurrentPlayer}
            isRammingMovePreview={Boolean(isRammingMovePreview)}
            isHoldPreviewActive={isHoldPreviewActive}
            factionAbilityIsHeal={factionAbilityIsHeal}
            isFactionAbilitySupported={isFactionAbilitySupported}
            factionAbilityStrength={factionAbilityStrength}
            showLastMoveEmpReplayWhenSelected={showLastMoveEmpReplayWhenSelected}
            retreatPrepShipId={retreatPrepShipId}
            retreatPrepIsCreator={retreatPrepIsCreator}
            isMyTurn={isMyTurn}
            movementTileSet={movementTileSet}
            shootingTileSet={shootingTileSet}
            tutorialHighlightKeySet={tutorialHighlightKeySet}
            tutorialHighlightCells={tutorialHighlightCells}
            effectiveDragCell={effectiveDragCell}
            effectiveDragShipId={effectiveDragShipId}
            effectiveShootingTileSet={effectiveShootingTileSet}
            effectiveValidTargetIdSet={effectiveValidTargetIdSet}
            effectiveValidTargets={effectiveValidTargets}
            validTargetIdSet={validTargetIdSet}
            validTargets={validTargets}
            labelTargets={labelTargets}
            assistableTargetIdSet={assistableTargetIdSet}
            assistableTargetsFromStartIdSet={assistableTargetsFromStartIdSet}
            lastMoveActionNum={lastMoveActionNum}
            projectedDamageByShipId={projectedDamageByShipId}
            projectedRepairByShipId={projectedRepairByShipId}
            destroyPreviewShipIds={destroyPreviewShipIds}
            sosPreviewShipIds={sosPreviewShipIds}
            optimisticSosShipIds={optimisticSosShipIds}
            isSubmitting={isSubmitting}
            lastDragOverCellRef={lastDragOverCellRef}
            setSelectedShipId={setSelectedShipId}
            setPreviewPosition={setPreviewPosition}
            setTargetShipId={setTargetShipId}
            setSelectedWeaponType={setSelectedWeaponType}
            setHoveredCell={setHoveredCell}
            setDraggedShipId={setDraggedShipId}
            setDragOverCell={setDragOverCell}
            setHoveredMoveTile={setHoveredMoveTile}
            allShipPositions={allShipPositions}
            dragOverCell={dragOverCell}
            calculateDamage={calculateDamage}
            rammingPreviewPosition={rammingPreviewPosition}
            selectedShipCreatorSide={selectedShipCreatorSide}
            directedWeaponBeamTargetId={directedWeaponBeamTargetId}
            flakEffectCells={flakEffectCells}
            findShipPositionById={findShipPositionById}
            useCompactMobileDamageLabels={useCompactMobileDamageLabels}
            disableTooltips={disableTooltips}
            renderShipCard={renderShipCard}
            getHoverPreview={getHoverPreview}
          />

          {/* Floating weapon selector — appears above selected ship; stays visible when targeting */}
          <GameGridWeaponSelector
            grid={grid}
            allShipPositions={allShipPositions}
            shipMap={shipMap}
            selectedShipId={selectedShipId}
            targetShipId={targetShipId}
            previewPosition={previewPosition}
            selectedWeaponType={selectedWeaponType}
            specialType={specialType}
            movementRange={movementRange}
            isCurrentPlayerTurn={isCurrentPlayerTurn}
            isShipOwnedByCurrentPlayer={isShipOwnedByCurrentPlayer}
            getShipAttributes={getShipAttributes}
            showConfirmWidget={showConfirmWidget}
            isRammingMovePreview={isRammingMovePreview}
            isFactionAbilitySupported={isFactionAbilitySupported}
            factionAbilityRange={factionAbilityRange}
            retreatPrepShipId={retreatPrepShipId}
            setSelectedWeaponType={setSelectedWeaponType}
            setTargetShipId={setTargetShipId}
            preferredVertical={confirmWidgetVertical}
            onMoveVertical={setConfirmWidgetVertical}
            clipRootRef={outerWrapperRef}
            zoomScale={zoom.scale}
          />

          {showConfirmWidget &&
            (widgetPreview || widgetRetreatPrepId != null) &&
            onCancelMove &&
            confirmWidgetAnchor && (
              <GameGridConfirmWidget
                confirmWidgetAnchor={confirmWidgetAnchor}
                confirmWidgetLabel={confirmWidgetLabel}
                onConfirmMove={onConfirmMove ?? NOOP_CONFIRM}
                onCancelMove={onCancelMove}
                confirmButton={confirmButton}
                isSubmitting={submittedProposal != null}
                selectedShipId={widgetShipId}
                shipMap={shipMap}
                selectedWeaponType={selectedWeaponType}
                specialType={specialType}
                targetShipId={widgetTargetId}
                isRammingMovePreview={isRammingMovePreview ?? false}
                retreatPrepShipId={widgetRetreatPrepId}
                isFactionAbilitySupported={isFactionAbilitySupported}
                factionAbilityRange={factionAbilityRange}
                previewPosition={widgetPreview}
                movementRange={widgetMovementRange}
                grid={grid}
                isShipOwnedByCurrentPlayer={isShipOwnedByCurrentPlayer}
                getShipAttributes={getShipAttributes}
                setSelectedWeaponType={setSelectedWeaponType}
                setTargetShipId={setTargetShipId}
                clipRootRef={outerWrapperRef}
                zoomScale={zoom.scale}
                onMoveVertical={setConfirmWidgetVertical}
                tutorialWeaponOption={tutorialWeaponOption}
              />
            )}
        </div>
      </div>
    </>
  );
});

export const GameGrid = React.memo(function GameGrid(props: GameGridProps) {
  // While a move is submitting, the selection is still the submitted
  // proposal (it keeps the submit UI mounted until the tx settles), but the
  // board already shows its predicted result. Drop the proposal overlays
  // (ghost, ranges, target labels) so the two don't fight; the confirm
  // widget alone stays where it was, showing the pending button.
  const {
    isSubmitting,
    selectedShipId,
    previewPosition,
    targetShipId,
    retreatPrepShipId,
    movementRange,
  } = props;
  const submittedProposal = React.useMemo<SubmittedProposal | null>(
    () =>
      isSubmitting && selectedShipId != null
        ? {
            selectedShipId,
            previewPosition,
            targetShipId,
            retreatPrepShipId: retreatPrepShipId ?? null,
            movementRange,
          }
        : null,
    [isSubmitting, selectedShipId, previewPosition, targetShipId, retreatPrepShipId, movementRange],
  );
  return (
    <DestHoverProvider>
      {submittedProposal ? (
        <GameGridBoard
          {...props}
          selectedShipId={null}
          previewPosition={null}
          targetShipId={null}
          retreatPrepShipId={null}
          movementRange={EMPTY_RANGE_CELLS}
          shootingRange={EMPTY_RANGE_CELLS}
          validTargets={EMPTY_TARGET_REFS}
          labelTargets={EMPTY_TARGET_REFS}
          assistableTargets={EMPTY_TARGET_REFS}
          assistableTargetsFromStart={EMPTY_TARGET_REFS}
          rammingPreviewPosition={null}
          isRammingMovePreview={false}
          submittedProposal={submittedProposal}
        />
      ) : (
        <GameGridBoard {...props} />
      )}
    </DestHoverProvider>
  );
});
