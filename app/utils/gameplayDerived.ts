import { ActionType } from "../types/types";
import type { GridShipPosition } from "../types/gridDisplay";
import { isRepairDronesSpecial } from "./specialConfigWeb2";

// Battle UI state derived from the current selection, shared by
// useGameplayInteraction (web3 and web2 battles) and the tutorial
// (SimulatedGameDisplay), so the three views stage, label and draw a move
// the same way. Pure, number ids (the grid display convention).

type WeaponType = "weapon" | "special" | "ram";

/**
 * Whether the selected ship's staged-move UI (Submit/Cancel, confirm
 * widget) shows: your own ship, on your turn, that hasn't moved (a disabled
 * ship can still retreat). A submitted move stays up until it settles.
 */
export function computeIsShowingProposedMove({
  hasSelection,
  isOwnShip,
  isSubmitting,
  isMyTurn,
  hasMoved,
  isDisabled,
}: {
  hasSelection: boolean;
  isOwnShip: boolean;
  isSubmitting: boolean;
  isMyTurn: boolean;
  hasMoved: boolean;
  isDisabled: boolean;
}): boolean {
  if (!hasSelection || !isOwnShip) return false;
  if (isSubmitting) return true;
  if (!isMyTurn) return false;
  if (hasMoved && !isDisabled) return false;
  return true;
}

/**
 * The action the staged move submits. An explicit override (Retreat) wins;
 * a legacy ram (moving onto a disabled enemy) is a Pass the contract infers
 * the ram from; then a ram/repair target (FactionAbility, where supported),
 * a weapon or special target, Flak's self-centred special (target 0), or a
 * plain move (Pass).
 */
export function computeActionType({
  actionOverride,
  isRammingMovePreview,
  targetShipId,
  selectedWeaponType,
  specialType,
  isFactionAbilitySupported,
}: {
  actionOverride: ActionType | null;
  isRammingMovePreview: boolean;
  targetShipId: number | null;
  selectedWeaponType: WeaponType;
  specialType: number;
  isFactionAbilitySupported: boolean;
}): ActionType {
  if (actionOverride != null) return actionOverride;
  if (isRammingMovePreview) return ActionType.Pass;
  const hasTarget = targetShipId !== null && targetShipId !== 0;
  if (selectedWeaponType === "ram" && isFactionAbilitySupported && hasTarget) {
    return ActionType.FactionAbility;
  }
  if (hasTarget) return selectedWeaponType === "special" ? ActionType.Special : ActionType.Shoot;
  if (targetShipId === 0 && selectedWeaponType === "special" && specialType === 3) {
    return ActionType.Special;
  }
  return ActionType.Pass;
}

/** The confirm button's label for the staged move (callers show "[...]" while it submits). */
export function computeConfirmWidgetLabel({
  actionType,
  selectedWeaponType,
  shipVariant,
  specialType,
  targetShipId,
  factionAbilityIsHeal,
}: {
  actionType: ActionType;
  selectedWeaponType: WeaponType;
  shipVariant: number;
  specialType: number;
  targetShipId: number | null;
  factionAbilityIsHeal: boolean;
}): string {
  if (actionType === ActionType.Retreat) return "RETREAT";
  if (actionType === ActionType.Pass) return "HOLD FIRE";
  if (actionType === ActionType.FactionAbility) return factionAbilityIsHeal ? "REPAIR" : "RAM";
  if (
    selectedWeaponType === "special" &&
    isRepairDronesSpecial(shipVariant, specialType) &&
    targetShipId != null
  ) {
    return "REPAIR";
  }
  if (targetShipId != null && targetShipId !== 0) return "FIRE";
  return "SUBMIT";
}

/** The last move, as the board draws it. */
/**
 * The board's cells: alive ships and the selected ship's staged destination
 * as a preview copy. (Moves play back on the board instead of leaving a
 * last-move ghost: MovePlaybackLayer.)
 */
export function buildDisplayGrid({
  gridWidth,
  gridHeight,
  aliveShipPositions,
  selectedShipId,
  previewPosition,
  hidePreview,
}: {
  gridWidth: number;
  gridHeight: number;
  aliveShipPositions: readonly GridShipPosition[];
  selectedShipId: number | null;
  previewPosition: { row: number; col: number } | null;
  /** No staged-move ghost (while submitting, the board shows the predicted result). */
  hidePreview: boolean;
}): (GridShipPosition | null)[][] {
  const inBounds = (row: number, col: number) =>
    row >= 0 && row < gridHeight && col >= 0 && col < gridWidth;
  const grid: (GridShipPosition | null)[][] = Array.from({ length: gridHeight }, () =>
    Array<GridShipPosition | null>(gridWidth).fill(null),
  );

  aliveShipPositions.forEach((shipPosition) => {
    const { position } = shipPosition;
    if (!inBounds(position.row, position.col)) return;
    grid[position.row][position.col] = shipPosition;
    if (selectedShipId === shipPosition.shipId && previewPosition && !hidePreview) {
      grid[previewPosition.row][previewPosition.col] = {
        ...shipPosition,
        position: { row: previewPosition.row, col: previewPosition.col },
        isPreview: true,
      };
    }
  });

  return grid;
}
