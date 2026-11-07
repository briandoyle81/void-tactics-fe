"use client";

import { useEffect, useRef, useState } from "react";

// A disabled ship (0 HP, "SOS") as the board draws it: tilted round 15°,
// listing slowly as it drifts (`.sos-drift`), its hull burning
// (SosHullFires), a navigation strobe and two shorting points on its hull
// (SosHullFires `failing`), a red underglow pulsing S-O-S under it and the
// [SOS] tag. A ship disabled while you watch rolls into its tilt
// (`.sos-entering`, useSosEntry).

/** `.sos-drift` runs 9 s each way, alternating: one full sway. */
export const SOS_DRIFT_PERIOD_MS = 18000;
const DRIFT_MIN_DEG = 14.2;
const DRIFT_MAX_DEG = 15.8;
/** Its bob, as a fraction of the cell (translateY ±0.6%). */
const DRIFT_BOB = 0.006;

/**
 * Every disabled ship sways on one clock: `.sos-drift` starts this far into
 * its cycle (a negative animation-delay), so the board and the effects that
 * take a disabled ship over (the ram's victim, a retreat) agree on its pose.
 */
export function sosDriftDelay(nowMs = Date.now()): string {
  return `${-(nowMs % SOS_DRIFT_PERIOD_MS)}ms`;
}

// CSS's ease-in-out, cubic-bezier(.42, 0, .58, 1).
function easeInOutCss(x: number): number {
  let t = x;
  for (let i = 0; i < 6; i++) {
    const bx = 3 * (1 - t) * (1 - t) * t * 0.42 + 3 * (1 - t) * t * t * 0.58 + t * t * t - x;
    const d = 3 * (1 - t) * (1 - t) * 0.42 + 6 * (1 - t) * t * (0.58 - 0.42) + 3 * t * t * (1 - 0.58);
    if (Math.abs(d) < 1e-6) break;
    t = Math.min(1, Math.max(0, t - bx / d));
  }
  return 3 * (1 - t) * t * t + t * t * t;
}

/** A disabled ship's pose on the board now: its tilt (radians) and bob (fraction of the cell). */
export function sosDriftAt(nowMs = Date.now()): { rot: number; dy: number } {
  const p = nowMs % SOS_DRIFT_PERIOD_MS;
  const half = SOS_DRIFT_PERIOD_MS / 2;
  const e = easeInOutCss(p < half ? p / half : 1 - (p - half) / half);
  return {
    rot: ((DRIFT_MIN_DEG + (DRIFT_MAX_DEG - DRIFT_MIN_DEG) * e) * Math.PI) / 180,
    dy: -DRIFT_BOB + 2 * DRIFT_BOB * e,
  };
}

/** How long a ship disabled while you watch takes to roll into its tilt, its fires and tag fading in. */
export const SOS_ENTRY_MS = 1200;

/**
 * True for SOS_ENTRY_MS once the ship drawn here goes from working to
 * disabled while it's on screen. A ship that's already disabled when it
 * appears (the board loads, it moves here) doesn't play it.
 */
export function useSosEntry(shipId: number | null | undefined, disabled: boolean): boolean {
  const seen = useRef<{ shipId: number | null | undefined; disabled: boolean }>({ shipId, disabled });
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    const prev = seen.current;
    seen.current = { shipId, disabled };
    if (prev.shipId !== shipId || prev.disabled || !disabled) {
      if (!disabled) setEntering(false);
      return;
    }
    setEntering(true);
    const timer = window.setTimeout(() => setEntering(false), SOS_ENTRY_MS);
    return () => window.clearTimeout(timer);
  }, [shipId, disabled]);
  return entering && disabled;
}

function hashSeed(id: string | number) {
  const s = String(id);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SosFailingLayout = {
  /** The strobe, in % of the art box. */
  beacon: { left: number; top: number };
  /** Two shorting points (% of the art box), each a flash and three sparks every few seconds. */
  zaps: Array<{
    left: number;
    top: number;
    durationS: number;
    delayS: number;
    sparks: Array<{ angleDeg: number; distancePct: number }>;
  }>;
};

/** Where a ship's strobe and shorting points are: the same for a ship every time it's drawn. */
export function sosFailingLayout(shipId: string | number): SosFailingLayout {
  const rng = mulberry32(hashSeed(shipId) ^ 0x5f3a);
  const range = (a: number, b: number) => a + rng() * (b - a);
  const zaps = [0, 1].map((i) => ({
    left: range(18, 82),
    top: range(38, 62),
    durationS: range(3.4, 5.2),
    delayS: -range(0, 5) - i * 1.7,
    sparks: [0, 1, 2].map(() => ({ angleDeg: range(-170, -10), distancePct: range(75, 175) })),
  }));
  return { beacon: { left: range(40, 60), top: 4 }, zaps };
}
