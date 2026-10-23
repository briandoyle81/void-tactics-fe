"use client";

import React from "react";
import { Attributes, canonicalSpecialSlot } from "../types/types";
import {
  isAttackDronesSpecial,
  isRepairDronesSpecial,
  requireSpecialConfigWeb2,
} from "../utils/specialConfigWeb2";
import { requireShipValue } from "../utils/requireShipValue";
import { GridShip, GridShipPosition } from "../types/gridDisplay";
import { LaserShootingAnimation } from "./weapon-animations/LaserShootingAnimation";
import { MissileShootingAnimation } from "./weapon-animations/MissileShootingAnimation";
import { PlasmaShootingAnimation } from "./weapon-animations/PlasmaShootingAnimation";
import { MiningDrillAnimation } from "./weapon-animations/MiningDrillAnimation";
import { RailgunShootingAnimation } from "./weapon-animations/RailgunShootingAnimation";
import { FlakExplosionAnimation } from "./weapon-animations/FlakExplosionAnimation";
import { RepairDroneAnimation } from "./weapon-animations/RepairDroneAnimation";
import { AttackDroneAnimation } from "./weapon-animations/AttackDroneAnimation";
import { EmpWaveAnimation } from "./weapon-animations/EmpWaveAnimation";
import { LightningFieldAnimation } from "./weapon-animations/LightningFieldAnimation";
import { TutorialTargetPointer } from "./TutorialTarget";
import { collectDamageLabelTargets } from "../utils/gameGridRanges";
import { useGridDestHoveredTile, useGridHoveredCell } from "./GridHover";
import { MovePathArrow, MOVE_ARROW_GREY, MOVE_ARROW_YELLOW } from "./MovePathArrow";
import { routeForShip } from "../utils/movePath";

type Position = { row: number; col: number };
type TargetRef = { shipId: number; position: Position };
function isLightningFieldShip(ship: GridShip | undefined): boolean {
  if (!ship) return false;
  return (
    Number(ship.traits.variant) === 2 &&
    canonicalSpecialSlot(ship.traits.variant, ship.equipment.special) === 1
  );
}

function hologramWeaponFire(active: boolean, node: React.ReactNode) {
  if (!active || node == null) return node;
  return (
    <div className="weapon-hologram absolute inset-0 pointer-events-none">
      {node}
    </div>
  );
}

export function lightningFieldRange(ship: GridShip | undefined): number {
  if (!ship) {
    throw new Error("Missing ship value: lighteningFieldRange");
  }
  return requireShipValue(
    "lighteningFieldRange",
    requireSpecialConfigWeb2(Number(ship.traits.variant), ship.equipment.special).range,
  );
}

export function isFlakArrayShip(ship: GridShip | undefined): boolean {
  if (!ship) return false;
  const variant = Number(ship.traits.variant);
  return (
    variant !== 2 &&
    canonicalSpecialSlot(variant, ship.equipment.special) === 3
  );
}

export function flakArrayRange(ship: GridShip | undefined): number {
  if (!ship) {
    throw new Error("Missing ship value: flakArrayRange");
  }
  return requireShipValue(
    "flakArrayRange",
    requireSpecialConfigWeb2(Number(ship.traits.variant), ship.equipment.special).range,
  );
}

export function cellsInManhattanRange(
  origin: Position,
  range: number,
  grid: (GridShipPosition | null)[][],
): Position[] {
  const cells: Position[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const dist = Math.abs(r - origin.row) + Math.abs(c - origin.col);
      if (dist > 0 && dist <= range) cells.push({ row: r, col: c });
    }
  }
  return cells;
}


function resolveDirectedAttackerPos(params: {
  previewPosition: Position | null;
  draggedShipId: number | null;
  dragOverCell: Position | null;
  selectedShipId: number | null;
  shipId: number;
  findShipPositionById: (shipId: number | null | undefined) => Position | null;
}): Position | null {
  if (params.previewPosition) return params.previewPosition;
  if (params.draggedShipId && params.dragOverCell) return params.dragOverCell;
  // Target picked before (or without) a destination: fire from where the
  // selected ship currently sits.
  if (params.selectedShipId != null && params.shipId === params.selectedShipId) {
    return params.findShipPositionById(params.shipId);
  }
  return null;
}

function resolveSelectedAttackerPos(params: {
  previewPosition: Position | null;
  draggedShipId: number | null;
  dragOverCell: Position | null;
  selectedShipId: number | null;
  findShipPositionById: (shipId: number | null | undefined) => Position | null;
}): Position | null {
  if (params.previewPosition) return params.previewPosition;
  if (params.draggedShipId && params.dragOverCell) return params.dragOverCell;
  if (params.selectedShipId == null) return null;
  return params.findShipPositionById(params.selectedShipId);
}

interface GameGridOverlaysProps {
  grid: (GridShipPosition | null)[][];
  allShipPositions?: readonly GridShipPosition[];
  shipMap: Map<number, GridShip>;
  selectedShipId: number | null;
  previewPosition: Position | null;
  targetShipId: number | null;
  selectedWeaponType: "weapon" | "special" | "ram";
  draggedShipId: number | null;
  dragOverCell: Position | null;
  validTargets: TargetRef[];
  labelTargets?: TargetRef[];
  effectiveDragCell: Position | null;
  effectiveDragShipId: number | null;
  effectiveValidTargets: TargetRef[];
  isCurrentPlayerTurn: boolean;
  isShipOwnedByCurrentPlayer: (shipId: number) => boolean;
  specialType: number;
  specialRange?: number;
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
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  rammingPreviewPosition?: Position | null;
  isRammingMovePreview?: boolean;
  factionAbilityIsHeal?: boolean;
  factionAbilityStrength?: number;
  retreatPrepShipId?: number | null;
  tutorialHighlightCells?: readonly {
    row: number;
    col: number;
    label?: string;
    hideLabel?: boolean;
  }[];
  movementTileSet: Set<string>;
  selectedShipCreatorSide: boolean | null;
  directedWeaponBeamTargetId: number | null;
  flakEffectCells: Position[];
  findShipPositionById: (shipId: number | null | undefined) => Position | null;
  useCompactMobileDamageLabels: boolean;
}

export const GameGridMoveArrow = React.memo(function GameGridMoveArrow({
  selectedShipId,
  previewPosition,
  effectiveDragCell,
  isHoveringDestinationAsValidTarget,
  retreatPrepShipId,
  allShipPositions,
  isShipOwnedByCurrentPlayer,
  movementTileSet,
  impassableGrid,
  getShipAttributes,
}: {
  selectedShipId: number | null;
  previewPosition: Position | null;
  effectiveDragCell: Position | null;
  isHoveringDestinationAsValidTarget: boolean;
  retreatPrepShipId?: number | null;
  allShipPositions?: readonly GridShipPosition[];
  isShipOwnedByCurrentPlayer: (shipId: number) => boolean;
  /** Hover only counts on the selected ship's movement tiles (guards a stale hover). */
  movementTileSet: Set<string>;
  impassableGrid?: boolean[][];
  getShipAttributes: (shipId: number) => { hullPoints: number } | null;
}) {
  const rawDestHover = useGridDestHoveredTile();
  const destHover =
    rawDestHover && movementTileSet.has(`${rawDestHover.row},${rawDestHover.col}`)
      ? rawDestHover
      : null;
  const hoveredCell = useGridHoveredCell();
  const destFromPointer =
    effectiveDragCell ??
    (selectedShipId !== null &&
    !previewPosition &&
    retreatPrepShipId == null
      ? destHover
      : null);
  const proposedDestination = destFromPointer ?? previewPosition;
  const hoveringDestAsTarget =
    hoveredCell != null &&
    !hoveredCell.fromFleet &&
    proposedDestination != null &&
    hoveredCell.row === proposedDestination.row &&
    hoveredCell.col === proposedDestination.col;
  const useProposedMoveArrow =
    selectedShipId !== null &&
    proposedDestination !== null &&
    !hoveringDestAsTarget &&
    retreatPrepShipId == null;

  if (!useProposedMoveArrow) return null;

  const destination = proposedDestination!;
  const movingShipId = selectedShipId!;
  const fromPos = allShipPositions?.find((sp) => sp.shipId === movingShipId)?.position ?? null;

  if (!fromPos) return null;
  if (fromPos.row === destination.row && fromPos.col === destination.col) {
    return null;
  }

  const arrowColor =
    !isShipOwnedByCurrentPlayer(selectedShipId!)
      ? MOVE_ARROW_GREY
      : MOVE_ARROW_YELLOW;

  // Along the route around asteroids and enemy ships (findMovePath).
  const path = routeForShip({
    shipId: movingShipId,
    from: fromPos,
    to: destination,
    shipPositions: allShipPositions ?? [],
    impassableGrid,
    isDisabled: (id) => getShipAttributes(id)?.hullPoints === 0,
  });
  return <MovePathArrow path={path} color={arrowColor} />;
});

/**
 * Weapon-effect overlay layer: warp-field collapse (retreat), move-path
 * arrow, per-weapon shooting animations, Flak/EMP/repair-drone effects,
 * floating damage labels, and the tutorial targets' ripple and chevron. Extracted
 * verbatim from `GameGrid.tsx` — same JSX, same behavior, just relocated.
 */
export const GameGridOverlays = React.memo(function GameGridOverlays({
  grid,
  allShipPositions,
  shipMap,
  selectedShipId,
  previewPosition,
  targetShipId,
  selectedWeaponType,
  draggedShipId,
  dragOverCell,
  validTargets,
  labelTargets,
  effectiveDragCell,
  effectiveDragShipId,
  effectiveValidTargets,
  isCurrentPlayerTurn,
  isShipOwnedByCurrentPlayer,
  specialType,
  specialRange,
  calculateDamage,
  getShipAttributes,
  gridContainerRef,
  rammingPreviewPosition = null,
  isRammingMovePreview = false,
  factionAbilityIsHeal = false,
  factionAbilityStrength,
  retreatPrepShipId,
  tutorialHighlightCells,
  movementTileSet,
  selectedShipCreatorSide,
  directedWeaponBeamTargetId,
  flakEffectCells,
  findShipPositionById,
  useCompactMobileDamageLabels,
}: GameGridOverlaysProps) {
  // Aiming previews: weapon fire is a hologram at the staged destination.
  // (A submitted move plays back once through MovePlaybackLayer instead.)
  const hologramFire = !!(previewPosition && selectedShipId);
  // Show the player's directed fire as soon as a target is picked; the
  // destination only changes where it fires from.
  const showDirectedWeaponFire =
    !!directedWeaponBeamTargetId && selectedShipId != null && selectedWeaponType === "weapon";

  return (
          <div className="absolute inset-0 z-50 pointer-events-none">
            {/* Laser Shooting Animation */}
            {selectedShipId &&
              showDirectedWeaponFire &&
              (() => {
                const shipId = selectedShipId;
                if (!shipId) return null;

                // Check if the ship has a Laser weapon (mainWeapon === 0)
                const ship = shipMap.get(shipId);
                if (!ship || ship.equipment.mainWeapon !== 0) {
                  return null;
                }

                const attackerPos = resolveDirectedAttackerPos({
                  previewPosition,
                  draggedShipId,
                  dragOverCell,
                  selectedShipId,
                  shipId,
                  findShipPositionById,
                });
                if (!attackerPos) return null;
                const { row: attackerRow, col: attackerCol } = attackerPos;

                if (!directedWeaponBeamTargetId) return null;
                const targetPosition = findShipPositionById(
                  directedWeaponBeamTargetId,
                );
                if (!targetPosition) return null;

                // Creator ships face right, joiner ships face left.
                const attackerIsCreator =
                  selectedShipCreatorSide ??
                  grid[attackerRow]?.[attackerCol]?.isCreator ??
                  false;

                return hologramWeaponFire(
                  hologramFire,
                  <LaserShootingAnimation
                    gridContainerRef={gridContainerRef}
                    attackerRow={attackerRow}
                    attackerCol={attackerCol}
                    targetRow={targetPosition.row}
                    targetCol={targetPosition.col}
                    facingRight={attackerIsCreator}
                    variant={Number(ship.traits.variant)}
                  />,
                );
              })()}

            {/* Missile Shooting Animation */}
            {selectedShipId &&
              showDirectedWeaponFire &&
              (() => {
                const shipId = selectedShipId;
                if (!shipId) {
                  return null;
                }

                // Check if the ship has a Missile weapon (mainWeapon === 2)
                const ship = shipMap.get(shipId);
                if (!ship || ship.equipment.mainWeapon !== 2) {
                  return null;
                }

                const attackerPos = resolveDirectedAttackerPos({
                  previewPosition,
                  draggedShipId,
                  dragOverCell,
                  selectedShipId,
                  shipId,
                  findShipPositionById,
                });
                if (!attackerPos) return null;
                const { row: attackerRow, col: attackerCol } = attackerPos;

                if (!directedWeaponBeamTargetId) return null;
                const targetPosition = findShipPositionById(
                  directedWeaponBeamTargetId,
                );
                if (!targetPosition) {
                  return null;
                }

                const attackerIsCreator =
                  selectedShipCreatorSide ??
                  grid[attackerRow]?.[attackerCol]?.isCreator ??
                  false;

                return hologramWeaponFire(
                  hologramFire,
                  <MissileShootingAnimation
                    gridContainerRef={gridContainerRef}
                    attackerRow={attackerRow}
                    attackerCol={attackerCol}
                    targetRow={targetPosition.row}
                    targetCol={targetPosition.col}
                    facingRight={attackerIsCreator}
                    variant={Number(ship.traits.variant)}
                  />,
                );
              })()}

            {/* Plasma Shooting Animation */}
            {selectedShipId &&
              showDirectedWeaponFire &&
              (() => {
                const shipId = selectedShipId;
                if (!shipId) return null;

                // Check if the ship has a Plasma / Mining Drill (mainWeapon === 3)
                const ship = shipMap.get(shipId);
                if (!ship || ship.equipment.mainWeapon !== 3) {
                  return null;
                }
                const isMiningDrill = Number(ship.traits.variant) === 2;

                const attackerPos = resolveDirectedAttackerPos({
                  previewPosition,
                  draggedShipId,
                  dragOverCell,
                  selectedShipId,
                  shipId,
                  findShipPositionById,
                });
                if (!attackerPos) return null;
                const { row: attackerRow, col: attackerCol } = attackerPos;

                if (!directedWeaponBeamTargetId) return null;
                const targetPosition = findShipPositionById(
                  directedWeaponBeamTargetId,
                );
                if (!targetPosition) return null;

                const attackerIsCreator =
                  selectedShipCreatorSide ??
                  grid[attackerRow]?.[attackerCol]?.isCreator ??
                  false;

                return hologramWeaponFire(
                  hologramFire,
                  isMiningDrill ? (
                    <MiningDrillAnimation
                      gridContainerRef={gridContainerRef}
                      attackerRow={attackerRow}
                      attackerCol={attackerCol}
                      targetRow={targetPosition.row}
                      targetCol={targetPosition.col}
                      facingRight={attackerIsCreator}
                      />
                  ) : (
                    <PlasmaShootingAnimation
                      gridContainerRef={gridContainerRef}
                      attackerRow={attackerRow}
                      attackerCol={attackerCol}
                      targetRow={targetPosition.row}
                      targetCol={targetPosition.col}
                      facingRight={attackerIsCreator}
                      />
                  ),
                );
              })()}

            {/* Railgun Shooting Animation */}
            {selectedShipId &&
              showDirectedWeaponFire &&
              (() => {
                const shipId = selectedShipId;
                if (!shipId) return null;

                // Check if the ship has a Railgun weapon (mainWeapon === 1)
                const ship = shipMap.get(shipId);
                if (!ship || ship.equipment.mainWeapon !== 1) {
                  return null;
                }

                const attackerPos = resolveDirectedAttackerPos({
                  previewPosition,
                  draggedShipId,
                  dragOverCell,
                  selectedShipId,
                  shipId,
                  findShipPositionById,
                });
                if (!attackerPos) return null;
                const { row: attackerRow, col: attackerCol } = attackerPos;

                if (!directedWeaponBeamTargetId) return null;
                const targetPosition = findShipPositionById(
                  directedWeaponBeamTargetId,
                );
                if (!targetPosition) return null;

                const attackerIsCreator =
                  selectedShipCreatorSide ??
                  grid[attackerRow]?.[attackerCol]?.isCreator ??
                  false;

                return hologramWeaponFire(
                  hologramFire,
                  <RailgunShootingAnimation
                    gridContainerRef={gridContainerRef}
                    attackerRow={attackerRow}
                    attackerCol={attackerCol}
                    targetRow={targetPosition.row}
                    targetCol={targetPosition.col}
                    facingRight={attackerIsCreator}
                    variant={Number(ship.traits.variant)}
                  />,
                );
              })()}

            {/* Flak Area-of-Effect animation. AoE does not need a locked
                target id; requiring targetShipId === 0 hid the bursts after
                a move tile click cleared the target. */}
            {selectedShipId &&
              selectedWeaponType === "special" &&
              specialType === 3 &&
                hologramWeaponFire(
                  hologramFire,
                  <FlakExplosionAnimation
                    gridContainerRef={gridContainerRef}
                    targetCells={flakEffectCells}
                  />,
                )}

            {/* Lightening Field: blue jagged sparks across every tile in range */}
            {selectedShipId &&
              selectedWeaponType === "special" &&
              specialType === 1 &&
              specialRange != null &&
              isLightningFieldShip(shipMap.get(selectedShipId)) &&
              (() => {
                const origin =
                  previewPosition ??
                  effectiveDragCell ??
                  findShipPositionById(selectedShipId);
                if (!origin) return null;
                const range = requireShipValue("lighteningFieldRange", specialRange);
                return hologramWeaponFire(
                  hologramFire,
                  <LightningFieldAnimation
                    gridContainerRef={gridContainerRef}
                    originRow={origin.row}
                    originCol={origin.col}
                    range={range}
                  />,
                );
              })()}

            {/* EMP wave animation (selected + has a target ship). Variant 2 slot 1 is Lightening Field, not EMP. */}
            {selectedShipId &&
              selectedWeaponType === "special" &&
              specialType === 1 &&
              !isLightningFieldShip(shipMap.get(selectedShipId)) &&
              targetShipId != null &&
              targetShipId !== 0 &&
              (() => {
                const attackerPos = resolveSelectedAttackerPos({
                  previewPosition,
                  draggedShipId,
                  dragOverCell,
                  selectedShipId,
                  findShipPositionById,
                });
                if (!attackerPos) return null;
                const { row: attackerRow, col: attackerCol } = attackerPos;

                const targetPosition = findShipPositionById(targetShipId);

                if (
                  attackerRow === -1 ||
                  attackerCol === -1 ||
                  !targetPosition
                ) {
                  return null;
                }

                return hologramWeaponFire(
                  hologramFire,
                  <EmpWaveAnimation
                    gridContainerRef={gridContainerRef}
                    attackerRow={attackerRow}
                    attackerCol={attackerCol}
                    targetRow={targetPosition.row}
                    targetCol={targetPosition.col}
                  />,
                );
              })()}

            {/* Repair drones animation (selected + has a target ship).
                Variant 1 uses the Repair Drones special; variant 2 uses the
                innate Repair faction ability (weapon type "ram"). */}
            {selectedShipId &&
              targetShipId != null &&
              targetShipId !== 0 &&
              ((selectedWeaponType === "special" &&
                isRepairDronesSpecial(
                  selectedShipId != null
                    ? Number(shipMap.get(selectedShipId)?.traits.variant ?? 1)
                    : 1,
                  specialType,
                )) ||
                (selectedWeaponType === "ram" && factionAbilityIsHeal)) &&
              (() => {
                const attackerPos = resolveSelectedAttackerPos({
                  previewPosition,
                  draggedShipId,
                  dragOverCell,
                  selectedShipId,
                  findShipPositionById,
                });
                if (!attackerPos) return null;
                const { row: attackerRow, col: attackerCol } = attackerPos;

                const targetPosition = findShipPositionById(targetShipId);

                if (
                  attackerRow === -1 ||
                  attackerCol === -1 ||
                  !targetPosition
                ) {
                  return null;
                }

                return hologramWeaponFire(
                  hologramFire,
                  <RepairDroneAnimation
                    gridContainerRef={gridContainerRef}
                    attackerRow={attackerRow}
                    attackerCol={attackerCol}
                    targetRow={targetPosition.row}
                    targetCol={targetPosition.col}
                  />,
                );
              })()}

            {/* Attack drones (variant 2 slot 2): orange swarm that cuts the target. */}
            {selectedShipId &&
              targetShipId != null &&
              targetShipId !== 0 &&
              selectedWeaponType === "special" &&
              isAttackDronesSpecial(
                Number(shipMap.get(selectedShipId)?.traits.variant ?? 1),
                specialType,
              ) &&
              (() => {
                const attackerPos = resolveSelectedAttackerPos({
                  previewPosition,
                  draggedShipId,
                  dragOverCell,
                  selectedShipId,
                  findShipPositionById,
                });
                const targetPosition = findShipPositionById(targetShipId);
                if (!attackerPos || !targetPosition) return null;
                const { row: attackerRow, col: attackerCol } = attackerPos;

                return hologramWeaponFire(
                  hologramFire,
                  <AttackDroneAnimation
                    gridContainerRef={gridContainerRef}
                    attackerRow={attackerRow}
                    attackerCol={attackerCol}
                    targetRow={targetPosition.row}
                    targetCol={targetPosition.col}
                  />,
                );
              })()}

            {/* Damage Labels - grid level; z-40 so the tutorial chevrons (z-[60]) can sit above */}
            {(() => {
                const targetsToShow = collectDamageLabelTargets({
                  grid,
                  allShipPositions,
                  selectedShipId,
                  targetShipId,
                  draggedShipId: effectiveDragShipId,
                  dragOverCell: effectiveDragCell,
                  dragValidTargets: effectiveValidTargets,
                  validTargets,
                  labelTargets,
                  selectedWeaponType,
                  specialType,
                  shipVariant: selectedShipId != null
                    ? shipMap.get(selectedShipId)?.traits.variant
                    : undefined,
                  previewPosition,
                  specialRange,
                  factionAbilityIsHeal,
                });

                const shouldShowRammingLabels = isRammingMovePreview && rammingPreviewPosition != null;

                // Disabled enemies in movement range: show ram labels before the move is staged.
                const ramPreviewTargets: { row: number; col: number }[] = (() => {
                  if (
                    selectedWeaponType !== "ram" ||
                    factionAbilityIsHeal ||
                    !selectedShipId ||
                    previewPosition ||
                    !isCurrentPlayerTurn
                  ) return [];
                  const targets: { row: number; col: number }[] = [];
                  for (let r = 0; r < grid.length; r++) {
                    for (let c = 0; c < grid[r].length; c++) {
                      const cell = grid[r][c];
                      if (!cell || cell.isPreview) continue;
                      if (isShipOwnedByCurrentPlayer(cell.shipId)) continue;
                      const attrs = getShipAttributes(cell.shipId);
                      if (!attrs || attrs.hullPoints > 0) continue;
                      if (!movementTileSet.has(`${r},${c}`)) continue;
                      targets.push({ row: r, col: c });
                    }
                  }
                  return targets;
                })();

                if (
                  targetsToShow.length === 0 &&
                  !shouldShowRammingLabels &&
                  ramPreviewTargets.length === 0
                )
                  return null;

                // Pure cell-unit positioning — no DOM measurements, immune to zoom transforms.
                const cellCx  = (col: number) => `${((col + 0.5) / 17) * 100}%`;
                const cellTopPct    = (row: number) => `${(row / 11) * 100}%`;
                const cellBottomPct = (row: number) => `${((row + 1) / 11) * 100}%`;
                // Labels sit above cell (non-top rows) or below cell (row 0).
                const anchorTop = (row: number) => row === 0 ? cellBottomPct(row) : cellTopPct(row);
                const anchorTransform = (row: number) => row === 0 ? "translate(-50%, 0)" : "translate(-50%, -100%)";

                return (
                  <div className="absolute inset-0 pointer-events-none z-40">
                    {targetsToShow.map((target) => {
                      const isFactionHealPreview =
                        selectedWeaponType === "ram" && factionAbilityIsHeal;
                      const factionHealAmount = factionAbilityStrength ?? 50;
                      const selectedVariant =
                        selectedShipId != null
                          ? Number(shipMap.get(selectedShipId)?.traits.variant ?? 1)
                          : 1;
                      const isRepairDronesPreview =
                        selectedWeaponType === "special" &&
                        isRepairDronesSpecial(selectedVariant, specialType);
                      const isAttackDronesPreview =
                        selectedWeaponType === "special" &&
                        isAttackDronesSpecial(selectedVariant, specialType);

                      const damage = calculateDamage(
                        target.shipId,
                        selectedWeaponType === "ram" ? "weapon" : selectedWeaponType,
                        selectedWeaponType === "special" && specialType === 3
                          ? true
                          : undefined,
                      );

                      const showAsKill = damage.willKill;
                      const targetAttributes = getShipAttributes(target.shipId);
                      const willDestroyByReactor =
                        damage.reactorCritical &&
                        !!targetAttributes &&
                        targetAttributes.reactorCriticalTimer + 1 >= 3;
                      const isSelectedSosTarget =
                        target.shipId === targetShipId &&
                        showAsKill &&
                        !willDestroyByReactor;
                      let labelText: string;
                      if (isFactionHealPreview) {
                        labelText = useCompactMobileDamageLabels
                          ? String(factionHealAmount)
                          : `REPAIR ${factionHealAmount} HP`;
                      } else if (useCompactMobileDamageLabels) {
                        labelText = isSelectedSosTarget
                          ? "[SOS]"
                          : String(damage.reducedDamage);
                      } else if (selectedWeaponType === "special") {
                        if (specialType === 3 || isAttackDronesPreview) {
                          if (willDestroyByReactor) {
                            labelText = "[DESTROY]";
                          } else if (damage.reactorCritical) {
                            labelText = "REACTOR +1";
                          } else if (isSelectedSosTarget) {
                            labelText = "[SOS]";
                          } else if (showAsKill) {
                            labelText = `[✕] ${damage.reducedDamage} DMG`;
                          } else {
                            labelText = `${damage.reducedDamage} DMG`;
                          }
                        } else if (specialType === 1) {
                          labelText = willDestroyByReactor
                            ? "[DESTROY]"
                            : "REACTOR DMG";
                        } else if (isRepairDronesPreview) {
                          labelText = `REPAIR ${damage.reducedDamage} HP`;
                        } else {
                          labelText = `${damage.reducedDamage} DMG`;
                        }
                      } else if (willDestroyByReactor) {
                        labelText = "[DESTROY]";
                      } else if (damage.reactorCritical) {
                        labelText = "REACTOR +1";
                      } else if (isSelectedSosTarget) {
                        labelText = "[SOS]";
                      } else if (showAsKill) {
                        labelText = `[✕] ${damage.reducedDamage} DMG`;
                      } else {
                        labelText = `${damage.reducedDamage} DMG`;
                      }

                      return (
                        <div
                          key={target.shipId.toString()}
                          className={`absolute rounded-none font-mono text-center text-white whitespace-nowrap ${
                            useCompactMobileDamageLabels
                              ? "px-1.5 py-0.5 text-[11px] font-bold"
                              : "px-2 py-1 text-xs"
                          } ${
                            isFactionHealPreview || isRepairDronesPreview
                              ? "bg-cyan/60 border border-cyan"
                              : selectedWeaponType === "special"
                              ? specialType === 3
                                ? "bg-amber/60 border border-amber"
                                : specialType === 1
                                  ? "bg-warning-red/60 border border-warning-red"
                                  : "bg-warning-red/60 border border-warning-red"
                              : "bg-warning-red/60 border border-warning-red"
                          }`}
                          style={{
                            left: cellCx(target.col),
                            top: anchorTop(target.row),
                            transform: anchorTransform(target.row),
                          }}
                        >
                          {labelText}
                        </div>
                      );
                    })}
                    {(() => {
                      // Staged ram preview labels
                      if (!isRammingMovePreview || !rammingPreviewPosition) {
                        return null;
                      }
                      const { row, col } = rammingPreviewPosition;
                      const isTopGridRow = row === 0;
                      const top = isTopGridRow ? cellBottomPct(row) : cellTopPct(row);
                      return (
                        <>
                          <div
                            className="absolute rounded-none px-2 py-1 text-xs font-mono text-center text-white whitespace-nowrap border border-warning-red bg-warning-red/60"
                            style={{
                              left: cellCx(col),
                              top,
                              transform: isTopGridRow ? "translate(-50%, 0)" : "translate(-50%, calc(-100% - 30px))",
                            }}
                          >
                            RAMMING SPEED
                          </div>
                          <div
                            className="absolute rounded-none px-2 py-1 text-xs font-mono text-center text-white whitespace-nowrap flex items-center gap-1"
                            style={{
                              left: cellCx(col),
                              top,
                              transform: anchorTransform(row),
                              backgroundColor: "rgba(255, 119, 0, 0.75)",
                              borderWidth: 1,
                              borderStyle: "solid",
                              borderColor: "#ff7700",
                            }}
                          >
                            <span className="flex shrink-0 items-center justify-center rounded-full bg-warning-red/90 leading-none" style={{ width: 10, height: 10, fontSize: 7 }}>✕</span>
                            WARNING: OVERLOAD
                            <span className="flex shrink-0 items-center justify-center rounded-full bg-warning-red/90 leading-none" style={{ width: 10, height: 10, fontSize: 7 }}>✕</span>
                          </div>
                        </>
                      );
                    })()}
                    {ramPreviewTargets.map(({ row, col }) => {
                      const isTopGridRow = row === 0;
                      const top = isTopGridRow ? cellBottomPct(row) : cellTopPct(row);
                      return (
                        <React.Fragment key={`ram-preview-${row}-${col}`}>
                          <div
                            className="absolute rounded-none px-2 py-1 text-xs font-mono text-center text-white whitespace-nowrap border border-warning-red bg-warning-red/60"
                            style={{
                              left: cellCx(col),
                              top,
                              transform: isTopGridRow ? "translate(-50%, 0)" : "translate(-50%, calc(-100% - 30px))",
                            }}
                          >
                            RAMMING SPEED
                          </div>
                          <div
                            className="absolute rounded-none px-2 py-1 text-xs font-mono text-center text-white whitespace-nowrap flex items-center gap-1"
                            style={{
                              left: cellCx(col),
                              top,
                              transform: anchorTransform(row),
                              backgroundColor: "rgba(255, 119, 0, 0.75)",
                              borderWidth: 1,
                              borderStyle: "solid",
                              borderColor: "#ff7700",
                            }}
                          >
                            <span className="flex shrink-0 items-center justify-center rounded-full bg-warning-red/90 leading-none" style={{ width: 10, height: 10, fontSize: 7 }}>✕</span>
                            WARNING: OVERLOAD
                            <span className="flex shrink-0 items-center justify-center rounded-full bg-warning-red/90 leading-none" style={{ width: 10, height: 10, fontSize: 7 }}>✕</span>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                );
              })()}

            {/* Tutorial click targets: the tap ripple on the cell and a chevron
                (with the choice's name, when it has one) pointing at it. The
                cell draws the brackets (GameGridCell); highlight-only cells
                (hideLabel) get nothing here. Grid-level z-[60] so they sit
                above damage labels (z-40). The chevron follows the damage
                labels' rule: above the cell except row 0 (below, pointing
                up), nudged clear of a damage label on the same ship. */}
            {(() => {
              if (!tutorialHighlightCells?.length) return null;

              // Pure cell-unit positioning — no DOM measurements, immune to zoom transforms.
              const cellCx = (col: number) => `${((col + 0.5) / 17) * 100}%`;
              const cellTopPct = (row: number) => `${(row / 11) * 100}%`;
              const cellBottomPct = (row: number) => `${((row + 1) / 11) * 100}%`;

              return (
                <div className="absolute inset-0 pointer-events-none z-[60]">
                  {tutorialHighlightCells.map((p, i) => {
                    if (p.hideLabel) return null;
                    const cell = grid[p.row]?.[p.col];
                    const shipId = cell?.shipId;
                    const targetsForLabels = labelTargets ?? validTargets;
                    const hasSingleSelectedTarget =
                      targetShipId != null && targetShipId !== 0;
                    const damageLabelOnThisShip =
                      shipId != null &&
                      selectedShipId != null &&
                      !isShipOwnedByCurrentPlayer(shipId) &&
                      (hasSingleSelectedTarget
                        ? targetShipId === shipId
                        : targetsForLabels.some((t) => t.shipId === shipId));
                    const isTopGridRow = p.row === 0;
                    const nudge = damageLabelOnThisShip ? (isTopGridRow ? 28 : -32) : 0;
                    const label = p.label;
                    return (
                      <React.Fragment key={`tutorial-target-${p.row}-${p.col}-${i}`}>
                        <div
                          className="absolute"
                          style={{
                            left: `${(p.col / 17) * 100}%`,
                            top: cellTopPct(p.row),
                            width: `${100 / 17}%`,
                            height: `${100 / 11}%`,
                          }}
                        >
                          <span className="vt-target" aria-hidden>
                            <span className="vt-target-ripple" />
                          </span>
                        </div>
                        <TutorialTargetPointer
                          label={label}
                          below={isTopGridRow}
                          style={{
                            left: cellCx(p.col),
                            top: `calc(${isTopGridRow ? cellBottomPct(p.row) : cellTopPct(p.row)} + ${nudge}px)`,
                          }}
                        />
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}
          </div>
  );
});
