"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GRID_DIMENSIONS, Ship } from "../types/types";
import type { Web2Ship } from "../types/web2Ship";
import {
  type FleetFilters,
  DEFAULT_FLEET_FILTERS,
  matchesFleetFilters,
} from "../utils/fleetFilters";
import { MAX_SHIPS_PER_FLEET } from "../utils/lobbyFormatters";

/** The ship fields fleet placement reads, beyond its id (any id type). */
interface FleetPlacementShip<Id> {
  id: Id;
  traits: { variant: number; accuracy: number; hull: number; speed: number };
  equipment: { mainWeapon: number; shields: number; special: number };
  shipData: { shiny: boolean; constructed: boolean; inFleet: boolean };
}

/** A ship's numbers, read at the mode's adapter (web3 converts its bigints here). */
interface FleetPlacementShipNumbers {
  cost: number;
  costsVersion: number;
  isDestroyed: boolean;
}

interface FleetPlacementParams<S> {
  ships: S[];
  costLimit: number;
  /** Global ship-attributes costs version, or null if not yet known (skips the staleness check). */
  costsVersion: number | null;
  /** Creator deploys cols 0-3 (search left-to-right); joiner deploys cols 13-16 (search right-to-left). Single-player is always the creator side. */
  isCreatorSide: boolean;
  /**
   * When set (e.g. a campaign's `campaignRequiredVariant`), only ships of
   * this variant are selectable at all — `Fleets.createFleet` now reverts
   * `MixedVariantFleet` otherwise, and some campaigns additionally require
   * a specific variant (`WrongCampaignVariant`). When unset, the fleet
   * locks to whichever variant the player picks first instead (still
   * single-variant, just not predetermined).
   */
  requiredVariant?: number;
  /**
   * This side's custom deployment-zone tiles for the map in play, from
   * `Maps.getCreatorZonePositions`/`getJoinerZonePositions` (see
   * docs/eth-global-remote/frontend-handoff-maps-and-deployment-zones-2026-09-23.md
   * §2) — pass the side-appropriate list (`isCreatorSide` picks which).
   * Empty/omitted means the map hasn't customized its zone, so this falls
   * back to the engine default column band exactly like before.
   */
  zoneTiles?: Array<{ row: number; col: number }>;
}

const CREATOR_ZONE = { colMin: 0, colMax: 3 } as const;
const JOINER_ZONE = { colMin: 13, colMax: 16 } as const;

// Shared ship-picking state/handlers for any "build a fleet on a grid" flow
// — PvP lobby creation (either side) and single-player matches alike, web3
// and web2 (useFleetPlacement / useFleetPlacementWeb2 below). Ids are
// opaque here (bigint or number, whatever the mode uses); each mode's
// wrapper supplies the ship's numbers. A fix lands in both modes at once.
function useFleetPlacementCore<Id extends bigint | number, S extends FleetPlacementShip<Id>>({
  ships,
  costLimit,
  costsVersion,
  isCreatorSide,
  requiredVariant,
  zoneTiles,
  shipNumbers,
}: FleetPlacementParams<S> & { shipNumbers: (ship: S) => FleetPlacementShipNumbers }) {
  const required =
    requiredVariant != null && requiredVariant > 0 ? requiredVariant : null;
  const zone = isCreatorSide ? CREATOR_ZONE : JOINER_ZONE;
  const hasCustomZone = !!zoneTiles && zoneTiles.length > 0;

  const [selectedShips, setSelectedShips] = useState<Id[]>([]);
  const [shipPositions, setShipPositions] = useState<
    Array<{ shipId: Id; row: number; col: number }>
  >([]);
  const [selectedShipId, setSelectedShipId] = useState<Id | null>(null);
  const [fleetFilters, setFleetFilters] = useState<FleetFilters>(DEFAULT_FLEET_FILTERS);
  const [draggedShipId, setDraggedShipId] = useState<Id | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<
    { row: number; col: number } | null
  >(null);
  // Set the first time the player explicitly places a ship (drag/click),
  // as opposed to it landing somewhere via addShip's auto-fill — replaces
  // an earlier "did anything leave the very first column" heuristic that
  // assumed a rectangular zone and broke for a custom zone shape.
  const [hasManuallyMoved, setHasManuallyMoved] = useState(false);
  // Always filter the ship list to one variant. Campaigns pin this via
  // `requiredVariant`; PvP defaults to faction 1 and the modal picker
  // changes it. Switching variants clears the in-progress fleet so we
  // never submit a MixedVariantFleet.
  const [selectedVariant, setSelectedVariantState] = useState(required ?? 1);
  const prevSelectedVariantRef = useRef(selectedVariant);

  useEffect(() => {
    if (required != null) setSelectedVariantState(required);
  }, [required]);

  useEffect(() => {
    if (prevSelectedVariantRef.current === selectedVariant) return;
    prevSelectedVariantRef.current = selectedVariant;
    setSelectedShips((prev) => {
      if (prev.length === 0) return prev;
      const allMatch = prev.every((id) => {
        const ship = ships.find((s) => s.id === id);
        return !!ship && ship.traits.variant === selectedVariant;
      });
      if (allMatch) return prev;
      setShipPositions([]);
      setSelectedShipId(null);
      setHasManuallyMoved(false);
      return [];
    });
  }, [selectedVariant, ships]);

  const setSelectedVariant = useCallback(
    (variant: number) => {
      if (required != null) return;
      setSelectedVariantState(variant);
    },
    [required],
  );

  // Creator fills its zone left-to-right, top-to-bottom; joiner fills its
  // zone right-to-left, bottom-to-top — mirrors Lobbies.tsx's original
  // per-side search order. A custom zone (non-rectangular) instead fills
  // in the order the contract returned its tiles.
  const findNextPosition = useCallback(
    (existingPositions: Array<{ row: number; col: number }>) => {
      if (hasCustomZone) {
        for (const tile of zoneTiles!) {
          if (!existingPositions.some((p) => p.row === tile.row && p.col === tile.col)) {
            return { row: tile.row, col: tile.col };
          }
        }
        return null;
      }
      if (isCreatorSide) {
        for (let col = zone.colMin; col <= zone.colMax; col++) {
          for (let row = 0; row < GRID_DIMENSIONS.HEIGHT; row++) {
            if (!existingPositions.some((p) => p.row === row && p.col === col)) {
              return { row, col };
            }
          }
        }
      } else {
        for (let col = zone.colMax; col >= zone.colMin; col--) {
          for (let row = GRID_DIMENSIONS.HEIGHT - 1; row >= 0; row--) {
            if (!existingPositions.some((p) => p.row === row && p.col === col)) {
              return { row, col };
            }
          }
        }
      }
      return null;
    },
    [isCreatorSide, zone, hasCustomZone, zoneTiles],
  );

  // `Fleets.createFleet` reverts `MixedVariantFleet` if selected ships don't
  // all share one `traits.variant`; some campaigns additionally require a
  // specific variant (`campaignRequiredVariant`/`WrongCampaignVariant`).
  // `lockedVariant` is the single variant this fleet is currently
  // restricted to — either the caller-supplied requirement, or (once at
  // least one ship is picked) whichever variant that first ship is.
  const lockedVariant = selectedVariant;
  const variantLocked = required != null;

  // Places several ships in one go, each against the positions already
  // taken by the ones before it. Calling addShip in a loop instead reads the
  // same render's shipPositions every time, so every ship got the same
  // "next free" tile (roguelike combat seeds its whole roster this way).
  const addShips = useCallback(
    (shipIds: Id[]) => {
      const placed = [...shipPositions];
      const added: Array<{ shipId: Id; row: number; col: number }> = [];
      for (const shipId of shipIds) {
        if (placed.some((p) => p.shipId === shipId)) continue;
        const ship = ships.find((s) => s.id === shipId);
        if (lockedVariant != null && ship && ship.traits.variant !== lockedVariant) continue;
        const position = findNextPosition(placed);
        if (!position) break;
        const entry = { shipId, row: position.row, col: position.col };
        placed.push(entry);
        added.push(entry);
      }
      if (added.length === 0) return;
      setSelectedShips((prev) => [...prev, ...added.map((a) => a.shipId)]);
      setShipPositions((prev) => [...prev, ...added]);
    },
    [shipPositions, findNextPosition, ships, lockedVariant],
  );

  const addShip = useCallback((shipId: Id) => addShips([shipId]), [addShips]);

  const removeShip = useCallback((shipId: Id) => {
    setSelectedShips((prev) => prev.filter((id) => id !== shipId));
    setShipPositions((prev) => prev.filter((p) => p.shipId !== shipId));
    setSelectedShipId((prev) => (prev === shipId ? null : prev));
  }, []);

  const isInZone = useCallback(
    (row: number, col: number) =>
      hasCustomZone
        ? zoneTiles!.some((t) => t.row === row && t.col === col)
        : row >= 0 && row < GRID_DIMENSIONS.HEIGHT && col >= zone.colMin && col <= zone.colMax,
    [hasCustomZone, zoneTiles, zone],
  );

  const moveShip = useCallback(
    (shipId: Id, row: number, col: number) => {
      if (!isInZone(row, col)) return;
      const occupied = shipPositions.some(
        (p) => p.row === row && p.col === col && p.shipId !== shipId,
      );
      if (occupied) return;

      setHasManuallyMoved(true);
      if (!selectedShips.includes(shipId)) {
        setSelectedShips((prev) => [...prev, shipId]);
        setShipPositions((prev) => [...prev, { shipId, row, col }]);
        return;
      }
      setShipPositions((prev) =>
        prev.map((p) => (p.shipId === shipId ? { ...p, row, col } : p)),
      );
      setSelectedShipId(null);
    },
    [shipPositions, selectedShips, isInZone],
  );

  // A ship can sit outside this side's zone when its position came from
  // somewhere other than moveShip: a loaded saved fleet, or the map's
  // custom zone arriving after the ships were placed. The launch would
  // revert, so the deploy button stays off until they're moved in.
  const hasShipsOutsideZone = useMemo(
    () => shipPositions.some((p) => !isInZone(p.row, p.col)),
    [shipPositions, isInZone],
  );

  const clearSelection = useCallback(() => {
    setSelectedShips([]);
    setShipPositions([]);
    setSelectedShipId(null);
    setHasManuallyMoved(false);
  }, []);

  const resolveShip = useCallback(
    (shipId: Id): S | undefined => ships.find((s) => s.id === shipId),
    [ships],
  );

  const filteredShips = useMemo(
    () =>
      ships.filter((ship) => {
        const costsVersionOk =
          costsVersion === null || shipNumbers(ship).costsVersion === costsVersion;

        if (selectedShips.includes(ship.id)) return costsVersionOk;
        if (!costsVersionOk) return false;
        if (ship.traits.variant !== selectedVariant) {
          return false;
        }

        return matchesFleetFilters(
          {
            cost: shipNumbers(ship).cost,
            isShiny: ship.shipData.shiny,
            accuracy: ship.traits.accuracy,
            hull: ship.traits.hull,
            speed: ship.traits.speed,
            isConstructed: ship.shipData.constructed,
            isDestroyed: shipNumbers(ship).isDestroyed,
            inFleet: ship.shipData.inFleet,
            mainWeapon: ship.equipment.mainWeapon,
            shields: ship.equipment.shields,
            special: ship.equipment.special,
          },
          fleetFilters,
        );
      }),
    [ships, fleetFilters, costsVersion, selectedShips, selectedVariant, shipNumbers],
  );

  const hasStaleCostsVersion = useMemo(() => {
    if (costsVersion === null) return false;
    return selectedShips.some((id) => {
      const ship = resolveShip(id);
      return !ship || shipNumbers(ship).costsVersion !== costsVersion;
    });
  }, [costsVersion, selectedShips, resolveShip, shipNumbers]);

  const totalCost = useMemo(
    () =>
      selectedShips.reduce((sum, shipId) => {
        const ship = resolveShip(shipId);
        return sum + (ship ? shipNumbers(ship).cost : 0);
      }, 0),
    [selectedShips, resolveShip, shipNumbers],
  );
  const isOverLimit = totalCost > costLimit;
  const isUnder90Percent = totalCost < costLimit * 0.9;

  // Require at least one explicit manual placement before allowing
  // submission — a UX nudge so a player doesn't submit a fleet they never
  // actually looked at, not an on-chain requirement.
  const hasMovedShip = shipPositions.length > 0 && hasManuallyMoved;

  return {
    ships,
    selectedShips,
    setSelectedShips,
    shipPositions,
    setShipPositions,
    selectedShipId,
    setSelectedShipId,
    fleetFilters,
    setFleetFilters,
    draggedShipId,
    setDraggedShipId,
    dragOverPosition,
    setDragOverPosition,
    addShip,
    addShips,
    removeShip,
    moveShip,
    findNextPosition,
    clearSelection,
    filteredShips,
    lockedVariant,
    selectedVariant,
    setSelectedVariant,
    variantLocked,
    totalCost,
    isOverLimit,
    isUnder90Percent,
    hasMovedShip,
    hasShipsOutsideZone,
    hasStaleCostsVersion,
    maxShips: hasCustomZone ? zoneTiles!.length : MAX_SHIPS_PER_FLEET,
  };
}

const web3ShipNumbers = (ship: Ship): FleetPlacementShipNumbers => ({
  cost: Number(ship.shipData.cost),
  costsVersion: Number(ship.shipData.costsVersion),
  isDestroyed: ship.shipData.timestampDestroyed > 0n,
});

const web2ShipNumbers = (ship: Web2Ship): FleetPlacementShipNumbers => ({
  cost: ship.shipData.cost,
  costsVersion: ship.shipData.costsVersion,
  isDestroyed: ship.shipData.timestampDestroyed > 0,
});

/** Fleet placement for web3 ships (bigint ids). */
export function useFleetPlacement(params: FleetPlacementParams<Ship>) {
  return useFleetPlacementCore<bigint, Ship>({ ...params, shipNumbers: web3ShipNumbers });
}

/** Fleet placement for web2 ships (number ids). */
export function useFleetPlacementWeb2(params: FleetPlacementParams<Web2Ship>) {
  return useFleetPlacementCore<number, Web2Ship>({ ...params, shipNumbers: web2ShipNumbers });
}
