import { GridShipPosition } from "../types/gridDisplay";
import { isLightningFieldSpecial, isRepairDronesSpecial } from "./specialConfigWeb2";
import { requireShipValue } from "./requireShipValue";

function isGridSet(grid: boolean[][] | undefined, row: number, col: number): boolean {
  // Strict `=== true` so a scoring-points number[][] (or any other truthy
  // non-boolean cell) never counts as a blocked/impassable bit. Scoring is
  // a separate mapping in Maps.sol and is not part of either bitmap.
  const r = Number(row);
  const c = Number(col);
  return grid?.[r]?.[c] === true;
}

function isOutOfGrid(grid: boolean[][] | undefined, row: number, col: number): boolean {
  if (!grid || grid.length === 0) return false;
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  return row < 0 || col < 0 || row >= height || col >= width;
}

function isPathTileBlocked(
  terrainGrid: boolean[][] | undefined,
  extraGrid: boolean[][] | undefined,
  row: number,
  col: number,
): boolean {
  // Maps._isTileBlockedSafe treats out-of-bounds as blocked.
  if (isOutOfGrid(terrainGrid, row, col) || isOutOfGrid(extraGrid, row, col)) {
    return true;
  }
  return isGridSet(terrainGrid, row, col) || isGridSet(extraGrid, row, col);
}

/**
 * Enemy-occupied tiles for Maps.hasMovementPathAvoidingShips /
 * hasMapsAvoidingShips. Allies are omitted: they still block landing on
 * their exact tile (handled by occupancy checks), but they do not block
 * movement-through or line of sight. Disabled (0 HP) enemies are omitted
 * the same way: they still block landing on their tile, but no longer
 * block movement-through or line of sight. See
 * docs/eth-global-remote/frontend-handoff-combat-blocking-and-ship-specials-2026-09-26.md §1
 * and docs/eth-global-remote/frontend-handoff-engine-registry-and-redeploy-2026-09-30.md §3.
 */
export function buildEnemyOccupiedGrid(
  gridWidth: number,
  gridHeight: number,
  shipPositions: readonly {
    shipId: number | bigint | string;
    position: { row: number; col: number };
    isCreator: boolean;
  }[],
  actingShipId: number | bigint | string,
  actingIsCreator: boolean,
  isDisabled?: (shipId: number | bigint | string) => boolean,
): boolean[][] {
  const grid: boolean[][] = Array.from({ length: gridHeight }, () =>
    Array<boolean>(gridWidth).fill(false),
  );
  const actingKey = String(actingShipId);
  for (const pos of shipPositions) {
    if (String(pos.shipId) === actingKey) continue;
    if (pos.isCreator === actingIsCreator) continue;
    if (isDisabled?.(pos.shipId)) continue;
    const row = Number(pos.position.row);
    const col = Number(pos.position.col);
    if (
      Number.isFinite(row) &&
      Number.isFinite(col) &&
      row >= 0 &&
      row < gridHeight &&
      col >= 0 &&
      col < gridWidth
    ) {
      grid[row][col] = true;
    }
  }
  return grid;
}

export function hasLineOfSight(
  row0: number,
  col0: number,
  row1: number,
  col1: number,
  blockedGrid: boolean[][],
  extraBlockingGrid?: boolean[][],
): boolean {
  if (isGridSet(blockedGrid, row0, col0)) return false;

  if (row0 === row1 && col0 === col1) {
    return !isGridSet(blockedGrid, row1, col1);
  }

  const dRow = Math.abs(row1 - row0);
  const dCol = Math.abs(col1 - col0);
  const sRow = row1 > row0 ? 1 : row1 < row0 ? -1 : 0;
  const sCol = col1 > col0 ? 1 : col1 < col0 ? -1 : 0;

  let err = dCol - dRow;
  let row = row0;
  let col = col0;

  while (true) {
    if (row === row1 && col === col1) {
      // Dest terrain still blocks (nebula). An enemy standing on the dest
      // tile is the target, so extra occupancy does not block dest.
      return !isGridSet(blockedGrid, row1, col1);
    }

    const e2 = err * 2;

    if (e2 === 0) {
      if (
        isPathTileBlocked(blockedGrid, extraBlockingGrid, row, col + sCol) &&
        isPathTileBlocked(blockedGrid, extraBlockingGrid, row + sRow, col)
      ) {
        return false;
      }
      col += sCol;
      err -= dRow;
      row += sRow;
      err += dCol;
      if (
        (row !== row1 || col !== col1) &&
        isPathTileBlocked(blockedGrid, extraBlockingGrid, row, col)
      ) {
        return false;
      }
      continue;
    }

    if (e2 > -dRow) {
      err -= dRow;
      col += sCol;
      if (
        (row !== row1 || col !== col1) &&
        isPathTileBlocked(blockedGrid, extraBlockingGrid, row, col)
      ) {
        return false;
      }
    }

    if (e2 < dCol) {
      err += dCol;
      row += sRow;
      if (
        (row !== row1 || col !== col1) &&
        isPathTileBlocked(blockedGrid, extraBlockingGrid, row, col)
      ) {
        return false;
      }
    }
  }
}

// Movement counterpart to hasLineOfSight — same straight-line (Bresenham)
// walk and permissive-corner diagonal rule, but against the impassable
// bitmap instead of the blocked one, and WITHOUT hasLineOfSight's "start
// tile blocked ⇒ false" exception: a ship standing on a tile can always
// leave it, even if that tile is later marked impassable. Mirrors
// Maps.sol's hasMovementPath exactly. See
// docs/eth-global-remote/frontend-handoff-maps-and-deployment-zones-2026-09-23.md §1.
// Optional extraBlockingGrid is OR'd in the same way Maps.hasMovementPathAvoidingShips
// ORs the enemy-occupied bitmap (2026-09-26 combat-blocking doc §1).
export function hasMovementPath(
  row0: number,
  col0: number,
  row1: number,
  col1: number,
  impassableGrid?: boolean[][],
  extraBlockingGrid?: boolean[][],
): boolean {
  // Maps.hasMovementPath / hasMovementPathAvoidingShips: same-cell is
  // "already there; not a move" and returns true even on impassable terrain.
  if (row0 === row1 && col0 === col1) {
    return true;
  }

  const dRow = Math.abs(row1 - row0);
  const dCol = Math.abs(col1 - col0);
  const sRow = row1 > row0 ? 1 : row1 < row0 ? -1 : 0;
  const sCol = col1 > col0 ? 1 : col1 < col0 ? -1 : 0;

  let err = dCol - dRow;
  let row = row0;
  let col = col0;

  while (true) {
    if (row === row1 && col === col1) {
      // Maps._bresenhamMaps dest: return !_isTileBlockedSafe(_bitmap, dest)
      // where _bitmap is impassable, or impassable | enemyOccupied for
      // hasMovementPathAvoidingShips. Scoring tiles are not in that bitmap.
      return !isPathTileBlocked(impassableGrid, extraBlockingGrid, row1, col1);
    }

    const e2 = err * 2;

    if (e2 === 0) {
      if (
        isPathTileBlocked(impassableGrid, extraBlockingGrid, row, col + sCol) &&
        isPathTileBlocked(impassableGrid, extraBlockingGrid, row + sRow, col)
      ) {
        return false;
      }
      col += sCol;
      err -= dRow;
      row += sRow;
      err += dCol;
      if (
        (row !== row1 || col !== col1) &&
        isPathTileBlocked(impassableGrid, extraBlockingGrid, row, col)
      ) {
        return false;
      }
      continue;
    }

    if (e2 > -dRow) {
      err -= dRow;
      col += sCol;
      if (
        (row !== row1 || col !== col1) &&
        isPathTileBlocked(impassableGrid, extraBlockingGrid, row, col)
      ) {
        return false;
      }
    }

    if (e2 < dCol) {
      err += dCol;
      row += sRow;
      if (
        (row !== row1 || col !== col1) &&
        isPathTileBlocked(impassableGrid, extraBlockingGrid, row, col)
      ) {
        return false;
      }
    }
  }
}

export type ConfirmWidgetSide = "below" | "above" | "right" | "left";

export type ConfirmWidgetAnchor = {
  left: string;
  top: string;
  transform: string;
  side: ConfirmWidgetSide;
  destRow: number;
  destCol: number;
} | null;

/**
 * Compute the best placement for the grid's confirm-move widget to avoid
 * covering the target ship, weapon beam path, and move arrow. Tries
 * below → above → right → left in priority order adjusted for movement
 * direction, skipping positions that cover the target or leave the grid.
 * Extracted verbatim from `GameGrid.tsx` — same logic, same output.
 */
/** Extra pixels so the weapon selector / confirm bar clears a self-effect label. */
export const SELF_EFFECT_LABEL_CLEARANCE_PX = 36;

/** True when the acting ship itself gets a heal/field label (Repair, Repair Drones, Lightening Field). */
export function selectedShipHasEffectLabel(params: {
  selectedShipId: number | null;
  targetShipId: number | null;
  selectedWeaponType: "weapon" | "special" | "ram";
  specialType: number;
  shipVariant?: number;
  factionAbilityIsHeal?: boolean;
}): boolean {
  const {
    selectedShipId,
    targetShipId,
    selectedWeaponType,
    specialType,
    shipVariant,
    factionAbilityIsHeal = false,
  } = params;
  if (selectedShipId == null) return false;
  if (targetShipId === selectedShipId) return true;
  if (selectedWeaponType === "ram" && factionAbilityIsHeal) return true;
  if (
    selectedWeaponType === "special" &&
    isRepairDronesSpecial(shipVariant ?? 1, specialType)
  ) {
    return true;
  }
  if (
    selectedWeaponType === "special" &&
    isLightningFieldSpecial(shipVariant ?? 0, specialType)
  ) {
    return true;
  }
  return false;
}

export function computeConfirmWidgetAnchor(params: {
  showConfirmWidget: boolean;
  previewPosition: { row: number; col: number } | null;
  selectedShipId: number | null;
  targetShipId: number | null;
  grid: (GridShipPosition | null)[][];
  allShipPositions?: readonly GridShipPosition[];
  selfHasEffectLabel?: boolean;
  /** Player override: pin the widget above or below the dest cell when that side fits. */
  preferredVertical?: "above" | "below" | null;
}): ConfirmWidgetAnchor {
  const {
    showConfirmWidget,
    previewPosition,
    selectedShipId,
    targetShipId,
    grid,
    allShipPositions,
    selfHasEffectLabel = false,
    preferredVertical = null,
  } = params;

  if (!showConfirmWidget) return null;

  // Resolve the anchor cell: target ship always wins when one is selected,
  // otherwise fall back to staged destination, then selected ship's current cell.
  let destRow = 0, destCol = 0;
  const hasRealTarget = targetShipId != null && targetShipId !== 0;
  if (hasRealTarget) {
    let found = false;
    outer0: for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c]?.shipId === targetShipId) {
          destRow = r; destCol = c; found = true; break outer0;
        }
      }
    }
    if (!found && allShipPositions) {
      const sp = allShipPositions.find((p) => p.shipId === targetShipId);
      if (sp) { destRow = sp.position.row; destCol = sp.position.col; found = true; }
    }
    if (!found) return null;
  } else if (previewPosition) {
    destRow = previewPosition.row;
    destCol = previewPosition.col;
  } else {
    let found = false;
    if (selectedShipId) {
      outer0: for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c]?.shipId === selectedShipId) {
            destRow = r; destCol = c; found = true; break outer0;
          }
        }
      }
      if (!found && allShipPositions) {
        const sp = allShipPositions.find((p) => p.shipId === selectedShipId);
        if (sp) { destRow = sp.position.row; destCol = sp.position.col; found = true; }
      }
    }
    if (!found) return null;
  }

  // Find the ship's current (non-preview) cell to know the movement direction
  let shipRow = destRow, shipCol = destCol;
  outer: for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell?.shipId === selectedShipId && !cell.isPreview) {
        shipRow = r; shipCol = c;
        break outer;
      }
    }
  }

  // Find the target ship's cell (if any)
  let targetRow: number | null = null, targetCol: number | null = null;
  if (targetShipId) {
    outer2: for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c]?.shipId === targetShipId) {
          targetRow = r; targetCol = c;
          break outer2;
        }
      }
    }
    // Fallback: allShipPositions
    if (targetRow === null && allShipPositions) {
      const sp = allShipPositions.find((p) => p.shipId === targetShipId);
      if (sp) { targetRow = sp.position.row; targetCol = sp.position.col; }
    }
  }

  type Side = "below" | "above" | "right" | "left";

  // Approximate grid cells covered by the widget for each placement.
  // Widget is ~2.5 cols wide and ~1 row tall.
  const covers = (side: Side): { rMin: number; rMax: number; cMin: number; cMax: number } => {
    switch (side) {
      case "below": return { rMin: destRow + 1, rMax: destRow + 1, cMin: destCol - 1, cMax: destCol + 1 };
      case "above": return { rMin: destRow - 1, rMax: destRow - 1, cMin: destCol - 1, cMax: destCol + 1 };
      case "right": return { rMin: destRow,     rMax: destRow,     cMin: destCol + 1, cMax: destCol + 2 };
      case "left":  return { rMin: destRow,     rMax: destRow,     cMin: destCol - 2, cMax: destCol - 1 };
    }
  };

  const inBounds = (side: Side) => {
    switch (side) {
      case "below": return destRow < 10;
      case "above": return destRow > 0;
      case "right": return destCol <= 14;
      case "left":  return destCol >= 2;
    }
  };

  const conflictsTarget = (side: Side) => {
    if (targetRow === null || targetCol === null) return false;
    const { rMin, rMax, cMin, cMax } = covers(side);
    return targetRow >= rMin && targetRow <= rMax && targetCol >= cMin && targetCol <= cMax;
  };

  // Build priority order: prefer sides perpendicular to movement direction,
  // and prefer opposite to where the attack beam points (toward target).
  const dr = destRow - shipRow;
  const dc = destCol - shipCol;
  const tdr = targetRow !== null ? targetRow - destRow : 0;
  const tdc = targetCol !== null ? targetCol - destCol : 0;

  // "away from target" direction
  const targetBelow = tdr > 0, targetAbove = tdr < 0;
  const targetRight = tdc > 0, targetLeft  = tdc < 0;

  // "incoming arrow" direction
  const arrowFromAbove = dr > 0, arrowFromBelow = dr < 0;
  const arrowFromLeft  = dc > 0, arrowFromRight = dc < 0;

  // Score each side: lower = preferred
  const score = (side: Side): number => {
    let s = 0;
    // Avoid sides where the target is
    if (side === "below" && targetBelow) s += 10;
    if (side === "above" && targetAbove) s += 10;
    if (side === "right" && targetRight) s += 10;
    if (side === "left"  && targetLeft)  s += 10;
    // Prefer sides not in the arrow's incoming path
    if (side === "above" && arrowFromAbove) s += 3;
    if (side === "below" && arrowFromBelow) s += 3;
    if (side === "left"  && arrowFromLeft)  s += 3;
    if (side === "right" && arrowFromRight) s += 3;
    // Prefer below/above over left/right (fits better visually)
    if (side === "right" || side === "left") s += 1;
    return s;
  };

  const sides: Side[] = ["below", "above", "right", "left"];
  const sorted = sides
    .filter(inBounds)
    .sort((a, b) => score(a) - score(b));

  // Pick the best side that doesn't conflict; fall back to any valid side
  let best = sorted.find((s) => !conflictsTarget(s)) ?? sorted[0] ?? "below";
  if (preferredVertical && inBounds(preferredVertical)) {
    best = preferredVertical;
  }

  const L = `${((destCol + 0.5) / 17) * 100}%`;
  const Lright = `${((destCol + 1) / 17) * 100}%`;
  const Lleft = `${(destCol / 17) * 100}%`;
  const Tmid = `${((destRow + 0.5) / 11) * 100}%`;

  // Self-effect labels sit above the cell (below on row 0). Nudge the widget
  // off that edge so the REPAIR / field readout stays visible.
  const labelOnDest =
    selfHasEffectLabel &&
    (targetShipId == null || targetShipId === 0 || targetShipId === selectedShipId);
  const labelSide: Side | null = labelOnDest
    ? destRow === 0
      ? "below"
      : "above"
    : null;
  const extra =
    labelSide != null && best === labelSide ? SELF_EFFECT_LABEL_CLEARANCE_PX : 0;

  switch (best) {
    case "below": return { left: L,      top: `${((destRow + 1) / 11) * 100}%`, transform: `translate(-50%, ${3 + extra}px)`, side: "below", destRow, destCol };
    case "above": return { left: L,      top: `${(destRow / 11) * 100}%`,        transform: `translate(-50%, calc(-100% - ${3 + extra}px))`, side: "above", destRow, destCol };
    case "right": return { left: Lright, top: Tmid,                               transform: "translate(4px, -50%)", side: "right", destRow, destCol };
    case "left":  return { left: Lleft,  top: Tmid,                               transform: "translate(calc(-100% - 4px), -50%)", side: "left", destRow, destCol };
  }
}

export type DamageLabelTarget = { shipId: number; row: number; col: number };

function findShipCell(
  grid: (GridShipPosition | null)[][],
  allShipPositions: readonly GridShipPosition[] | undefined,
  shipId: number,
): { row: number; col: number } | null {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell?.shipId === shipId && !cell.isPreview) {
        return { row: r, col: c };
      }
    }
  }
  const fallback = allShipPositions?.find((sp) => sp.shipId === shipId && !sp.isPreview)
    ?? allShipPositions?.find((sp) => sp.shipId === shipId);
  return fallback
    ? { row: fallback.position.row, col: fallback.position.col }
    : null;
}

/** Lightening Field hits every ship in range of the field origin, including the caster. */
function collectLightningFieldLabelTargets(params: {
  grid: (GridShipPosition | null)[][];
  allShipPositions?: readonly GridShipPosition[];
  selectedShipId: number;
  previewPosition: { row: number; col: number } | null;
  dragOverCell: { row: number; col: number } | null;
  range?: number;
}): DamageLabelTarget[] {
  const { grid, allShipPositions, selectedShipId, previewPosition, dragOverCell } = params;
  const origin =
    previewPosition ??
    dragOverCell ??
    findShipCell(grid, allShipPositions, selectedShipId);
  if (!origin) return [];

  const range = requireShipValue("lighteningFieldRange", params.range);
  const targets: DamageLabelTarget[] = [];
  const seen = new Set<number>();
  const add = (shipId: number, row: number, col: number) => {
    if (seen.has(shipId)) return;
    seen.add(shipId);
    targets.push({ shipId, row, col });
  };

  add(selectedShipId, origin.row, origin.col);

  const consider = (shipId: number, row: number, col: number, isPreview?: boolean) => {
    if (shipId === selectedShipId || isPreview) return;
    const dist = Math.abs(row - origin.row) + Math.abs(col - origin.col);
    if (dist <= range) add(shipId, row, col);
  };

  if (allShipPositions && allShipPositions.length > 0) {
    for (const sp of allShipPositions) {
      consider(sp.shipId, sp.position.row, sp.position.col, sp.isPreview);
    }
  } else {
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        consider(cell.shipId, r, c, cell.isPreview);
      }
    }
  }

  return targets;
}

/** Same target list as the floating damage-label overlay (keeps destroy-preview art in sync). */
export function collectDamageLabelTargets(params: {
  grid: (GridShipPosition | null)[][];
  allShipPositions?: readonly GridShipPosition[];
  selectedShipId: number | null;
  targetShipId: number | null;
  draggedShipId: number | null;
  dragOverCell: { row: number; col: number } | null;
  dragValidTargets: Array<{
    shipId: number;
    position: { row: number; col: number };
  }>;
  validTargets: Array<{
    shipId: number;
    position: { row: number; col: number };
  }>;
  labelTargets?: Array<{
    shipId: number;
    position: { row: number; col: number };
  }>;
  selectedWeaponType: "weapon" | "special" | "ram";
  specialType: number;
  shipVariant?: number;
  previewPosition?: { row: number; col: number } | null;
  specialRange?: number;
  factionAbilityIsHeal?: boolean;
}): DamageLabelTarget[] {
  const {
    grid,
    allShipPositions,
    selectedShipId,
    targetShipId,
    draggedShipId,
    dragOverCell,
    dragValidTargets,
    validTargets,
    labelTargets,
    selectedWeaponType,
    specialType,
    shipVariant,
    previewPosition,
    specialRange,
    factionAbilityIsHeal = false,
  } = params;

  const isFactionHeal = selectedWeaponType === "ram" && factionAbilityIsHeal;

  // RAM mode has no weapon damage labels; ram-specific labels are rendered separately.
  // Variant 2 Repair uses the same "ram" weapon slot but shows heal labels.
  if (selectedWeaponType === "ram" && !isFactionHeal) return [];

  if (
    selectedWeaponType === "special" &&
    selectedShipId != null &&
    isLightningFieldSpecial(shipVariant ?? 0, specialType)
  ) {
    if (specialRange == null) return [];
    return collectLightningFieldLabelTargets({
      grid,
      allShipPositions,
      selectedShipId,
      previewPosition: previewPosition ?? null,
      dragOverCell,
      range: requireShipValue("lighteningFieldRange", specialRange),
    });
  }

  const targetsToShow: DamageLabelTarget[] = [];
  const selectedShipSide =
    selectedShipId != null
      ? (() => {
          for (let r = 0; r < grid.length; r++) {
            const row = grid[r];
            for (let c = 0; c < row.length; c++) {
              const cell = row[c];
              if (cell?.shipId === selectedShipId) {
                return cell.isCreator;
              }
            }
          }
          const fallback = allShipPositions?.find(
            (sp) => sp.shipId === selectedShipId,
          );
          return fallback?.isCreator ?? null;
        })()
      : null;

  const shouldShowTargetLabel = (
    shipId: number,
    fallbackIsCreator?: boolean,
  ) => {
    if (selectedShipSide == null) return true;
    const targetSide =
      fallbackIsCreator ??
      (() => {
        for (let r = 0; r < grid.length; r++) {
          const row = grid[r];
          for (let c = 0; c < row.length; c++) {
            const cell = row[c];
            if (cell?.shipId === shipId) return cell.isCreator;
          }
        }
        const fallback = allShipPositions?.find((sp) => sp.shipId === shipId);
        return fallback?.isCreator;
      })();
    if (targetSide == null) return true;

    if (
      (selectedWeaponType === "special" &&
        isRepairDronesSpecial(shipVariant ?? 1, specialType)) ||
      isFactionHeal
    ) {
      return targetSide === selectedShipSide;
    }
    return targetSide !== selectedShipSide;
  };

  const pushTargetIfAllowed = (
    shipId: number,
    row: number,
    col: number,
    fallbackIsCreator?: boolean,
  ) => {
    if (!shouldShowTargetLabel(shipId, fallbackIsCreator)) return;
    if (targetsToShow.some((t) => t.shipId === shipId)) return;
    targetsToShow.push({ shipId, row, col });
  };

  if (targetShipId) {
    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell && cell.shipId === targetShipId) {
          pushTargetIfAllowed(cell.shipId, r, c, cell.isCreator);
        }
      });
    });
  }

  if (draggedShipId && dragOverCell) {
    dragValidTargets.forEach((target) => {
      pushTargetIfAllowed(
        target.shipId,
        target.position.row,
        target.position.col,
      );
    });
  }

  const targetsForLabels = labelTargets ?? validTargets;
  const hasSingleSelectedTarget =
    targetShipId != null && targetShipId !== 0;

  // When a specific destination is active (drag or hover), only show labels for that
  // destination's valid targets — not the full multi-origin threat range.
  if (selectedShipId && !hasSingleSelectedTarget && !(draggedShipId && dragOverCell)) {
    targetsForLabels.forEach((target) => {
      pushTargetIfAllowed(
        target.shipId,
        target.position.row,
        target.position.col,
      );
    });
  }

  return targetsToShow;
}
