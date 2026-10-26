import { Attributes } from "../types/types";
import { Web2ShipPosition } from "../types/web2Game";
import {
  hasLineOfSight,
  hasMovementPath,
  buildEnemyOccupiedGrid,
} from "./gameGridRanges";
import { requireShipValue, resolveActionRange } from "./requireShipValue";
import { isRepairDronesSpecial } from "./specialConfigWeb2";
import { canBeRepaired } from "./healCap";

const EMPTY_RANGE_CELLS: { row: number; col: number }[] = [];
const EMPTY_TARGET_REFS: { shipId: number; position: { row: number; col: number } }[] = [];

function enemyOccupiedFor(
  gridWidth: number,
  gridHeight: number,
  shipPositions: readonly Web2ShipPosition[],
  selectedShipId: number | null,
  getShipAttributes?: (shipId: number) => Attributes | null,
): boolean[][] | undefined {
  if (selectedShipId == null) return undefined;
  const selected = shipPositions.find((p) => p.shipId === selectedShipId);
  if (!selected) return undefined;
  return buildEnemyOccupiedGrid(
    gridWidth,
    gridHeight,
    shipPositions,
    selectedShipId,
    selected.isCreator,
    (id) => getShipAttributes?.(Number(id))?.hullPoints === 0,
  );
}

// "ram" mode covers both faction abilities (Ram/variant 1, Repair/variant
// 2 — see useFactionAbilityConfig.ts): a valid target is a downed enemy for
// Ram, or a friendly ship (including self) for Repair. `factionAbilityRange`
// stands in for `specialRange` in that mode; both abilities are range 1, so
// the existing "adjacent tiles skip line-of-sight" behavior already covers
// them without a dedicated exemption.
function isValidFactionAbilityTarget(
  targetOwner: string,
  playerAddress: string | null,
  isHeal: boolean,
  targetHullPoints: number | undefined,
): boolean {
  if (isHeal) return targetOwner === playerAddress;
  return targetOwner !== playerAddress && targetHullPoints === 0;
}

/** A repair target must be below the heal cap (healCap.ts); unknown attributes pass. */
function isRepairable(shipId: number, getShipAttributes: (shipId: number) => Attributes | null): boolean {
  const attrs = getShipAttributes(shipId);
  return !attrs || canBeRepaired(attrs);
}

/** After a staged move the acting ship is still listed at FROM; heal/self-repair aims from To. */
function actingShipTargetPosition(
  shipId: number,
  selectedShipId: number,
  livePosition: { row: number; col: number },
  previewPosition: { row: number; col: number } | null,
  selectedWeaponType: "weapon" | "special" | "ram",
  specialType: number,
  factionAbilityIsHeal: boolean,
  shipVariant = 1,
): { row: number; col: number } {
  const isSelfHeal =
    shipId === selectedShipId &&
    previewPosition != null &&
    ((selectedWeaponType === "ram" && factionAbilityIsHeal) ||
      (selectedWeaponType === "special" &&
        isRepairDronesSpecial(shipVariant, specialType)));
  return isSelfHeal ? previewPosition : livePosition;
}

// `number`-typed parallel of the five `bigint`-typed range functions in
// `gameGridRanges.ts` (`hasLineOfSight` is already pure/id-free and stays
// shared, imported above rather than duplicated). Isomorphic — no browser
// globals — so this is used both client-side (GameDisplayWeb2.tsx, for range
// highlighting) and server-side (gameEngineWeb2.ts, to validate that a
// submitted move/shot actually falls within range and has line of sight).

interface MovementRangeParams {
  gridWidth: number;
  gridHeight: number;
  selectedShipId: number | null;
  hasShips: boolean;
  shipMap: Map<number, unknown>;
  getShipAttributes: (shipId: number) => Attributes | null;
  shipPositions: readonly Web2ShipPosition[];
  previewPosition: { row: number; col: number } | null;
  canEnterOccupiedCell?: (
    row: number,
    col: number,
    occupyingShipId: number,
  ) => boolean;
  /**
   * Movement-blocking terrain (distinct from `blockedGrid`'s LOS-only
   * blocking — see
   * docs/eth-global-remote/frontend-handoff-maps-and-deployment-zones-2026-09-23.md
   * §1). Omitted/absent means no impassable terrain — every candidate tile
   * within movement range is reachable, same as before this existed.
   */
  impassableGrid?: boolean[][];
}

interface ShootingRangeParams {
  gridWidth: number;
  gridHeight: number;
  selectedShipId: number | null;
  hasShips: boolean;
  shipMap: Map<number, unknown>;
  getShipAttributes: (shipId: number) => Attributes | null;
  shipPositions: readonly Web2ShipPosition[];
  previewPosition: { row: number; col: number } | null;
  selectedWeaponType: "weapon" | "special" | "ram";
  specialRange: number | undefined;
  specialType: number;
  factionAbilityRange?: number | undefined;
  blockedGrid: boolean[][];
  /** Same movement-blocking terrain used by computeMovementRange. */
  impassableGrid?: boolean[][];
}

/**
 * Where a ship should end its move to Ram `target`. Mirrors RamResolver.sol:
 * the ship makes a normal legal move (or stays put), then must be within
 * `range` of the target from that tile; the resolver then relocates it onto
 * the target's tile. `moveTiles` is computeMovementRange's output with no
 * preview set (legal, path-checked, unoccupied destinations). Keeps
 * `preferred` (the already-proposed move) when it works, else prefers
 * staying put, else the shortest move. Null when the target can't be rammed
 * this turn.
 */
export function findRamStagingTile({
  current,
  moveTiles,
  target,
  range,
  preferred,
}: {
  current: { row: number; col: number };
  moveTiles: readonly { row: number; col: number }[];
  target: { row: number; col: number };
  range: number;
  preferred?: { row: number; col: number } | null;
}): { row: number; col: number } | null {
  const dist = (a: { row: number; col: number }, b: { row: number; col: number }) =>
    Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  const inRange = (t: { row: number; col: number }) => dist(t, target) <= range;
  const isCandidate = (t: { row: number; col: number }) =>
    (t.row === current.row && t.col === current.col) ||
    moveTiles.some((m) => m.row === t.row && m.col === t.col);

  if (preferred && isCandidate(preferred) && inRange(preferred)) return preferred;
  if (inRange(current)) return current;
  let best: { row: number; col: number } | null = null;
  for (const tile of moveTiles) {
    if (!inRange(tile)) continue;
    if (!best || dist(tile, current) < dist(best, current)) best = tile;
  }
  return best;
}

export function computeMovementRange({
  gridWidth,
  gridHeight,
  selectedShipId,
  hasShips,
  shipMap,
  getShipAttributes,
  shipPositions,
  previewPosition,
  canEnterOccupiedCell,
  impassableGrid,
}: MovementRangeParams): { row: number; col: number }[] {
  if (!selectedShipId || !hasShips) return EMPTY_RANGE_CELLS;

  const ship = shipMap.get(selectedShipId);
  if (!ship) return [];

  const attributes = getShipAttributes(selectedShipId);
  // Disabled ships (0 HP) cannot move; only retreat is available
  if (!attributes) return [];
  if (attributes.hullPoints === 0) return [];

  const movementRange = requireShipValue("movement", attributes.movement);

  const currentPosition = shipPositions.find(
    (pos) => pos.shipId === selectedShipId,
  );

  if (!currentPosition) return [];

  // If ship has a preview position (including "stay in place"), don't show movement range
  // so only weapon range is shown.
  if (previewPosition) {
    return [];
  }

  const validMoves: { row: number; col: number }[] = [];
  const startRow = Number(currentPosition.position.row);
  const startCol = Number(currentPosition.position.col);
  if (!Number.isFinite(startRow) || !Number.isFinite(startCol)) return [];
  const enemyOccupiedGrid = enemyOccupiedFor(
    gridWidth,
    gridHeight,
    shipPositions,
    selectedShipId,
    getShipAttributes,
  );

  const occupies = (row: number, col: number) =>
    shipPositions.find(
      (pos) =>
        Number(pos.position.row) === row && Number(pos.position.col) === col,
    );

  // Check all positions within movement range
  for (
    let row = Math.max(0, startRow - movementRange);
    row <= Math.min(gridHeight - 1, startRow + movementRange);
    row++
  ) {
    for (
      let col = Math.max(0, startCol - movementRange);
      col <= Math.min(gridWidth - 1, startCol + movementRange);
      col++
    ) {
      const distance = Math.abs(row - startRow) + Math.abs(col - startCol);
      if (distance <= movementRange && distance > 0) {
        // Impassable tiles and enemy ships both block movement-through
        // (Maps.hasMovementPath / hasMovementPathAvoidingShips). Scoring is
        // a separate mapping and does not skip the Bresenham walk.
        if (
          !hasMovementPath(
            startRow,
            startCol,
            row,
            col,
            impassableGrid,
            enemyOccupiedGrid,
          )
        ) {
          continue;
        }
        const occupyingShip = occupies(row, col);
        const canEnterOccupied =
          occupyingShip != null &&
          canEnterOccupiedCell?.(row, col, occupyingShip.shipId) === true;

        if (!occupyingShip || canEnterOccupied) {
          validMoves.push({ row, col });
        }
      }
    }
  }

  return validMoves;
}

export function computeShootingRange({
  gridWidth,
  gridHeight,
  selectedShipId,
  hasShips,
  shipMap,
  getShipAttributes,
  shipPositions,
  previewPosition,
  selectedWeaponType,
  specialRange,
  specialType,
  factionAbilityRange,
  blockedGrid,
  impassableGrid,
}: ShootingRangeParams): { row: number; col: number }[] {
  if (!selectedShipId || !hasShips) return EMPTY_RANGE_CELLS;

  const ship = shipMap.get(selectedShipId);
  if (!ship) return [];

  const attributes = getShipAttributes(selectedShipId);
  // Disabled ships (0 HP) have no move or threat range; only retreat is available
  if (!attributes) return [];
  if (attributes.hullPoints === 0) return [];

  const movementRange = requireShipValue("movement", attributes.movement);
  const shootingRange = resolveActionRange({
    selectedWeaponType,
    specialRange,
    factionAbilityRange,
    gunRange: attributes.range,
  });
  if (shootingRange === undefined) return [];

  const currentPosition = shipPositions.find(
    (pos) => pos.shipId === selectedShipId,
  );

  if (!currentPosition) return [];

  const enemyOccupiedGrid = enemyOccupiedFor(
    gridWidth,
    gridHeight,
    shipPositions,
    selectedShipId,
    getShipAttributes,
  );

  const validShootingPositions: { row: number; col: number }[] = [];

  // When a move is entered (preview set), show gun range from that single origin only
  if (previewPosition) {
    const startRow = previewPosition.row;
    const startCol = previewPosition.col;

    // First, add all positions that are exactly 1 square away from preview position
    // (ships can always shoot adjacent enemies, even in nebula)
    for (
      let row = Math.max(0, startRow - 1);
      row <= Math.min(gridHeight - 1, startRow + 1);
      row++
    ) {
      for (
        let col = Math.max(0, startCol - 1);
        col <= Math.min(gridWidth - 1, startCol + 1);
        col++
      ) {
        const distance = Math.abs(row - startRow) + Math.abs(col - startCol);

        // Only add positions that are exactly 1 square away and not occupied
        if (distance === 1) {
          const isOccupied = shipPositions.some(
            (pos) => pos.position.row === row && pos.position.col === col,
          );

          if (!isOccupied) {
            validShootingPositions.push({ row, col });
          }
        }
      }
    }

    // Then check all positions within shooting range from preview position
    for (
      let row = Math.max(0, startRow - shootingRange);
      row <= Math.min(gridHeight - 1, startRow + shootingRange);
      row++
    ) {
      for (
        let col = Math.max(0, startCol - shootingRange);
        col <= Math.min(gridWidth - 1, startCol + shootingRange);
        col++
      ) {
        const distance = Math.abs(row - startRow) + Math.abs(col - startCol);

        // Only check positions within shooting range, excluding adjacent ones (already added above)
        if (distance <= shootingRange && distance > 1) {
          // Check if position is not occupied by another ship
          const isOccupied = shipPositions.some(
            (pos) => pos.position.row === row && pos.position.col === col,
          );

          if (!isOccupied) {
            // Ships can always shoot adjacent enemies (distance === 1) regardless of nebula squares
            // OR special abilities ignore nebula squares
            // OR regular weapons need line of sight
            const shouldCheckLineOfSight =
              distance > 1 && // Not adjacent
              (selectedWeaponType !== "special" ||
                (specialType !== 1 &&
                  specialType !== 2 &&
                  specialType !== 3)); // Not EMP, Repair, or Flak

            if (
              !shouldCheckLineOfSight ||
              hasLineOfSight(
                startRow,
                startCol,
                row,
                col,
                blockedGrid,
                enemyOccupiedGrid,
              )
            ) {
              validShootingPositions.push({ row, col });
            }
          }
        }
      }
    }

    return validShootingPositions;
  }

  // No move entered: the threat range, every tile the ship could fire on
  // this turn from somewhere it can end up. The origins are where it stands
  // (holding position) and every tile it can move to (the same rule as
  // computeMovementRange). Tiles it can't move into, like asteroids or tiles
  // behind them, can still be fired on, so every other tile is checked
  // against every origin, not just the ring past the movement distance.
  const startRow = currentPosition.position.row;
  const startCol = currentPosition.position.col;
  const origins: { row: number; col: number }[] = [{ row: startRow, col: startCol }];
  const originKeys = new Set<string>([`${startRow},${startCol}`]);
  for (
    let moveRow = Math.max(0, startRow - movementRange);
    moveRow <= Math.min(gridHeight - 1, startRow + movementRange);
    moveRow++
  ) {
    for (
      let moveCol = Math.max(0, startCol - movementRange);
      moveCol <= Math.min(gridWidth - 1, startCol + movementRange);
      moveCol++
    ) {
      const moveDistance = Math.abs(moveRow - startRow) + Math.abs(moveCol - startCol);
      if (moveDistance === 0 || moveDistance > movementRange) continue;
      const isMoveOccupied = shipPositions.some(
        (pos) => pos.position.row === moveRow && pos.position.col === moveCol,
      );
      if (
        !isMoveOccupied &&
        hasMovementPath(startRow, startCol, moveRow, moveCol, impassableGrid, enemyOccupiedGrid)
      ) {
        origins.push({ row: moveRow, col: moveCol });
        originKeys.add(`${moveRow},${moveCol}`);
      }
    }
  }

  // Ships can always shoot adjacent enemies, even in nebula; EMP, Repair and
  // Flak ignore nebula; other weapons need line of sight.
  const needsLineOfSight =
    selectedWeaponType !== "special" ||
    (specialType !== 1 && specialType !== 2 && specialType !== 3);
  const totalRange = movementRange + shootingRange;

  for (
    let row = Math.max(0, startRow - totalRange - 1);
    row <= Math.min(gridHeight - 1, startRow + totalRange + 1);
    row++
  ) {
    for (
      let col = Math.max(0, startCol - totalRange - 1);
      col <= Math.min(gridWidth - 1, startCol + totalRange + 1);
      col++
    ) {
      // Tiles it can stand on are drawn as movement tiles instead.
      if (originKeys.has(`${row},${col}`)) continue;
      const isOccupied = shipPositions.some(
        (pos) => pos.position.row === row && pos.position.col === col,
      );
      if (isOccupied) continue;

      const canShootFromSomewhere = origins.some((origin) => {
        const shootDistance = Math.abs(origin.row - row) + Math.abs(origin.col - col);
        if (shootDistance === 1) return true;
        if (shootDistance > shootingRange) return false;
        return (
          !needsLineOfSight ||
          hasLineOfSight(origin.row, origin.col, row, col, blockedGrid, enemyOccupiedGrid)
        );
      });
      if (canShootFromSomewhere) validShootingPositions.push({ row, col });
    }
  }

  return validShootingPositions;
}

interface ShipOwner {
  owner: string;
}

interface ValidTargetsParams {
  selectedShipId: number | null;
  previewPosition: { row: number; col: number } | null;
  isRammingMovePreview: boolean;
  /** Alive ships only. */
  shipPositions: readonly Web2ShipPosition[];
  shipMap: Map<number, ShipOwner>;
  playerAddress: string | null;
  getShipAttributes: (shipId: number) => Attributes | null;
  selectedWeaponType: "weapon" | "special" | "ram";
  specialRange: number | undefined;
  specialType: number;
  shipVariant?: number;
  /** Gates "ram" targeting (the FactionAbility system); false on legacy chains. */
  isFactionAbilitySupported: boolean;
  factionAbilityRange?: number | undefined;
  factionAbilityIsHeal?: boolean;
  blockedGrid: boolean[][];
  /** Enemy ships blocking the acting ship's line of sight (buildEnemyOccupiedGrid). */
  enemyOccupiedGrid?: boolean[][];
}

/**
 * Ships the selected ship can act on this turn with the chosen weapon, from
 * its staged destination (or where it is). Shared by useGameplayInteraction
 * (web3 and web2 battles) and the tutorial (SimulatedGameDisplay), which
 * narrows the result to what each step allows.
 */
export function computeValidTargets({
  selectedShipId,
  previewPosition,
  isRammingMovePreview,
  shipPositions,
  shipMap,
  playerAddress,
  getShipAttributes,
  selectedWeaponType,
  specialRange,
  specialType,
  shipVariant = 1,
  isFactionAbilitySupported,
  factionAbilityRange,
  factionAbilityIsHeal = false,
  blockedGrid,
  enemyOccupiedGrid,
}: ValidTargetsParams): { shipId: number; position: { row: number; col: number } }[] {
  if (!selectedShipId || shipMap.size === 0) return EMPTY_TARGET_REFS;
  if (isRammingMovePreview) return EMPTY_TARGET_REFS;
  const attributes = getShipAttributes(selectedShipId);
  if (!attributes || attributes.hullPoints === 0) return EMPTY_TARGET_REFS;

  const shootRange = resolveActionRange({
    selectedWeaponType,
    specialRange,
    factionAbilityRange,
    gunRange: attributes.range,
  });
  if (shootRange === undefined) return EMPTY_TARGET_REFS;
  const currentPosition = shipPositions.find((pos) => pos.shipId === selectedShipId);
  if (!currentPosition) return EMPTY_TARGET_REFS;

  const startRow = previewPosition ? previewPosition.row : currentPosition.position.row;
  const startCol = previewPosition ? previewPosition.col : currentPosition.position.col;
  const targets: { shipId: number; position: { row: number; col: number } }[] = [];

  shipPositions.forEach((shipPosition) => {
    const ship = shipMap.get(shipPosition.shipId);
    if (!ship) return;

    if (selectedWeaponType === "special") {
      if (specialType === 3) {
        if (shipPosition.shipId === selectedShipId) return;
      } else if (specialType === 1) {
        if (ship.owner === playerAddress) return;
      } else if (isRepairDronesSpecial(shipVariant, specialType)) {
        if (ship.owner !== playerAddress) return;
        if (!isRepairable(shipPosition.shipId, getShipAttributes)) return;
      } else {
        if (ship.owner === playerAddress) return;
      }
    } else if (selectedWeaponType === "ram") {
      if (!isFactionAbilitySupported) return;
      const targetHp = getShipAttributes(shipPosition.shipId)?.hullPoints;
      if (!isValidFactionAbilityTarget(ship.owner, playerAddress, factionAbilityIsHeal, targetHp)) return;
      if (factionAbilityIsHeal && !isRepairable(shipPosition.shipId, getShipAttributes)) return;
    } else {
      if (ship.owner === playerAddress) return;
    }

    const { row: targetRow, col: targetCol } = actingShipTargetPosition(
      shipPosition.shipId,
      selectedShipId,
      shipPosition.position,
      previewPosition,
      selectedWeaponType,
      specialType,
      factionAbilityIsHeal,
      shipVariant,
    );
    const distance = Math.abs(targetRow - startRow) + Math.abs(targetCol - startCol);
    const isSelfHealAction =
      (selectedWeaponType === "special" && isRepairDronesSpecial(shipVariant, specialType)) ||
      (selectedWeaponType === "ram" && factionAbilityIsHeal);
    const canShoot = distance === 1 || distance <= shootRange;
    const isSelfRepair = isSelfHealAction && shipPosition.shipId === selectedShipId && distance === 0;

    if ((canShoot && distance > 0) || isSelfRepair) {
      const shouldCheckLineOfSight =
        distance > 1 && (selectedWeaponType !== "special" || (specialType !== 1 && specialType !== 2 && specialType !== 3));
      if (
        !shouldCheckLineOfSight ||
        hasLineOfSight(startRow, startCol, targetRow, targetCol, blockedGrid, enemyOccupiedGrid)
      ) {
        targets.push({ shipId: shipPosition.shipId, position: { row: targetRow, col: targetCol } });
      }
    }
  });

  return targets;
}

interface LabelTargetsParams {
  selectedShipId: number | null;
  previewPosition: { row: number; col: number } | null;
  isRammingMovePreview: boolean;
  shipPositions: readonly Web2ShipPosition[];
  shipMap: Map<number, ShipOwner>;
  playerAddress: string | null;
  getShipAttributes: (shipId: number) => Attributes | null;
  selectedWeaponType: "weapon" | "special" | "ram";
  specialRange: number | undefined;
  specialType: number;
  shipVariant?: number;
  factionAbilityRange?: number | undefined;
  factionAbilityIsHeal?: boolean;
  blockedGrid: boolean[][];
  /** Same movement-blocking terrain used by computeMovementRange. */
  impassableGrid?: boolean[][];
  gridWidth: number;
  gridHeight: number;
}

export function computeLabelTargets({
  selectedShipId,
  previewPosition,
  isRammingMovePreview,
  shipPositions,
  shipMap,
  playerAddress,
  getShipAttributes,
  selectedWeaponType,
  specialRange,
  specialType,
  shipVariant = 1,
  factionAbilityRange,
  factionAbilityIsHeal = false,
  blockedGrid,
  impassableGrid,
  gridWidth,
  gridHeight,
}: LabelTargetsParams): { shipId: number; position: { row: number; col: number } }[] {
  if (!selectedShipId) return EMPTY_TARGET_REFS;
  if (isRammingMovePreview) return EMPTY_TARGET_REFS;

  const attributes = getShipAttributes(selectedShipId);
  if (!attributes) return [];
  if (attributes.hullPoints === 0) return [];

  const movementRangeAttr = requireShipValue("movement", attributes.movement);
  const shootingRangeAttr = resolveActionRange({
    selectedWeaponType,
    specialRange,
    factionAbilityRange,
    gunRange: attributes.range,
  });
  if (shootingRangeAttr === undefined) return [];

  const currentPosition = shipPositions.find(
    (pos) => pos.shipId === selectedShipId,
  );
  if (!currentPosition) return [];

  const enemyOccupiedGrid = enemyOccupiedFor(
    gridWidth,
    gridHeight,
    shipPositions,
    selectedShipId,
    getShipAttributes,
  );

  const origins: { row: number; col: number }[] = [];
  if (previewPosition) {
    origins.push({ row: previewPosition.row, col: previewPosition.col });
  } else {
    origins.push({
      row: currentPosition.position.row,
      col: currentPosition.position.col,
    });
    for (
      let row = Math.max(0, currentPosition.position.row - movementRangeAttr);
      row <= Math.min(gridHeight - 1, currentPosition.position.row + movementRangeAttr);
      row++
    ) {
      for (
        let col = Math.max(0, currentPosition.position.col - movementRangeAttr);
        col <= Math.min(gridWidth - 1, currentPosition.position.col + movementRangeAttr);
        col++
      ) {
        const dist =
          Math.abs(row - currentPosition.position.row) +
          Math.abs(col - currentPosition.position.col);
        if (dist <= movementRangeAttr && dist > 0) {
          const occupied = shipPositions.some(
            (pos) => pos.position.row === row && pos.position.col === col,
          );
          if (
            !occupied &&
            hasMovementPath(
              currentPosition.position.row,
              currentPosition.position.col,
              row,
              col,
              impassableGrid,
              enemyOccupiedGrid,
            )
          ) {
            origins.push({ row, col });
          }
        }
      }
    }
  }

  const targetMap = new Map<number, { shipId: number; position: { row: number; col: number } }>();

  for (const { row: startRow, col: startCol } of origins) {
    shipPositions.forEach((shipPosition) => {
      const ship = shipMap.get(shipPosition.shipId);
      if (!ship) return;

      if (selectedWeaponType === "special") {
        if (specialType === 3) {
          if (shipPosition.shipId === selectedShipId) return;
        } else if (specialType === 1) {
          if (ship.owner === playerAddress) return;
        } else if (isRepairDronesSpecial(shipVariant, specialType)) {
          if (ship.owner !== playerAddress) return;
          if (!isRepairable(shipPosition.shipId, getShipAttributes)) return;
        } else {
          if (ship.owner === playerAddress) return;
        }
      } else if (selectedWeaponType === "ram") {
        const targetHp = getShipAttributes(shipPosition.shipId)?.hullPoints;
        if (!isValidFactionAbilityTarget(ship.owner, playerAddress, factionAbilityIsHeal, targetHp)) return;
        if (factionAbilityIsHeal && !isRepairable(shipPosition.shipId, getShipAttributes)) return;
      } else {
        if (ship.owner === playerAddress) return;
      }

      const { row: targetRow, col: targetCol } = actingShipTargetPosition(
        shipPosition.shipId,
        selectedShipId,
        shipPosition.position,
        previewPosition,
        selectedWeaponType,
        specialType,
        factionAbilityIsHeal,
        shipVariant,
      );
      const distance = Math.abs(targetRow - startRow) + Math.abs(targetCol - startCol);
      const isSelfRepair =
        ((selectedWeaponType === "ram" && factionAbilityIsHeal) ||
          (selectedWeaponType === "special" &&
            isRepairDronesSpecial(shipVariant, specialType))) &&
        shipPosition.shipId === selectedShipId &&
        distance === 0;
      const canShoot = distance === 1 || distance <= shootingRangeAttr;

      if ((canShoot && distance > 0) || isSelfRepair) {
        const shouldCheckLineOfSight =
          distance > 1 &&
          (selectedWeaponType !== "special" ||
            (specialType !== 1 && specialType !== 2 && specialType !== 3));

        if (
          !shouldCheckLineOfSight ||
          hasLineOfSight(
            startRow,
            startCol,
            targetRow,
            targetCol,
            blockedGrid,
            enemyOccupiedGrid,
          )
        ) {
          targetMap.set(shipPosition.shipId, {
            shipId: shipPosition.shipId,
            position: { row: targetRow, col: targetCol },
          });
        }
      }
    });
  }

  return Array.from(targetMap.values());
}

interface HoverValidTargetsParams {
  selectedShipId: number | null;
  hoverPreviewPosition: { row: number; col: number } | null;
  hasShips: boolean;
  shipPositions: readonly Web2ShipPosition[];
  shipMap: Map<number, ShipOwner>;
  playerAddress: string | null;
  getShipAttributes: (shipId: number) => Attributes | null;
  selectedWeaponType: "weapon" | "special" | "ram";
  specialRange: number | undefined;
  specialType: number;
  shipVariant?: number;
  factionAbilityRange?: number | undefined;
  factionAbilityIsHeal?: boolean;
  blockedGrid: boolean[][];
}

export function computeHoverValidTargets({
  selectedShipId,
  hoverPreviewPosition,
  hasShips,
  shipPositions,
  shipMap,
  playerAddress,
  getShipAttributes,
  selectedWeaponType,
  specialRange,
  specialType,
  shipVariant = 1,
  factionAbilityRange,
  factionAbilityIsHeal = false,
  blockedGrid,
}: HoverValidTargetsParams): { shipId: number; position: { row: number; col: number } }[] {
  if (!selectedShipId || !hoverPreviewPosition || !hasShips) return EMPTY_TARGET_REFS;
  const attributes = getShipAttributes(selectedShipId);
  if (!attributes) return [];
  const range = resolveActionRange({
    selectedWeaponType,
    specialRange,
    factionAbilityRange,
    gunRange: attributes.range,
  });
  if (range === undefined) return [];
  const { row: startRow, col: startCol } = hoverPreviewPosition;
  const spec = specialType;
  const enemyOccupiedGrid = enemyOccupiedFor(
    blockedGrid[0]?.length ?? 0,
    blockedGrid.length,
    shipPositions,
    selectedShipId,
    getShipAttributes,
  );
  const targets: { shipId: number; position: { row: number; col: number } }[] = [];
  shipPositions.forEach((shipPosition) => {
    const ship = shipMap.get(shipPosition.shipId);
    if (!ship) return;
    if (selectedWeaponType === "special") {
      if (spec === 3) {
        if (shipPosition.shipId === selectedShipId) return;
      } else if (spec === 1) {
        if (ship.owner === playerAddress) return;
      } else if (isRepairDronesSpecial(shipVariant, spec)) {
        if (ship.owner !== playerAddress) return;
        if (!isRepairable(shipPosition.shipId, getShipAttributes)) return;
      } else {
        if (ship.owner === playerAddress) return;
      }
    } else if (selectedWeaponType === "ram") {
      const targetHp = getShipAttributes(shipPosition.shipId)?.hullPoints;
      if (!isValidFactionAbilityTarget(ship.owner, playerAddress, factionAbilityIsHeal, targetHp)) return;
      if (factionAbilityIsHeal && !isRepairable(shipPosition.shipId, getShipAttributes)) return;
    } else {
      if (ship.owner === playerAddress) return;
    }
    const { row: targetRow, col: targetCol } = actingShipTargetPosition(
      shipPosition.shipId,
      selectedShipId,
      shipPosition.position,
      hoverPreviewPosition,
      selectedWeaponType,
      specialType,
      factionAbilityIsHeal,
      shipVariant,
    );
    const distance = Math.abs(targetRow - startRow) + Math.abs(targetCol - startCol);
    const isSelfRepair =
      ((selectedWeaponType === "ram" && factionAbilityIsHeal) ||
        (selectedWeaponType === "special" &&
          isRepairDronesSpecial(shipVariant, specialType))) &&
      shipPosition.shipId === selectedShipId &&
      distance === 0;
    const canShoot = distance === 1 || distance <= range;
    if ((canShoot && distance > 0) || isSelfRepair) {
      const shouldCheckLOS =
        distance > 1 &&
        (selectedWeaponType !== "special" ||
          (spec !== 1 && spec !== 2 && spec !== 3));
      if (
        !shouldCheckLOS ||
        hasLineOfSight(
          startRow,
          startCol,
          targetRow,
          targetCol,
          blockedGrid,
          enemyOccupiedGrid,
        )
      ) {
        targets.push({ shipId: shipPosition.shipId, position: { row: targetRow, col: targetCol } });
      }
    }
  });
  return targets;
}

interface HoverShootingRangeParams {
  selectedShipId: number | null;
  hoverPreviewPosition: { row: number; col: number } | null;
  hasShips: boolean;
  shipPositions: readonly Web2ShipPosition[];
  getShipAttributes: (shipId: number) => Attributes | null;
  selectedWeaponType: "weapon" | "special" | "ram";
  specialRange: number | undefined;
  specialType: number;
  factionAbilityRange?: number | undefined;
  blockedGrid: boolean[][];
  gridWidth: number;
  gridHeight: number;
}

export function computeHoverShootingRange({
  selectedShipId,
  hoverPreviewPosition,
  hasShips,
  shipPositions,
  getShipAttributes,
  selectedWeaponType,
  specialRange,
  specialType,
  factionAbilityRange,
  blockedGrid,
  gridWidth,
  gridHeight,
}: HoverShootingRangeParams): { row: number; col: number }[] {
  if (!selectedShipId || !hoverPreviewPosition || !hasShips) return EMPTY_RANGE_CELLS;
  const attributes = getShipAttributes(selectedShipId);
  if (!attributes) return [];
  const range = resolveActionRange({
    selectedWeaponType,
    specialRange,
    factionAbilityRange,
    gunRange: attributes.range,
  });
  if (range === undefined) return [];
  const { row: startRow, col: startCol } = hoverPreviewPosition;
  const spec = specialType;
  const enemyOccupiedGrid = enemyOccupiedFor(
    gridWidth,
    gridHeight,
    shipPositions,
    selectedShipId,
    getShipAttributes,
  );
  const positions: { row: number; col: number }[] = [];
  for (let row = Math.max(0, startRow - range); row <= Math.min(gridHeight - 1, startRow + range); row++) {
    for (let col = Math.max(0, startCol - range); col <= Math.min(gridWidth - 1, startCol + range); col++) {
      const distance = Math.abs(row - startRow) + Math.abs(col - startCol);
      if (distance > 0 && distance <= range) {
        const isOccupied = shipPositions.some(
          (p) => p.position.row === row && p.position.col === col,
        );
        if (!isOccupied) {
          const shouldCheckLOS =
            distance > 1 &&
            (selectedWeaponType !== "special" ||
              (spec !== 1 && spec !== 2 && spec !== 3));
          if (
            !shouldCheckLOS ||
            hasLineOfSight(
              startRow,
              startCol,
              row,
              col,
              blockedGrid,
              enemyOccupiedGrid,
            )
          ) {
            positions.push({ row, col });
          }
        }
      }
    }
  }
  return positions;
}
