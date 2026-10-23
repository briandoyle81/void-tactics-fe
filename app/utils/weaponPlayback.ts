// How long one firing of each weapon lasts when a move plays back (the weapon
// fires once, then the board clears; see MovePlaybackLayer). The animations
// themselves loop for as long as they're mounted, so playback mounts the
// weapon for this long: one volley, beam pass or drone cycle, and long enough
// for its sound not to be cut off (a sound stops when its animation goes).
// Timings come from each animation (app/constants/animationTiming.ts and the
// sound lengths in public/sound/).

import {
  FLEE_GLOW_BUILD_MS,
  FLEE_ZOOM_DURATION_MS,
  LASER_TRACE_PERIOD_MS,
  MISSILE_IMPACT_DURATION_MS,
  MISSILE_SECOND_FIRE_DELAY_MS,
  RAILGUN_IMPACT_DURATION_MS,
  TORPEDO_IMPACT_DURATION_MS,
  TORPEDO_SPEED_SCALE,
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

/** The red laser's volley: its 7 snaps, 150 ms apart, then the last bolt fading. */
const LASER_VOLLEY_MS = 7 * 150 + 300;
const PLASMA_BURST_MS = 2700; // plasma-flame.wav
const MINING_DRILL_MS = 1400; // mining-drill.wav
const FLAK_MS = 1800; // flak.wav
const EMP_MS = 1300; // emp.wav
const LIGHTNING_MS = 2400; // lightning-field.wav
const DRONE_CYCLE_MS = 3200; // Repair / Attack drones' flight
const REPAIR_DRONES_MS = DRONE_CYCLE_MS + 360; // the last of 3 launches 360 ms in
const ATTACK_DRONES_MS = DRONE_CYCLE_MS + 450; // the last of 4 launches 450 ms in
const RAM_MS = 2400; // RamAnimation's cycle
const RETREAT_MS = 2700; // warp-collapse.wav (the flee is FLEE_GLOW_BUILD_MS + FLEE_ZOOM_DURATION_MS)

/** One firing's length in ms. `distanceCells` (straight-line) times the projectiles. */
export function weaponOnceMs(effect: WeaponEffectKind, distanceCells: number): number {
  const d = Math.max(0, distanceCells);
  switch (effect.kind) {
    case "main": {
      if (effect.mainWeapon === 0) return effect.variant === 2 ? LASER_TRACE_PERIOD_MS : LASER_VOLLEY_MS;
      if (effect.mainWeapon === 1) {
        // Railgun 8 cells/s, Linear Accelerator 3.5; then its impact.
        const flightMs = (d / (effect.variant === 2 ? 3.5 : 8)) * 1000;
        return Math.round(flightMs + RAILGUN_IMPACT_DURATION_MS + 150);
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
      return LIGHTNING_MS;
    case "repair":
      return REPAIR_DRONES_MS;
    case "attackDrones":
      return ATTACK_DRONES_MS;
    case "ram":
      return RAM_MS;
    case "retreat":
      return Math.max(RETREAT_MS, FLEE_GLOW_BUILD_MS + FLEE_ZOOM_DURATION_MS);
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
