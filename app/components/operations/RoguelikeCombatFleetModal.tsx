"use client";

import React from "react";
import { FleetSelectionModal } from "../FleetSelectionModal";
import type { FleetShipListItemData } from "../FleetShipListPanel";
import type { FleetFilters } from "../../utils/fleetFilters";

// Entering a run's combat node: the run's roster is already committed, so
// every roster ship starts selected and the player only positions them.
// Shared by RoguelikeCombatModal (web3) and RoguelikeCombatModalWeb2, which
// supply the launch (contract or API), the ship list and the map.

/** The parts of useFleetPlacement / useFleetPlacementWeb2 this modal reads (either id type). */
interface CombatFleet<Id, S extends { traits: { variant: number } }> {
  ships: S[];
  filteredShips: S[];
  selectedShips: Id[];
  shipPositions: { shipId: Id; row: number; col: number }[];
  hasMovedShip: boolean;
  totalCost: number;
  fleetFilters: FleetFilters;
  setFleetFilters: (updater: (prev: FleetFilters) => FleetFilters) => void;
  selectedVariant: number;
  setSelectedVariant: (variant: number) => void;
  variantLocked: boolean;
  addShips: (ids: Id[]) => void;
}

/**
 * Selects the whole roster once it has loaded and the fleet has picked up
 * the roster's faction lock (it defaults to faction 1 and would otherwise
 * skip a faction-2 roster).
 */
export function useSeedCombatRoster<Id, S extends { id: Id; traits: { variant: number } }>(
  fleet: CombatFleet<Id, S>,
  rosterShips: S[],
) {
  const seededRef = React.useRef(false);
  const rosterVariant = rosterShips[0]?.traits.variant;
  React.useEffect(() => {
    if (seededRef.current || rosterShips.length === 0) return;
    if (fleet.selectedVariant !== rosterVariant) return;
    seededRef.current = true;
    fleet.addShips(rosterShips.map((s) => s.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterShips, rosterVariant, fleet.selectedVariant]);
}

/**
 * Starting positions in roster order (the launch pairs positions[i] with
 * roster ship i), or null when a roster ship hasn't been placed.
 */
export function positionsInRosterOrder<Id>(
  rosterIds: Id[],
  placed: { shipId: Id; row: number; col: number }[],
): { row: number; col: number }[] | null {
  const byId = new Map(placed.map((p) => [String(p.shipId), { row: p.row, col: p.col }]));
  const positions = rosterIds.map((id) => byId.get(String(id)));
  return positions.some((p) => !p) ? null : (positions as { row: number; col: number }[]);
}

export function RoguelikeCombatFleetModal<Id, S extends { traits: { variant: number } }>({
  fleet,
  rosterSize,
  isSubmitting,
  isWarping,
  shipsLoading,
  isAttributesFromCache,
  showInGameProperties,
  onToggleInGameProperties,
  shipListItems,
  mapDisplay,
  onLaunch,
  onClose,
  onLaunched,
}: {
  fleet: CombatFleet<Id, S>;
  rosterSize: number;
  isSubmitting: boolean;
  /** The launch confirmed; waiting for the games list to open the game. */
  isWarping: boolean;
  shipsLoading: boolean;
  isAttributesFromCache: boolean;
  showInGameProperties: boolean;
  onToggleInGameProperties: (value: boolean) => void;
  shipListItems: FleetShipListItemData[];
  mapDisplay: React.ReactNode;
  onLaunch: () => void;
  onClose: () => void;
  onLaunched: () => void;
}) {
  const [filtersExpanded, setFiltersExpanded] = React.useState(false);
  return (
    <FleetSelectionModal
      participantHasFleet={false}
      opponentHasFleet={true}
      onGoToGames={onLaunched}
      createButtonState={{
        isBusy: isSubmitting,
        busyLabel: isWarping ? "WARPING..." : "LAUNCHING...",
        selectedCount: fleet.selectedShips.length,
        maxShips: rosterSize,
        isOverLimit: false,
        costLimit: 0,
        isUnder90Percent: false,
        hasMovedShip: fleet.hasMovedShip,
        hasStaleCosts: false,
        readyLabel: `LAUNCH MISSION (${fleet.selectedShips.length})`,
      }}
      onCreateFleet={onLaunch}
      onCancel={onClose}
      filtersExpanded={filtersExpanded}
      onToggleFilters={() => setFiltersExpanded((v) => !v)}
      loadFleetMenu={null}
      onClearFleetSelection={() => {}}
      isBusy={isSubmitting}
      totalCost={fleet.totalCost}
      costLimit={0}
      isOverLimit={false}
      isUnder90Percent={false}
      onClose={onClose}
      showFirstFleetHint={false}
      fleetFilters={fleet.fleetFilters}
      onFleetFiltersChange={fleet.setFleetFilters}
      shownCount={fleet.filteredShips.length}
      totalCount={fleet.ships.filter((s) => s.traits.variant === fleet.selectedVariant).length}
      showInGameProperties={showInGameProperties}
      onToggleInGameProperties={onToggleInGameProperties}
      isAttributesFromCache={isAttributesFromCache}
      shipsLoading={shipsLoading}
      isCreator={true}
      shipListItems={shipListItems}
      mapDisplay={mapDisplay}
      // The roster is fixed for combat entry: dropping a ship back on the
      // list doesn't remove it; only repositioning on the grid matters.
      onDropShip={() => {}}
      selectedVariant={fleet.selectedVariant}
      onSelectVariant={fleet.setSelectedVariant}
      variantLocked={fleet.variantLocked}
    />
  );
}
