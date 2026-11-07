// How long one firing of each weapon lasts when a move plays back (the weapon
// fires once, then the board clears; see MovePlaybackLayer). The animations
// themselves loop for as long as they're mounted, so playback mounts the
// weapon for this long: one volley, beam pass or drone cycle, and long enough
// for its sound not to be cut off (a sound stops when its animation goes).
// Timings come from each animation (app/constants/animationTiming.ts and the
// sound lengths in public/sound/).

import {
  ATTACK_DRONES_MS,
  EMP_MS,
  FLAK_MS,
  LASER_BEAM_COUNT,
  LASER_FIRE_INTERVAL_MS,
  LASER_SCORCH_MS,
  MINING_DRILL_MS,
  PLASMA_BURST_MS,
  REPAIR_DRONES_MS,
  LASER_TRACE_PERIOD_MS,
  LIGHTNING_FIELD_MS,
  MISSILE_IMPACT_DURATION_MS,
  MISSILE_SECOND_FIRE_DELAY_MS,
  RAILGUN_IMPACT_DURATION_MS,
  railgunChargeMs,
  railgunSpeedCellsPerSec,
  TORPEDO_IMPACT_DURATION_MS,
  TORPEDO_SPEED_SCALE,
  RAM_MS,
  RETREAT_MS,
} from "../constants/animationTiming";

/** What a move fires: its main weapon, a special (by kind) or the faction ability. */
export type WeaponEffectKind =
  | { kind: "main"; mainWeapon: number; variant: number }
  | { kind: "flak" }
  | { kind: "emp" }
  | { kind: "lightning" }
  | { kind: "repair" }
  | { kind: "attackDrones" }
  | { kind: "ram" }
  | { kind: "retreat" }
  | { kind: "none" };

/** The red laser's volley: 7 needles 150 ms apart (1,300 ms with the last scorch), rounded up to the 1,350 ms it has always had. */
const LASER_VOLLEY_MS = Math.max(1350, (LASER_BEAM_COUNT - 1) * LASER_FIRE_INTERVAL_MS + LASER_SCORCH_MS);

/** One firing's length in ms. `distanceCells` (straight-line) times the projectiles. */
export function weaponOnceMs(effect: WeaponEffectKind, distanceCells: number): number {
  const d = Math.max(0, distanceCells);
  switch (effect.kind) {
    case "main": {
      if (effect.mainWeapon === 0) return effect.variant === 2 ? LASER_TRACE_PERIOD_MS : LASER_VOLLEY_MS;
      if (effect.mainWeapon === 1) {
        // The charge, the flight (Railgun 8 cells/s, Linear Accelerator 3.5), then its impact.
        const flightMs = (d / railgunSpeedCellsPerSec(effect.variant)) * 1000;
        return Math.round(railgunChargeMs(effect.variant) + flightMs + RAILGUN_IMPACT_DURATION_MS + 150);
      }
      if (effect.mainWeapon === 2) {
        // Missiles drift 0.5 s, then fly at 4 cells/s (torpedoes slower); the
        // second missile is MISSILE_SECOND_FIRE_DELAY_MS behind; then the impact.
        const torpedo = effect.variant === 2;
        const speed = 4 * (torpedo ? TORPEDO_SPEED_SCALE : 1);
        const flightMs = (0.5 + d / speed) * 1000 + (torpedo ? 0 : MISSILE_SECOND_FIRE_DELAY_MS);
        return Math.round(flightMs + (torpedo ? TORPEDO_IMPACT_DURATION_MS : MISSILE_IMPACT_DURATION_MS) + 150);
      }
      if (effect.mainWeapon === 3) return effect.variant === 2 ? MINING_DRILL_MS : PLASMA_BURST_MS;
      return 0;
    }
    case "flak":
      return FLAK_MS;
    case "emp":
      return EMP_MS;
    case "lightning":
      return LIGHTNING_FIELD_MS;
    case "repair":
      return REPAIR_DRONES_MS;
    case "attackDrones":
      return ATTACK_DRONES_MS;
    case "ram":
      return RAM_MS;
    case "retreat":
      return RETREAT_MS;
    case "none":
      return 0;
  }
}

/** ActionType values (app/types/types.ts), as numbers so this file stays mode-neutral. */
const ACTION_SHOOT = 1;
const ACTION_RETREAT = 2;
const ACTION_SPECIAL = 4;
const ACTION_FACTION_ABILITY = 7;

/** What a move by this ship fires, from its action and equipment. */
export function weaponEffectFor(
  actionType: number,
  ship: { variant: number; mainWeapon: number; special: number },
): WeaponEffectKind {
  const variant = Number(ship.variant);
  if (actionType === ACTION_SHOOT) return { kind: "main", mainWeapon: Number(ship.mainWeapon), variant };
  if (actionType === ACTION_RETREAT) return { kind: "retreat" };
  if (actionType === ACTION_FACTION_ABILITY) return variant === 2 ? { kind: "repair" } : { kind: "ram" };
  if (actionType === ACTION_SPECIAL) {
    const slot = Number(ship.special);
    if (variant === 2) {
      if (slot === 1) return { kind: "lightning" };
      if (slot === 2) return { kind: "attackDrones" };
      return { kind: "none" }; // Aux Engine: nothing to fire
    }
    if (slot === 1) return { kind: "emp" };
    if (slot === 2) return { kind: "repair" };
    if (slot === 3) return { kind: "flak" };
  }
  return { kind: "none" };
}
