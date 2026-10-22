import type { Attributes } from "../types/types";

// How a run stores each roster ship's hull, and how to stamp that onto
// calculated Attributes (which otherwise always look like a full hull).

/** On-chain / GameLens getShipHP: 0 means not yet damaged this run (full). */
export function currentHullFromOnchainRosterHp(raw: number, maxHull: number): number {
  if (maxHull <= 0) return 0;
  return raw === 0 ? maxHull : Math.min(maxHull, Math.max(0, raw));
}

/** Web2 RoguelikeRosterShip.hp is damage taken (0 = full). */
export function currentHullFromWeb2RosterHp(damageTaken: number, maxHull: number): number {
  if (maxHull <= 0) return 0;
  return Math.min(maxHull, Math.max(0, maxHull - damageTaken));
}

/** Copy of `attributesMap` with each ship's hullPoints set to its roster hull. */
export function overlayHullPoints<K>(
  attributesMap: Map<K, Attributes>,
  currentHullFor: (id: K) => number | undefined,
): Map<K, Attributes> {
  const next = new Map<K, Attributes>();
  attributesMap.forEach((attrs, id) => {
    const hull = currentHullFor(id);
    next.set(
      id,
      hull == null || hull === attrs.hullPoints
        ? attrs
        : { ...attrs, hullPoints: Math.min(attrs.maxHullPoints, Math.max(0, hull)) },
    );
  });
  return next;
}
