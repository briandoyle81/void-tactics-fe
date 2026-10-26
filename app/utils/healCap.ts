// Repairs (the Repair faction ability and Repair Drones) only heal a ship up
// to HEAL_CAP_PERCENT of its max hull: Game.healCapPercent on chain, the win
// effects settings' healCapPercent in web2. Hardwired here rather than read;
// it's meant to change rarely if ever, and this is the one place to update.
// A ship already at the cap can't be picked as a repair target.

export const HEAL_CAP_PERCENT = 80;

/** The hull a repair stops at, rounded down as the contract does. */
export function healCapHull(maxHullPoints: number): number {
  return Math.floor((maxHullPoints * HEAL_CAP_PERCENT) / 100);
}

/** Whether a repair would do anything: the ship is below the cap. */
export function canBeRepaired(attrs: { hullPoints: number; maxHullPoints: number }): boolean {
  return attrs.hullPoints < healCapHull(attrs.maxHullPoints);
}

/** How much a repair of `strength` restores: up to the cap, never below 0. */
export function repairAmount(attrs: { hullPoints: number; maxHullPoints: number }, strength: number): number {
  return Math.max(0, Math.min(strength, healCapHull(attrs.maxHullPoints) - attrs.hullPoints));
}

/** The hull after a repair of `strength` (a ship past the cap keeps its hull). */
export function hullAfterRepair(attrs: { hullPoints: number; maxHullPoints: number }, strength: number): number {
  return attrs.hullPoints + repairAmount(attrs, strength);
}
