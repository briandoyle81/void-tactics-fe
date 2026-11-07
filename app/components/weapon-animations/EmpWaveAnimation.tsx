"use client";

import React, { useEffect, useRef } from "react";
import { EMP_MS } from "../../constants/animationTiming";
import { cellLayoutBox } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import {
  FX_CANVAS_STYLE,
  attachOverlayCanvas,
  fxCellSize,
  prefersReducedMotion,
  radialGlow,
  strokeRing,
  strokeSegment,
} from "./canvasFx";
import { playSoundEffect } from "../../hooks/useSoundEffects";
import { takeFirstPlay } from "./playOnce";
import { useWeaponSoundsMuted } from "./weaponSounds";

// The EMP: a radio wavefront, not a beam. Nothing connects the two ships.
// It follows its sound (emp.wav, 1.3 s: charge, discharge, wave, power-down):
// - charge, 0–CHARGE_MS: rings converge on the ship and a glow builds;
// - discharge: a flash, then FRONTS curved wavefronts (arcs FRONT_SPREAD
//   wide, centred on the ship, aimed at the target) spread out towards it,
//   FRONT_GAP_MS apart, fading just past it;
// - each front lands with a flash and the target fills with static
//   (scanlines, noise, sparks: light only, nothing darkens the ship);
// - switch-off, from CUT_MS: the static collapses to a bright line across
//   the ship, then a dot, like a screen switching off; gone by EMP_MS.
// `once` (move playback) plays it once; without it (the aiming preview) it
// repeats every LOOP_MS. From cell centre to cell centre, so facing doesn't
// matter. Drawn on one canvas added onto the board (canvasFx). Reviewed in
// the EMP rework artifact (option 1, 2026-11-06).
//
// One EMP sound as it starts; a played-back move plays it once per move
// (soundOnceKey). It stops if the effect goes away first (after
// SOUND_STOP_AFTER_MS, so React's quick dev-mode remount doesn't cut it).
const EMP_SOUND = "/sound/emp.wav";
const EMP_PITCH_VARIATION = 0.05;
const EMP_PLAYED_KEY = "vt-emp-played-v1";
const SOUND_STOP_AFTER_MS = 200;

interface EmpWaveAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  attackerRow: number;
  attackerCol: number;
  targetRow: number;
  targetCol: number;
  /**
   * The move being played back: the sound plays once per key this session.
   * Omitted (aiming preview), it plays each time the effect appears.
   */
  soundOnceKey?: string;
  /** Move playback: one pulse, gone by EMP_MS. Omitted (the aiming preview), it repeats. */
  once?: boolean;
}

const CHARGE_MS = 250;
const FRONTS = 4;
const FRONT_GAP_MS = 55;
/** Wavefront speed, in cells per ms (about 14.5 cells a second). */
const FRONT_SPEED = 3.2 / 220;
/** Where a front starts, as a fraction of an effect cell from the ship's centre. */
const FRONT_START = 0.06;
/** Each front's full width (angle). */
const FRONT_SPREAD = (28 * Math.PI) / 180;
const CUT_MS = 1120;
/** The aiming preview repeats the pulse this often. */
const LOOP_MS = 1500;

const CYAN = "86,214,255";
const ORANGE = "255,184,77";
const WHITE = "230,250,255";

export type EmpLayout = { ax: number; ay: number; tx: number; ty: number; cellW: number; cellH: number };
export type EmpRun = { start: number; seed: number; once: boolean };

export function empLayout(grid: HTMLElement, ar: number, ac: number, tr: number, tc: number): EmpLayout {
  const a = cellLayoutBox(grid, ar, ac);
  const t = cellLayoutBox(grid, tr, tc);
  return { ax: a.x + a.width / 2, ay: a.y + a.height / 2, tx: t.x + t.width / 2, ty: t.y + t.height / 2, cellW: t.width, cellH: t.height };
}

export function newEmpRun(start: number, once: boolean): EmpRun {
  return { start, seed: Math.random() * 1000, once };
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

function stroke(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, width: number, style: string) {
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

function arc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a0: number, a1: number, width: number, style: string) {
  if (!(r > 0)) return;
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a1);
  ctx.stroke();
}

/** Interference over the target's cell: scanlines, noise and a few sparks. */
function paintStatic(ctx: CanvasRenderingContext2D, layout: EmpLayout, k: number, tick: number, seed: number) {
  if (!(k > 0.01)) return;
  const { tx, ty, cellW, cellH } = layout;
  const W = cellW * 0.8;
  const H = cellH * 0.7;
  const x0 = tx - W / 2;
  const y0 = ty - H / 2;
  const unit = cellW / 50;
  const bands = Math.round(3 + 7 * k);
  for (let i = 0; i < bands; i++) {
    const h1 = hash(seed * 13 + tick * 7 + i * 3);
    const h2 = hash(seed * 5 + tick * 11 + i * 17);
    const h3 = hash(seed + tick * 3 + i * 29);
    const y = y0 + h1 * H;
    const len = W * (0.18 + 0.6 * h2);
    const x = x0 + h3 * (W - len);
    const rgb = i % 4 === 0 ? ORANGE : i % 3 === 0 ? WHITE : CYAN;
    strokeSegment(ctx, x, y, x + len, y, (0.6 + 1.1 * h2) * unit, `rgba(${rgb},${k * (0.35 + 0.5 * h3)})`);
  }
  ctx.fillStyle = `rgba(${WHITE},${0.7 * k})`;
  const dots = Math.round(24 * k);
  const dot = 0.9 * unit;
  for (let i = 0; i < dots; i++) {
    ctx.fillRect(x0 + hash(seed * 3 + tick * 19 + i * 7) * W, y0 + hash(seed * 7 + tick * 23 + i * 5) * H, dot, dot);
  }
  for (let i = 0; i < 2; i++) {
    if (hash(seed + tick * 5 + i * 41) > 0.35 + 0.4 * (1 - k)) continue;
    const ang = hash(seed * 9 + tick + i * 13) * Math.PI * 2;
    const pts: Array<[number, number]> = [];
    for (let s = 0; s <= 3; s++) {
      const rr = cellW * (0.3 + s * 0.05);
      const j = (hash(seed + i * 7 + s * 3 + tick) - 0.5) * 0.6;
      pts.push([tx + Math.cos(ang + j) * rr, ty + Math.sin(ang + j) * rr]);
    }
    stroke(ctx, pts, 1.6 * unit, `rgba(${CYAN},${0.35 * k})`);
    stroke(ctx, pts, 0.7 * unit, `rgba(${WHITE},${0.95 * k})`);
  }
}

/** When each front reaches the target, ms into the pulse. */
function frontArrivals(layout: EmpLayout) {
  const fx = fxCellSize(layout.cellW);
  const len = Math.hypot(layout.tx - layout.ax, layout.ty - layout.ay);
  const speed = FRONT_SPEED * layout.cellW;
  return Array.from({ length: FRONTS }, (_, i) => CHARGE_MS + i * FRONT_GAP_MS + Math.max(0, len - fx * FRONT_START) / speed);
}

/** Draws the EMP at `now`. Exported for tests. */
export function paintEmp(ctx: CanvasRenderingContext2D, run: EmpRun, now: number, layout: EmpLayout, reduceMotion: boolean) {
  const elapsed = now - run.start;
  if (elapsed < 0 || (run.once && elapsed >= EMP_MS)) return;
  const t = run.once ? elapsed : elapsed % LOOP_MS;
  if (t >= EMP_MS) return;
  const cycle = run.once ? 0 : Math.floor(elapsed / LOOP_MS);
  const seed = run.seed * 31 + cycle;
  const fx = fxCellSize(layout.cellW);
  const unit = layout.cellW / 50;
  const { ax, ay, tx, ty, cellW } = layout;
  const len = Math.hypot(tx - ax, ty - ay) || 1;
  const ang = Math.atan2(ty - ay, tx - ax);

  // Charge: rings converge on the ship and a glow builds.
  if (t < CHARGE_MS + 60) {
    const k = t < CHARGE_MS ? easeOut(t / CHARGE_MS) : 1 - (t - CHARGE_MS) / 60;
    radialGlow(ctx, ax, ay, fx * 0.1 * (0.4 + 0.6 * k), [
      [0, `rgba(${WHITE},${0.85 * k})`],
      [0.35, `rgba(${CYAN},${0.5 * k})`],
      [1, `rgba(${CYAN},0)`],
    ]);
    if (t < CHARGE_MS) {
      for (let i = 0; i < 3; i++) {
        const p = ((t + i * 80) % 240) / 240;
        strokeRing(ctx, ax, ay, fx * 0.2 * (1 - p), (0.6 + 0.8 * p) * unit, `rgba(${CYAN},${0.6 * p * k})`);
      }
    }
  }
  if (t < CHARGE_MS) return;

  // Discharge: a flash at the ship.
  if (t < CHARGE_MS + 90) {
    const k = (1 - (t - CHARGE_MS) / 90) ** 2;
    radialGlow(ctx, ax, ay, fx * 0.13, [
      [0, `rgba(255,255,255,${k})`],
      [0.3, `rgba(150,230,255,${0.8 * k})`],
      [1, `rgba(${CYAN},0)`],
    ]);
  }

  // The wavefronts: arcs centred on the ship, aimed at the target, spreading as they travel.
  const half = FRONT_SPREAD / 2;
  const speed = FRONT_SPEED * cellW;
  for (let i = 0; i < FRONTS; i++) {
    const e = t - CHARGE_MS - i * FRONT_GAP_MS;
    if (e < 0) continue;
    const r = fx * FRONT_START + speed * e;
    const k = clamp01(e / 30) * clamp01(1 - (r - len) / (cellW * 0.6)) * (1 - 0.25 * Math.min(1, r / (len + cellW)));
    if (!(k > 0)) continue;
    arc(ctx, ax, ay, r, ang - half, ang + half, fx * 0.03, `rgba(${CYAN},${0.12 * k})`);
    arc(ctx, ax, ay, r, ang - half * 0.75, ang + half * 0.75, fx * 0.014, `rgba(${CYAN},${0.45 * k})`);
    arc(ctx, ax, ay, r, ang - half * 0.45, ang + half * 0.45, unit, `rgba(${i % 2 ? ORANGE : WHITE},${0.95 * k})`);
  }

  // The target: each front lands with a flash, static builds, then it switches off.
  const arrivals = frontArrivals(layout);
  const first = arrivals[0];
  if (t < first) return;
  for (const h of arrivals) {
    const e = t - h;
    if (e < 0 || e >= 110) continue;
    const k = (1 - e / 110) ** 2;
    radialGlow(ctx, tx, ty, cellW * 0.32, [
      [0, `rgba(${WHITE},${0.6 * k})`],
      [0.4, `rgba(${CYAN},${0.35 * k})`],
      [1, `rgba(${CYAN},0)`],
    ]);
  }
  if (t < CUT_MS) {
    let k = 0.3;
    for (const h of arrivals) if (t >= h) k += Math.exp(-(t - h) / 230);
    const tick = Math.floor(t / 35);
    const stutter = !reduceMotion && hash(seed + tick * 3) < 0.15 ? 0.35 : 1;
    paintStatic(ctx, layout, Math.min(1, k) * stutter * clamp01((t - first) / 40), reduceMotion ? Math.floor(t / 105) : tick, seed);
    return;
  }
  const p = clamp01((t - CUT_MS) / (EMP_MS - CUT_MS));
  const w = p < 0.55 ? cellW * 0.75 * (1 - 0.15 * p) : cellW * 0.67 * (1 - (p - 0.55) / 0.35);
  const k = p < 0.55 ? 1 : clamp01(1 - (p - 0.55) / 0.45);
  if (w > 0.5) {
    strokeSegment(ctx, tx - w / 2, ty, tx + w / 2, ty, 5 * unit, `rgba(${CYAN},${0.25 * k})`);
    strokeSegment(ctx, tx - w / 2, ty, tx + w / 2, ty, 1.3 * unit, `rgba(${WHITE},${0.95 * k})`);
  }
  radialGlow(ctx, tx, ty, cellW * 0.08, [
    [0, `rgba(255,255,255,${0.9 * k})`],
    [1, `rgba(${CYAN},0)`],
  ]);
}

export const EmpWaveAnimation = React.memo(function EmpWaveAnimation({
  gridContainerRef,
  attackerRow,
  attackerCol,
  targetRow,
  targetCol,
  soundOnceKey,
  once = false,
}: EmpWaveAnimationProps) {
  const soundsMuted = useWeaponSoundsMuted();
  const soundOnceKeyRef = useRef(soundOnceKey);
  const soundsMutedRef = useRef(soundsMuted);
  soundOnceKeyRef.current = soundOnceKey;
  soundsMutedRef.current = soundsMuted;
  const onceRef = useRef(once);
  onceRef.current = once;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aimRef = useRef({ attackerRow, attackerCol, targetRow, targetCol });
  aimRef.current = { attackerRow, attackerCol, targetRow, targetCol };
  /** A new target starts the pulse again. */
  const attackKey = `${attackerRow}-${attackerCol}-${targetRow}-${targetCol}`;
  const attackKeyRef = useRef(attackKey);
  attackKeyRef.current = attackKey;

  useEffect(() => {
    const grid = gridContainerRef.current;
    const canvas = canvasRef.current;
    if (!grid || !canvas) return;
    const reduceMotion = prefersReducedMotion();
    const overlay = attachOverlayCanvas(grid, canvas);

    const key = soundOnceKeyRef.current;
    const audio =
      !soundsMutedRef.current && (key == null || takeFirstPlay(EMP_PLAYED_KEY, key))
        ? playSoundEffect(EMP_SOUND, { pitchVariation: EMP_PITCH_VARIATION })
        : null;
    const startedAt = Date.now();

    let layout: EmpLayout | null = null;
    let layoutKey = "";
    const ro = new ResizeObserver(() => {
      layout = null;
    });
    ro.observe(grid);
    let run: EmpRun | null = null;
    let runKey = "";

    const paint = (now: number) => {
      if (!layout || layoutKey !== attackKeyRef.current) {
        const a = aimRef.current;
        layout = empLayout(grid, a.attackerRow, a.attackerCol, a.targetRow, a.targetCol);
        layoutKey = attackKeyRef.current;
      }
      if (!run || runKey !== attackKeyRef.current) {
        run = newEmpRun(now, onceRef.current);
        runKey = attackKeyRef.current;
      }
      const ctx = overlay.begin();
      if (!ctx) return;
      paintEmp(ctx, run, now, layout, reduceMotion);
    };

    const stopRaf = startCancelledRaf(paint);
    return () => {
      if (audio && Date.now() - startedAt > SOUND_STOP_AFTER_MS) audio.pause();
      stopRaf();
      ro.disconnect();
      overlay.dispose();
    };
  }, [gridContainerRef]);

  return <canvas ref={canvasRef} className="absolute pointer-events-none z-20" style={FX_CANVAS_STYLE} aria-hidden="true" />;
});
