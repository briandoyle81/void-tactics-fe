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

/** Damage taken by each dropped ship this run (web2 RoguelikeRun.droppedShipHp), by ship id. */
export type DroppedShipDamage = Record<string, number>;

/**
 * A resupply roster change on web2, carrying damage the way the chain does
 * (RoguelikeRun.shipHPByGen keeps it per ship for the whole run): a dropped
 * ship's damage is remembered, and a re-added ship comes back with it.
 * Returns the new dropped-damage record and the damage each added ship joins
 * the roster with.
 */
export function carryRosterDamage(
  dropped: DroppedShipDamage,
  removed: { shipId: number; hp: number }[],
  addedShipIds: number[],
): { dropped: DroppedShipDamage; addedDamage: Map<number, number> } {
  const next: DroppedShipDamage = { ...dropped };
  for (const { shipId, hp } of removed) {
    if (hp > 0) next[String(shipId)] = hp;
    else delete next[String(shipId)];
  }
  const addedDamage = new Map<number, number>();
  for (const shipId of addedShipIds) {
    addedDamage.set(shipId, next[String(shipId)] ?? 0);
    delete next[String(shipId)];
  }
  return { dropped: next, addedDamage };
}

/** Reads a stored droppedShipHp value (JSON), ignoring anything malformed. */
export function parseDroppedShipDamage(value: unknown): DroppedShipDamage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: DroppedShipDamage = {};
  for (const [id, hp] of Object.entries(value as Record<string, unknown>)) {
    if (typeof hp === "number" && Number.isFinite(hp) && hp > 0) out[id] = hp;
  }
  return out;
}
