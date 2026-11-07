"use client";

import React, { useEffect, useRef } from "react";
import { MINING_DRILL_MS } from "../../constants/animationTiming";
import { cellLayoutBox } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import {
  FX_CANVAS_STYLE,
  type RGB,
  attachOverlayCanvas,
  fxCellSize,
  mixRgb,
  prefersReducedMotion,
  radialGlow,
} from "./canvasFx";
import { playSoundEffect } from "../../hooks/useSoundEffects";
import { takeFirstPlay } from "./playOnce";
import { useWeaponSoundsMuted } from "./weaponSounds";

// The Mining Drill: a straight white-gold laser core with three helix strands
// winding round it, widening into a cone that bores into the target. Strands
// are brighter and thicker where they pass in front of the core, so it reads
// as a spinning vortex. At the hull: a white-hot bore, a spinning elliptical
// lip with a bright arc running round it, sparks flung off the spin, and a
// molten glow that builds while it grinds. It follows its sound: in REACH_MS
// the beam punches out to the hull while the spin winds up over WIND_MS;
// `once` (move playback) spins down from SPIN_DOWN_AT_MS, drawing the
// strands in, and is gone by MINING_DRILL_MS. Without it (the aiming
// preview) it keeps grinding. Drawn on one canvas added onto the board
// (canvasFx). Reviewed in the Mining Drill rework artifact (2026-11-06).
//
// One burst of the laser drill (mining-drill.wav, 1.4 s: spin up, grind,
// spin down) as the drill starts; a played-back move plays it once per move
// (soundOnceKey). It stops if the drill goes away first (after
// DRILL_STOP_AFTER_MS, so React's quick dev-mode remount doesn't cut it).
const DRILL_SOUND = "/sound/mining-drill.wav";
const DRILL_PLAYED_KEY = "vt-mining-drill-played-v1";
const DRILL_STOP_AFTER_MS = 200;

interface MiningDrillAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  attackerRow: number;
  attackerCol: number;
  targetRow: number;
  targetCol: number;
  facingRight: boolean;
  /**
   * The move being played back: the drill sound plays once per key this
   * session. Omitted (aiming preview), it plays each time the drill starts.
   */
  soundOnceKey?: string;
  /** Move playback: spin down and finish within MINING_DRILL_MS. Omitted (the aiming preview), it keeps grinding. */
  once?: boolean;
}

/** The emitter: this far forward of the ship's centre and up, as fractions of the cell. */
const EMITTER_FORWARD = 0.22;
const EMITTER_UP = 0.19;
/** The cone's radius at the hull, as a fraction of the cell. */
const CONE_RADIUS = 0.16;
const REACH_MS = 100;
const WIND_MS = 250;
const SPIN_DOWN_AT_MS = 1250;
const TURNS = 2.4;
/** Full spin, in radians per ms (2.2 turns a second). */
const OMEGA = (2.2 * 2 * Math.PI) / 1000;
const STRAND_STEPS = 48;
const LIP_STEPS = 36;
const SPARK_EVERY_MS = 30;

const STRANDS: RGB[] = [[255, 176, 32], [255, 229, 102], [255, 122, 26]];
const LIP: [RGB, RGB] = [[255, 150, 40], [255, 245, 210]];
const SPARK: [RGB, RGB] = [[255, 245, 200], [255, 90, 20]];

export type DrillLayout = { ox: number; oy: number; ex: number; ey: number; cellW: number; cellH: number };
export type DrillRun = { start: number; seed: number; once: boolean };

export function drillLayout(grid: HTMLElement, ar: number, ac: number, tr: number, tc: number, facingRight: boolean): DrillLayout {
  const a = cellLayoutBox(grid, ar, ac);
  const t = cellLayoutBox(grid, tr, tc);
  return {
    ox: a.x + a.width / 2 + (facingRight ? 1 : -1) * a.width * EMITTER_FORWARD,
    oy: a.y + a.height / 2 - a.height * EMITTER_UP,
    ex: t.x + t.width / 2,
    ey: t.y + t.height / 2,
    cellW: t.width,
    cellH: t.height,
  };
}

export function newDrillRun(start: number, once: boolean): DrillRun {
  return { start, seed: Math.random() * 1000, once };
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** How fast it spins (0–1) T ms in. */
function spinAt(T: number, once: boolean) {
  const up = Math.min(1, Math.max(0, T / WIND_MS));
  return once ? up * Math.min(1, Math.max(0, 1 - (T - SPIN_DOWN_AT_MS) / (MINING_DRILL_MS - SPIN_DOWN_AT_MS))) : up;
}

/** How far it has turned T ms in: the integral of OMEGA × spinAt. */
function phaseAt(T: number, once: boolean) {
  const W = WIND_MS;
  if (T < W) return (OMEGA * T * T) / (2 * W);
  const pW = (OMEGA * W) / 2;
  if (!once || T < SPIN_DOWN_AT_MS) return pW + OMEGA * (T - W);
  const span = MINING_DRILL_MS - SPIN_DOWN_AT_MS;
  const pD = pW + OMEGA * (SPIN_DOWN_AT_MS - W);
  const s = Math.min(T, MINING_DRILL_MS) - SPIN_DOWN_AT_MS;
  return pD + OMEGA * (s - (s * s) / (2 * span));
}

function segment(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, style: string) {
  ctx.strokeStyle = style;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** A beam widening from w0 at (x0, y0) to w1 at (x1, y1), rounded at the far end. */
function beam(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, fill: string) {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x0 + (nx * w0) / 2, y0 + (ny * w0) / 2);
  ctx.lineTo(x1 + (nx * w1) / 2, y1 + (ny * w1) / 2);
  ctx.arc(x1, y1, w1 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) - Math.PI, false);
  ctx.lineTo(x0 - (nx * w0) / 2, y0 - (ny * w0) / 2);
  ctx.closePath();
  ctx.fill();
}

/** Draws the drill at `now`. Exported for tests. */
export function paintDrill(ctx: CanvasRenderingContext2D, run: DrillRun, now: number, layout: DrillLayout, reduceMotion: boolean) {
  const T = now - run.start;
  if (T < 0 || (run.once && T >= MINING_DRILL_MS)) return;
  const fx = fxCellSize(layout.cellW);
  const { ox, oy, ex, ey } = layout;
  const dx = ex - ox;
  const dy = ey - oy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const reach = 1 - Math.pow(1 - Math.min(1, T / REACH_MS), 3);
  // Spin-down: the strands draw in and the beam fades.
  const fade = run.once ? Math.min(1, Math.max(0, 1 - (T - SPIN_DOWN_AT_MS) / (MINING_DRILL_MS - SPIN_DOWN_AT_MS))) : 1;
  const spin = spinAt(T, run.once);
  const phase = phaseAt(T, run.once);
  const R = Math.min(layout.cellW, layout.cellH) * CONE_RADIUS * (0.25 + 0.75 * fade);
  const tipX = ox + dx * reach;
  const tipY = oy + dy * reach;
  const flicker = 0.9 + 0.1 * Math.sin(T * 0.11);

  // The core: a white-gold beam in an orange glow.
  beam(ctx, ox, oy, tipX, tipY, fx * 0.05, fx * 0.07, `rgba(255,138,26,${0.3 * fade * flicker})`);
  beam(ctx, ox, oy, tipX, tipY, fx * 0.012, fx * 0.016, `rgba(255,246,200,${0.95 * fade})`);
  radialGlow(ctx, ox, oy, fx * 0.05, [
    [0, `rgba(255,246,210,${0.8 * fade})`],
    [0.4, `rgba(255,170,60,${0.5 * fade})`],
    [1, "rgba(255,120,20,0)"],
  ]);

  // Three strands, brighter and thicker where they pass in front of the core.
  STRANDS.forEach((rgb, s) => {
    let prev: { x: number; y: number; front: number } | null = null;
    for (let i = 0; i <= STRAND_STEPS; i++) {
      const f = (i / STRAND_STEPS) * reach;
      const r = R * f;
      const ang = -(f * TURNS * Math.PI * 2) - phase + (s * Math.PI * 2) / 3;
      const swirl = Math.cos(ang) * r;
      const depth = Math.sin(ang);
      const along = depth * r * 0.28;
      const cur = { x: ox + dx * f + px * swirl + ux * along, y: oy + dy * f + py * swirl + uy * along, front: (depth + 1) / 2 };
      if (prev) {
        const fr = (prev.front + cur.front) / 2;
        segment(ctx, prev.x, prev.y, cur.x, cur.y, fx * 0.022 * (0.55 + 0.45 * fr), `rgba(${rgb.join(",")},${(0.4 + 0.6 * fr) * fade * (s === 2 ? 0.8 : 0.95)})`);
      }
      prev = cur;
    }
  });
  if (reach < 1) return;

  // At the hull: molten heat, the bore, the spinning lip, sparks.
  const heat = Math.min(1, Math.max(0, (T - REACH_MS) / 600)) * fade;
  radialGlow(ctx, ex, ey, layout.cellW * 0.35, [
    [0, `rgba(255,200,120,${0.22 * heat})`],
    [0.45, `rgba(255,120,30,${0.18 * heat})`],
    [1, "rgba(255,90,20,0)"],
  ]);
  radialGlow(ctx, ex, ey, fx * 0.07 * flicker, [
    [0, `rgba(255,252,235,${0.95 * fade})`],
    [0.4, `rgba(255,200,90,${0.6 * fade})`],
    [1, "rgba(255,120,30,0)"],
  ]);
  const rim = (a: number) => ({
    x: ex + px * Math.cos(a) * R + ux * Math.sin(a) * R * 0.35,
    y: ey + py * Math.cos(a) * R + uy * Math.sin(a) * R * 0.35,
  });
  for (let i = 0; i < LIP_STEPS; i++) {
    const a0 = (i / LIP_STEPS) * Math.PI * 2;
    const a1 = ((i + 1) / LIP_STEPS) * Math.PI * 2;
    const q0 = rim(a0);
    const q1 = rim(a1);
    const highlight = Math.pow((1 + Math.cos(a0 + phase)) / 2, 6);
    const front = (1 + Math.sin(a0)) / 2;
    segment(ctx, q0.x, q0.y, q1.x, q1.y, fx * 0.014 * (0.6 + 0.4 * front), `rgba(${mixRgb(LIP[0], LIP[1], highlight)},${(0.35 + 0.55 * highlight) * (0.5 + 0.5 * front) * fade * spin})`);
  }
  // Sparks flung off the spinning lip while it grinds.
  const lastEmit = run.once ? Math.min(T, SPIN_DOWN_AT_MS) : T;
  for (let te = Math.max(REACH_MS, Math.floor((T - 340) / SPARK_EVERY_MS) * SPARK_EVERY_MS); te <= lastEmit; te += SPARK_EVERY_MS) {
    for (let j = 0; j < (reduceMotion ? 1 : 3); j++) {
      const id = te * 3 + j;
      const life = Math.min(200 + hash(run.seed * 31 + id) * 120, run.once ? MINING_DRILL_MS - te : Infinity);
      const age = T - te;
      if (age < 0 || age >= life) continue;
      const th = -phaseAt(te, run.once) + (j * Math.PI * 2) / 3 + hash(run.seed * 17 + id) * 0.8;
      const start = rim(th);
      // Along the lip's spin (its angle runs backwards), a little outward and back toward the drill.
      const vx = px * Math.sin(th) - ux * Math.cos(th) * 0.35 + px * Math.cos(th) * 0.5 - ux * 0.3;
      const vy = py * Math.sin(th) - uy * Math.cos(th) * 0.35 + py * Math.cos(th) * 0.5 - uy * 0.3;
      const vl = Math.hypot(vx, vy) || 1;
      const v = fx * (0.0022 + hash(run.seed * 7 + id) * 0.002);
      const q = age / life;
      const d = v * age * (1 - 0.4 * q);
      const d0 = Math.max(0, d - fx * 0.03);
      segment(ctx, start.x + (vx / vl) * d0, start.y + (vy / vl) * d0, start.x + (vx / vl) * d, start.y + (vy / vl) * d, 0.9, `rgba(${mixRgb(SPARK[0], SPARK[1], q)},${1 - q})`);
    }
  }
}

export const MiningDrillAnimation = React.memo(function MiningDrillAnimation({
  gridContainerRef,
  attackerRow,
  attackerCol,
  targetRow,
  targetCol,
  facingRight,
  soundOnceKey,
  once = false,
}: MiningDrillAnimationProps) {
  const soundsMuted = useWeaponSoundsMuted();
  const soundOnceKeyRef = useRef(soundOnceKey);
  const soundsMutedRef = useRef(soundsMuted);
  soundOnceKeyRef.current = soundOnceKey;
  soundsMutedRef.current = soundsMuted;
  const onceRef = useRef(once);
  onceRef.current = once;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aimRef = useRef({ attackerRow, attackerCol, targetRow, targetCol, facingRight });
  aimRef.current = { attackerRow, attackerCol, targetRow, targetCol, facingRight };
  /** A new attack starts the drill again. */
  const attackKey = `${attackerRow}-${attackerCol}-${targetRow}-${targetCol}-${facingRight ? 1 : 0}`;
  const attackKeyRef = useRef(attackKey);
  attackKeyRef.current = attackKey;

  useEffect(() => {
    const grid = gridContainerRef.current;
    const canvas = canvasRef.current;
    if (!grid || !canvas) return;
    const reduceMotion = prefersReducedMotion();
    const overlay = attachOverlayCanvas(grid, canvas);

    const key = soundOnceKeyRef.current;
    const drill =
      !soundsMutedRef.current && (key == null || takeFirstPlay(DRILL_PLAYED_KEY, key)) ? playSoundEffect(DRILL_SOUND) : null;
    const drillStartedAt = Date.now();

    let layout: DrillLayout | null = null;
    let layoutKey = "";
    const ro = new ResizeObserver(() => {
      layout = null;
    });
    ro.observe(grid);
    let run: DrillRun | null = null;
    let runKey = "";

    const paint = (now: number) => {
      if (!layout || layoutKey !== attackKeyRef.current) {
        const a = aimRef.current;
        layout = drillLayout(grid, a.attackerRow, a.attackerCol, a.targetRow, a.targetCol, a.facingRight);
        layoutKey = attackKeyRef.current;
      }
      if (!run || runKey !== attackKeyRef.current) {
        run = newDrillRun(now, onceRef.current);
        runKey = attackKeyRef.current;
      }
      const ctx = overlay.begin();
      if (!ctx) return;
      paintDrill(ctx, run, now, layout, reduceMotion);
    };

    const stopRaf = startCancelledRaf(paint);
    return () => {
      if (drill && Date.now() - drillStartedAt > DRILL_STOP_AFTER_MS) drill.pause();
      stopRaf();
      ro.disconnect();
      overlay.dispose();
    };
  }, [gridContainerRef]);

  return <canvas ref={canvasRef} className="absolute pointer-events-none z-20" style={FX_CANVAS_STYLE} aria-hidden="true" />;
});
