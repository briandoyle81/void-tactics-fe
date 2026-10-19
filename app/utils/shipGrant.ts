import type { ShipVisual } from "../types/shipVisual";

// A roguelike node's reward ship (ShipGrantWinEffect.ShipGrant, see
// docs/frontend-handoff-2026-10-19.md §2): the exact ship a win at that node
// mints, already constructed. Number-native and shared by web3 (the
// contract's getGrant/setGrant, converted in useShipGrants.ts) and web2 (the
// RoguelikeShipGrant table, app/lib/shipGrantsWeb2.ts), so the admin form,
// the mission drawer and the win screen speak one shape. Safe on client and
// server.

export interface ShipGrantColors {
  h1: number;
  s1: number;
  l1: number;
  h2: number;
  s2: number;
  l2: number;
  h3: number;
  s3: number;
  l3: number;
}

export interface ShipGrantSpec {
  name: string;
  equipment: { mainWeapon: number; armor: number; shields: number; special: number };
  colors: ShipGrantColors;
  variant: number;
  accuracy: number;
  hull: number;
  speed: number;
  /** Sets the rank (see calculateShipRank). */
  shipsDestroyed: number;
  shiny: boolean;
  /** A free ship can't be recycled and pays no kill UTC. */
  isFreeShip: boolean;
  /** Each player gets this node's ship at most once, across all runs. */
  oncePerAddress: boolean;
}

/** accuracy/hull/speed range, as the contract checks it (InvalidTraitValue). */
export const SHIP_GRANT_TRAIT_MAX = 2;
/** Main weapon, armor and shields levels the equipment enums allow. */
export const SHIP_GRANT_EQUIPMENT_MAX = 3;
const NAME_MAX = 64;

export const DEFAULT_SHIP_GRANT: ShipGrantSpec = {
  name: "Reward Ship",
  equipment: { mainWeapon: 0, armor: 0, shields: 0, special: 0 },
  colors: { h1: 220, s1: 50, l1: 50, h2: 220, s2: 50, l2: 50, h3: 220, s3: 50, l3: 50 },
  variant: 1,
  accuracy: 0,
  hull: 0,
  speed: 0,
  shipsDestroyed: 0,
  shiny: false,
  isFreeShip: false,
  oncePerAddress: true,
};

const isIntIn = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/**
 * Why `setGrant` would reject this grant (or a value out of the field's
 * range), or null if it's valid. Mirrors ShipGrantWinEffect's checks:
 * InvalidTraitValue, InvalidVariant (0 or above maxVariant) and
 * ArmorAndShieldsBothSet. Web2's API runs the same check.
 */
export function shipGrantError(spec: ShipGrantSpec, maxVariant: number): string | null {
  if (!spec.name.trim()) return "The ship needs a name.";
  if (spec.name.length > NAME_MAX) return `The name can be at most ${NAME_MAX} characters.`;
  if (!isIntIn(spec.variant, 1, maxVariant)) return `Variant must be 1–${maxVariant}.`;
  for (const key of ["accuracy", "hull", "speed"] as const) {
    if (!isIntIn(spec[key], 0, SHIP_GRANT_TRAIT_MAX)) return `${key} must be 0–${SHIP_GRANT_TRAIT_MAX}.`;
  }
  const { mainWeapon, armor, shields, special } = spec.equipment;
  if (!isIntIn(mainWeapon, 0, SHIP_GRANT_EQUIPMENT_MAX)) return "Unknown main weapon.";
  if (!isIntIn(armor, 0, SHIP_GRANT_EQUIPMENT_MAX)) return "Unknown armor level.";
  if (!isIntIn(shields, 0, SHIP_GRANT_EQUIPMENT_MAX)) return "Unknown shield level.";
  if (armor > 0 && shields > 0) return "A ship can't have both armor and shields.";
  if (!isIntIn(special, 0, 255)) return "Unknown special.";
  const c = spec.colors;
  for (const n of [1, 2, 3] as const) {
    const h = c[`h${n}`];
    const s = c[`s${n}`];
    const l = c[`l${n}`];
    if (!isIntIn(h, 0, 360) || !isIntIn(s, 0, 100) || !isIntIn(l, 0, 100)) return `Color ${n} is out of range.`;
  }
  if (!isIntIn(spec.shipsDestroyed, 0, 4_294_967_295)) return "Kills must be a whole number.";
  return null;
}

/**
 * Parses an untrusted value (an API body, a stored JSON row) into a grant,
 * or null if it isn't one. Field ranges are checked by shipGrantError.
 */
export function parseShipGrant(value: unknown): ShipGrantSpec | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const eq = (v.equipment ?? {}) as Record<string, unknown>;
  const col = (v.colors ?? {}) as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === "number" ? x : Number.NaN);
  if (typeof v.name !== "string") return null;
  return {
    name: v.name,
    equipment: {
      mainWeapon: num(eq.mainWeapon),
      armor: num(eq.armor),
      shields: num(eq.shields),
      special: num(eq.special),
    },
    colors: {
      h1: num(col.h1), s1: num(col.s1), l1: num(col.l1),
      h2: num(col.h2), s2: num(col.s2), l2: num(col.l2),
      h3: num(col.h3), s3: num(col.s3), l3: num(col.l3),
    },
    variant: num(v.variant),
    accuracy: num(v.accuracy),
    hull: num(v.hull),
    speed: num(v.speed),
    shipsDestroyed: num(v.shipsDestroyed),
    shiny: v.shiny === true,
    isFreeShip: v.isFreeShip === true,
    oncePerAddress: v.oncePerAddress === true,
  };
}

/** The grant's appearance and rank, for the renderer and rank helpers. */
export function shipGrantToVisual(spec: ShipGrantSpec): ShipVisual {
  const { h1, s1, l1, h2, s2, l2 } = spec.colors;
  return {
    equipment: spec.equipment,
    traits: {
      colors: { h1, s1, l1, h2, s2, l2 },
      variant: spec.variant,
      accuracy: spec.accuracy,
      hull: spec.hull,
      speed: spec.speed,
    },
    shipData: {
      shipsDestroyed: spec.shipsDestroyed,
      shiny: spec.shiny,
      constructed: true,
      timestampDestroyed: 0,
    },
  };
}

/** A node's reward ship plus whether this player already received a once-only one. */
export interface NodeRewardShip {
  grant: ShipGrantSpec;
  /** Only meaningful when grant.oncePerAddress; false when signed out. */
  claimed: boolean;
}
