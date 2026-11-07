// Laser (variant 1 needle volley)
/** One needle beam every this many ms. */
export const LASER_FIRE_INTERVAL_MS = 150;
/** Beams in one volley (move playback), one laser-snap each. */
export const LASER_BEAM_COUNT = 7;
/** A beam's life, from landing to gone. */
export const LASER_BEAM_LIFE_MS = 130;
/** A hit's scorch cools over this long; the volley's last scorch ends it. */
export const LASER_SCORCH_MS = 400;
// Mining Laser (variant 2 wander beam)
export const LASER_TRACE_PERIOD_MS = 2800;

// Flak
/** One Flak Array barrage in move playback: the length of flak.wav. */
export const FLAK_MS = 1800;

// Lightning Field
/** One Lightning Field storm in move playback: the length of lightning-field.wav. */
export const LIGHTNING_FIELD_MS = 2400;

// Railgun
/** Railgun: everything after the hit (flash, spall, afterglow) is over within this. */
export const RAILGUN_IMPACT_DURATION_MS = 650;
/** The aiming preview fires again this long after each hit. */
export const RAILGUN_RESPAWN_DELAY_MS = 2000;
/** The charge before launch: Railgun 100 ms, Linear Accelerator 180 ms. */
export function railgunChargeMs(variant: number) {
  return Number(variant) === 2 ? 180 : 100;
}
/** The slug's speed: Railgun 8 cells/s, Linear Accelerator 3.5. */
export function railgunSpeedCellsPerSec(variant: number) {
  return Number(variant) === 2 ? 3.5 : 8;
}

// Missile
/** Missiles: everything after a missile's hit is over within this (a torpedo's: TORPEDO_IMPACT_DURATION_MS). */
export const MISSILE_IMPACT_DURATION_MS = 500;
/** A missile drifts out of its launcher this long before its motor lights. */
export const MISSILE_DRIFT_MS = 500;
/** The Missile Launcher's second missile fires this long after the first. */
export const MISSILE_SECOND_FIRE_DELAY_MS = 200;
/** The aiming preview fires again this long after the volley's last hit. */
export const MISSILE_RESPAWN_DELAY_MS = 1000;
export const TORPEDO_SPEED_SCALE = 0.66;
export const TORPEDO_IMPACT_DURATION_MS = 900;

// Plasma
/** One plasma burst in move playback: the length of plasma-flame.wav. */
export const PLASMA_BURST_MS = 2700;
/** Move playback: the stream stops firing here, and its last plasma lands and cools before PLASMA_BURST_MS. */
export const PLASMA_FIRE_MS = 2000;
/** One Mining Drill burst: the length of mining-drill.wav (spin up, grind, spin down). */
export const MINING_DRILL_MS = 1400;

/** One Repair Drones sortie in move playback: the last of the three drones is home by 3,260 ms. */
export const REPAIR_DRONES_MS = 3300;

/** One Attack Drones sortie in move playback: the last wave is home by 3,350 ms. */
export const ATTACK_DRONES_MS = 3400;

/** One EMP pulse in move playback (emp.wav). */
export const EMP_MS = 1300;

// Hold (same-tile): fade to hologram, hold, fade to solid, hold, repeat
export const HOLD_HOLOGRAM_FADE_MS = 500;
export const HOLD_HOLOGRAM_HOLD_MS = 250;
export const HOLD_HOLOGRAM_CYCLE_MS =
  HOLD_HOLOGRAM_FADE_MS + HOLD_HOLOGRAM_HOLD_MS + HOLD_HOLOGRAM_FADE_MS + HOLD_HOLOGRAM_HOLD_MS;

// Retreat
/** One retreat in move playback: the length of warp-collapse.wav (RetreatAnimation is over by 2,450 ms). */
export const RETREAT_MS = 2700;
/** The retreat preview while aiming: its engine glow builds over this long. */
export const RETREAT_GLOW_BUILD_MS = 600;

// Ram
/** One ram in move playback (after its slide): back off, charge, the hit, the victim knocked off the board. */
export const RAM_MS = 1250;
/** The ram's hit (the crash and the board shake), from the start of the ram. */
export const RAM_HIT_MS = 340;
