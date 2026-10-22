"use client";

import { useEffect } from "react";
import { playSoundEffect } from "../../hooks/useSoundEffects";
import { takeFirstPlay } from "./playOnce";
import { useWeaponSoundsMuted } from "./weaponSounds";
import { MISSILE_SECOND_FIRE_DELAY_MS, TORPEDO_SPEED_SCALE } from "../../constants/animationTiming";

// A destroyed ship's explosion (ship-explosion.wav, 3.3 s: subsystems
// popping, then the reactor going up). GameGridOverlays renders this when the
// last move destroyed its target; it plays once per move, just after the
// weapon's own hit (shipExplosionDelayMs), and stays silent in the hero demo.

const EXPLOSION_SOUND = "/sound/ship-explosion.wav";
const EXPLOSION_PITCH_VARIATION = 0.05;
const EXPLOSION_PLAYED_KEY = "vt-ship-explosion-played-v1";
/** After the weapon's hit, so its own impact sound leads. */
const AFTER_HIT_MS = 250;

/** How the killing blow was delivered, for timing the explosion to its hit. */
export type KillingBlow =
  | { kind: "ram" }
  | { kind: "weapon"; mainWeapon: number; variant: number; distanceCells: number }
  | { kind: "other" };

/**
 * When the explosion starts after the last move's animation begins: the
 * weapon's hit (from each animation's own timing) plus AFTER_HIT_MS.
 */
export function shipExplosionDelayMs(blow: KillingBlow): number {
  let hitS = 0.3;
  if (blow.kind === "ram") {
    hitS = 0.67; // RamAnimation: first impact ~28% into its 2.4 s cycle
  } else if (blow.kind === "weapon") {
    const d = Math.max(0, blow.distanceCells);
    if (blow.mainWeapon === 0) {
      hitS = 0.15; // Laser / Mining Laser: beams land at once
    } else if (blow.mainWeapon === 1) {
      hitS = d / (blow.variant === 2 ? 3.5 : 8); // Railgun 8 cells/s; Linear Accelerator 3.5
    } else if (blow.mainWeapon === 2) {
      // Missiles drift 0.5 s, then fly at 4 cells/s (torpedoes slower); the
      // kill comes with the last missile, MISSILE_SECOND_FIRE_DELAY_MS behind.
      const speed = 4 * (blow.variant === 2 ? TORPEDO_SPEED_SCALE : 1);
      const last = blow.variant === 2 ? 0 : MISSILE_SECOND_FIRE_DELAY_MS / 1000;
      hitS = 0.5 + d / speed + last;
    } else if (blow.mainWeapon === 3) {
      hitS = 0.4; // Plasma stream / Mining Drill
    }
  }
  return Math.round(hitS * 1000) + AFTER_HIT_MS;
}

export function ShipExplosionSound({ playKey, delayMs }: { playKey: string; delayMs: number }) {
  const muted = useWeaponSoundsMuted();
  useEffect(() => {
    if (muted || !takeFirstPlay(EXPLOSION_PLAYED_KEY, playKey)) return;
    const timer = window.setTimeout(
      () => playSoundEffect(EXPLOSION_SOUND, { pitchVariation: EXPLOSION_PITCH_VARIATION }),
      delayMs,
    );
    return () => window.clearTimeout(timer);
    // Once per key: the delay is read when the move first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, muted]);
  return null;
}
