// Helpers for the resupply hangar picker (same fleet-select UI as run
// start). Number-native: callers convert bigint ids before comparing.

/** The cap in effect at a resupply node: a nonzero override is the new maximum. */
export function resupplyCostLimit(currentCostCap: number, costCapOverride: number): number {
  return costCapOverride > 0 ? costCapOverride : currentCostCap;
}

/** Ships to add and drop so `currentIds` becomes `selectedIds`. */
export function rosterModifyDiff<Id>(
  currentIds: Id[],
  selectedIds: Id[],
): { add: Id[]; remove: Id[] } {
  const current = new Set(currentIds.map(String));
  const selected = new Set(selectedIds.map(String));
  return {
    add: selectedIds.filter((id) => !current.has(String(id))),
    remove: currentIds.filter((id) => !selected.has(String(id))),
  };
}

/** Owned ships the resupply picker can toggle: hangar ships plus the current roster. */
export function isResupplyCandidate(
  ship: {
    id: string;
    constructed: boolean;
    destroyed: boolean;
    inFleet: boolean;
    variant: number;
  },
  rosterIds: Set<string>,
  requiredVariant: number,
): boolean {
  if (!ship.constructed || ship.destroyed) return false;
  if (requiredVariant > 0 && ship.variant !== requiredVariant) return false;
  if (rosterIds.has(ship.id)) return true;
  return !ship.inFleet;
}

/**
 * Roster ships are reserved (`inFleet`), which would lock their cards.
 * Clear that flag so the hangar picker can deselect/reselect them.
 */
export function markRosterAvailableForSelect<
  S extends { id: { toString(): string }; shipData: { inFleet: boolean } },
>(ships: S[], rosterIds: Set<string>): S[] {
  return ships.map((ship) =>
    rosterIds.has(ship.id.toString()) && ship.shipData.inFleet
      ? { ...ship, shipData: { ...ship.shipData, inFleet: false } }
      : ship,
  );
}
