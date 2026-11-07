"use client";

import React, { useEffect, useRef } from "react";
import { LIGHTNING_FIELD_MS } from "../../constants/animationTiming";
import { GRID_DIMENSIONS } from "../../types/types";
import { cellLayoutBox } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import { FX_CANVAS_STYLE, attachOverlayCanvas, fxCellSize, prefersReducedMotion, radialGlow, strokeRing } from "./canvasFx";
import { playSoundEffect } from "../../hooks/useSoundEffects";
import { takeFirstPlay } from "./playOnce";
import { useWeaponSoundsMuted } from "./weaponSounds";

// The Lightning Field: an electric storm over every cell in range of the
// ship, following its sound (lightning-field.wav, 2.4 s: a creeping hum,
// eight big cracks, then it dies away):
// - spread, 0–CHARGE_MS: the field reaches out from the ship one cell every
//   RIPPLE_STEP_MS, each cell flashing as it's reached, leaving a faint
//   haze; a coil glow builds at the ship;
// - crackle: short forked arcs pop all over the field while it's live;
// - strikes, on the sound's cracks (STRIKES_MS): a forked bolt from the ship
//   to a ship in the field (`strikeCells`; every third, or when there are
//   none, the field's edge), flickering once, with a flash, a ring and arcs
//   crawling over the hull it hit;
// - it dies away from DECAY_AT_MS and is gone by QUIET_AT_MS.
// `once` (move playback) plays it once, within LIGHTNING_FIELD_MS; without
// it (the aiming preview) it repeats. Drawn on one canvas added onto the
// board (canvasFx). Reviewed in the Lightning Field rework artifact
// (2026-11-06).
//
// One burst of the field's crackle as it appears; a played-back move plays
// it once per move (soundOnceKey). It stops if the field goes away first
// (after SOUND_STOP_AFTER_MS, so React's quick dev-mode remount doesn't cut it).
const FIELD_SOUND = "/sound/lightning-field.wav";
const FIELD_PLAYED_KEY = "vt-lightning-field-played-v1";
const SOUND_STOP_AFTER_MS = 200;

type GridCell = { row: number; col: number };

interface LightningFieldAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  originRow: number;
  originCol: number;
  range: number;
  /** The other ships in the field: the strikes land on them. Omitted or empty, they land on the field's edge. */
  strikeCells?: GridCell[];
  /**
   * The move being played back: the sound plays once per key this session.
   * Omitted (aiming preview), it plays each time the field appears.
   */
  soundOnceKey?: string;
  /** Move playback: one storm, gone by LIGHTNING_FIELD_MS. Omitted (the aiming preview), it repeats. */
  once?: boolean;
}

/** The sound's eight cracks, ms in. */
const STRIKES_MS = [250, 550, 800, 950, 1200, 1450, 1600, 1850];
const CHARGE_MS = 250;
const DECAY_AT_MS = 1900;
const QUIET_AT_MS = 2250;
const RIPPLE_STEP_MS = 90;
const CRACKLE_EVERY_MS = 30;
const CRACKLE_LIFE_MS = 120;
const STRIKE_MS = 320;

const BLUE = "58,168,255";
const CYAN = "86,214,255";
const VIOLET = "155,77,255";
const WHITE = "235,245,255";
const YELLOW = "255,232,102";

type FieldCell = { d: number; x: number; y: number; w: number; h: number; cx: number; cy: number };
export type FieldLayout = {
  cells: FieldCell[];
  /** The ship's centre. */
  ox: number;
  oy: number;
  strikes: Array<{ x: number; y: number }>;
  edge: FieldCell[];
  cellW: number;
};
export type FieldRun = { start: number; seed: number; once: boolean };

export function cellsInRange(originRow: number, originCol: number, range: number): GridCell[] {
  const cells: GridCell[] = [];
  for (let r = originRow - range; r <= originRow + range; r++) {
    for (let c = originCol - range; c <= originCol + range; c++) {
      if (r < 0 || c < 0 || r >= GRID_DIMENSIONS.HEIGHT || c >= GRID_DIMENSIONS.WIDTH) continue;
      if (Math.abs(r - originRow) + Math.abs(c - originCol) <= range) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

/** The field's geometry from cell boxes (layout px). Exported for tests. */
export function fieldLayoutFrom(
  box: (row: number, col: number) => { x: number; y: number; width: number; height: number },
  originRow: number,
  originCol: number,
  range: number,
  strikeCells: GridCell[],
): FieldLayout {
  const cells = cellsInRange(originRow, originCol, range).map((c) => {
    const b = box(c.row, c.col);
    return { d: Math.abs(c.row - originRow) + Math.abs(c.col - originCol), x: b.x, y: b.y, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
  });
  const o = box(originRow, originCol);
  const maxD = cells.reduce((m, c) => Math.max(m, c.d), 0);
  return {
    cells,
    ox: o.x + o.width / 2,
    oy: o.y + o.height / 2,
    strikes: strikeCells.map((c) => {
      const b = box(c.row, c.col);
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }),
    edge: cells.filter((c) => c.d === maxD && c.d > 0),
    cellW: o.width,
  };
}

export function newFieldRun(start: number, once: boolean): FieldRun {
  return { start, seed: Math.random() * 1000, once };
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
type Pt = [number, number];

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], width: number, style: string) {
  if (pts.length < 2) return;
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

/** A jagged path from (x0, y0) to (x1, y1); `rough` is its sideways wander as a fraction of its length. */
function jag(x0: number, y0: number, x1: number, y1: number, segs: number, rough: number, s: number): Pt[] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const pts: Pt[] = [[x0, y0]];
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const w = (hash(s + i * 7.3) - 0.5) * 2 * rough * len * Math.sqrt(Math.sin(Math.PI * t));
    pts.push([x0 + dx * t + px * w, y0 + dy * t + py * w]);
  }
  pts.push([x1, y1]);
  return pts;
}

/** One electric arc: violet-blue glow, cyan body, white-hot core. */
function bolt(ctx: CanvasRenderingContext2D, pts: Pt[], fx: number, size: number, k: number) {
  poly(ctx, pts, fx * 0.05 * size, `rgba(${VIOLET},${0.16 * k})`);
  poly(ctx, pts, fx * 0.024 * size, `rgba(${BLUE},${0.45 * k})`);
  poly(ctx, pts, fx * 0.011 * size, `rgba(${CYAN},${0.9 * k})`);
  poly(ctx, pts, Math.max(0.6, fx * 0.0045 * size), `rgba(${WHITE},${k})`);
}

/** The field's strength (0–1) t ms in: it builds through the hum, holds, then dies away. */
function fieldStrength(t: number) {
  if (t < CHARGE_MS) return easeOut(t / CHARGE_MS) * 0.6;
  if (t < DECAY_AT_MS) return 0.6 + 0.4 * Math.min(1, (t - CHARGE_MS) / 300);
  return clamp01(1 - (t - DECAY_AT_MS) / (QUIET_AT_MS - DECAY_AT_MS));
}

/** Draws the field at `now`. Exported for tests. */
export function paintLightningField(ctx: CanvasRenderingContext2D, run: FieldRun, now: number, layout: FieldLayout, reduceMotion: boolean) {
  const elapsed = now - run.start;
  if (elapsed < 0 || (run.once && elapsed >= LIGHTNING_FIELD_MS)) return;
  const t = run.once ? elapsed : elapsed % LIGHTNING_FIELD_MS;
  const cycle = run.once ? 0 : Math.floor(elapsed / LIGHTNING_FIELD_MS);
  const sd = run.seed * 53 + cycle * 7;
  const { cells, ox, oy, strikes, edge, cellW } = layout;
  if (cells.length === 0) return;
  const fx = fxCellSize(cellW);
  const unit = cellW / 50;
  const fk = fieldStrength(t);
  const reach = (d: number) => d * RIPPLE_STEP_MS;

  // The field: it spreads out from the ship cell by cell, each cell flashing as it's reached, then a faint haze.
  for (const c of cells) {
    const e = t - reach(c.d);
    if (e < 0) continue;
    const haze = 0.07 * fk * (0.85 + 0.15 * Math.sin(t * 0.02 + c.cx * 0.034 + c.cy * 0.046));
    radialGlow(ctx, c.cx, c.cy, c.w * 0.62, [
      [0, `rgba(${BLUE},${haze})`],
      [0.7, `rgba(${VIOLET},${haze * 0.5})`],
      [1, `rgba(${VIOLET},0)`],
    ]);
    if (e < 220) {
      const k = (1 - e / 220) ** 2;
      radialGlow(ctx, c.cx, c.cy, c.w * 0.5, [
        [0, `rgba(${WHITE},${0.35 * k})`],
        [0.4, `rgba(${CYAN},${0.25 * k})`],
        [1, `rgba(${BLUE},0)`],
      ]);
    }
  }

  // The coil: a glow at the ship that swells with each strike.
  let surge = 0;
  for (const s of STRIKES_MS) if (t >= s && t - s < 160) surge = Math.max(surge, (1 - (t - s) / 160) ** 2);
  radialGlow(ctx, ox, oy, fx * (0.09 + 0.05 * surge), [
    [0, `rgba(${WHITE},${(0.5 + 0.5 * surge) * fk})`],
    [0.35, `rgba(${CYAN},${0.45 * fk})`],
    [1, `rgba(${VIOLET},0)`],
  ]);

  // Crackle: short forked arcs popping all over the field.
  for (let te = Math.max(0, Math.floor((t - CRACKLE_LIFE_MS) / CRACKLE_EVERY_MS) * CRACKLE_EVERY_MS); te <= t; te += CRACKLE_EVERY_MS) {
    const n = Math.round((reduceMotion ? 1 : 2.4) * fieldStrength(te)) + (hash(sd + te) < 0.4 ? 1 : 0);
    for (let j = 0; j < n; j++) {
      const id = sd * 3 + te * 5 + j * 131;
      const c = cells[Math.floor(hash(id) * cells.length)];
      if (te < reach(c.d)) continue;
      const life = 70 + hash(id + 1) * 50;
      const age = t - te;
      if (age < 0 || age >= life) continue;
      const flick = Math.floor(age / 35);
      const k = (age < 15 ? age / 15 : 1 - (age - 15) / (life - 15)) * (0.75 + 0.25 * hash(id + flick));
      const x = c.x + (0.15 + hash(id + 2) * 0.7) * c.w;
      const y = c.y + (0.15 + hash(id + 3) * 0.7) * c.h;
      const ang = hash(id + 4) * Math.PI * 2;
      const L = c.w * (0.25 + hash(id + 5) * 0.4);
      const pts = jag(x, y, x + Math.cos(ang) * L, y + Math.sin(ang) * L, 4, 0.35, id + flick * 17);
      bolt(ctx, pts, fx, 0.55, k);
      if (hash(id + 6) < 0.45) {
        const m = pts[2];
        const a2 = ang + (hash(id + 7) < 0.5 ? 0.9 : -0.9);
        bolt(ctx, jag(m[0], m[1], m[0] + Math.cos(a2) * L * 0.45, m[1] + Math.sin(a2) * L * 0.45, 3, 0.3, id + 9), fx, 0.4, k * 0.8);
      }
    }
  }

  // Strikes on the sound's cracks: a forked bolt from the ship to a ship in the field, or the field's edge.
  STRIKES_MS.forEach((s, i) => {
    const e = t - s;
    if (e < 0 || e >= STRIKE_MS) return;
    const sid = sd * 11 + i * 71;
    const useShip = strikes.length > 0 && i % 3 !== 2;
    let ex: number;
    let ey: number;
    if (useShip) {
      const p = strikes[(i + cycle) % strikes.length];
      ex = p.x;
      ey = p.y;
    } else {
      if (edge.length === 0) return;
      const c = edge[Math.floor(hash(sd + i * 19) * edge.length)];
      ex = c.cx + (hash(sid) - 0.5) * c.w * 0.5;
      ey = c.cy + (hash(sid + 1) - 0.5) * c.h * 0.5;
    }
    // The bolt: on for 50 ms, a flicker off, back for 65 ms; its shape re-rolls on the flicker.
    const on = e < 50 ? 1 : e < 75 ? 0.15 : e < 140 ? 0.8 * (1 - (e - 75) / 65) : 0;
    if (on > 0) {
      const roll = sid + (e < 75 ? 0 : 5);
      const segs = 6 + Math.floor(Math.hypot(ex - ox, ey - oy) / cellW) * 2;
      const main = jag(ox, oy, ex, ey, segs, 0.16, roll);
      bolt(ctx, main, fx, 1, on);
      const heading = Math.atan2(ey - oy, ex - ox);
      for (let f = 0; f < 2; f++) {
        const at = main[Math.floor(segs * (0.3 + 0.3 * f))];
        const a = heading + (f ? 0.7 : -0.7) * (0.7 + 0.6 * hash(roll + f));
        const L = cellW * (0.35 + 0.3 * hash(roll + f + 3));
        bolt(ctx, jag(at[0], at[1], at[0] + Math.cos(a) * L, at[1] + Math.sin(a) * L, 4, 0.3, roll + f * 13), fx, 0.6, on * 0.85);
      }
    }
    // The hit: a white flash, a ring, and arcs crawling over the hull.
    if (e < 120) {
      const k = (1 - e / 120) ** 2;
      radialGlow(ctx, ex, ey, cellW * 0.42, [
        [0, `rgba(255,255,255,${0.8 * k})`],
        [0.3, `rgba(${YELLOW},${0.35 * k})`],
        [0.6, `rgba(${CYAN},${0.3 * k})`],
        [1, `rgba(${VIOLET},0)`],
      ]);
    }
    if (e < 260) {
      const q = e / 260;
      strokeRing(ctx, ex, ey, cellW * (0.12 + 0.38 * easeOut(q)), (0.6 + 1.4 * (1 - q)) * unit, `rgba(${CYAN},${0.6 * (1 - q)})`);
    }
    if (e >= 40) {
      const k = 1 - (e - 40) / (STRIKE_MS - 40);
      const tick = Math.floor(e / 40);
      for (let a = 0; a < (reduceMotion ? 1 : 3); a++) {
        if (hash(sid + a * 7 + tick) < 0.3) continue;
        const st = hash(sid + a * 3 + tick * 5) * Math.PI * 2;
        const span = 0.7 + hash(sid + a + tick) * 0.6;
        const R = cellW * 0.36;
        const pts: Pt[] = [];
        for (let s2 = 0; s2 <= 5; s2++) {
          const an = st + (span * s2) / 5;
          const rr = R * (1 + (hash(sid + a * 5 + s2 + tick * 9) - 0.5) * 0.3);
          pts.push([ex + Math.cos(an) * rr, ey + Math.sin(an) * rr]);
        }
        bolt(ctx, pts, fx, 0.4, k);
      }
    }
  });
}

export const LightningFieldAnimation = React.memo(function LightningFieldAnimation({
  gridContainerRef,
  originRow,
  originCol,
  range,
  strikeCells,
  soundOnceKey,
  once = false,
}: LightningFieldAnimationProps) {
  const soundsMuted = useWeaponSoundsMuted();
  const soundOnceKeyRef = useRef(soundOnceKey);
  const soundsMutedRef = useRef(soundsMuted);
  soundOnceKeyRef.current = soundOnceKey;
  soundsMutedRef.current = soundsMuted;
  const onceRef = useRef(once);
  onceRef.current = once;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aimRef = useRef({ originRow, originCol, range, strikeCells: strikeCells ?? [] });
  aimRef.current = { originRow, originCol, range, strikeCells: strikeCells ?? [] };
  /** A new origin or range starts the storm again; the ships in it only re-aim the strikes. */
  const fieldKey = `${originRow}-${originCol}-${range}`;
  const fieldKeyRef = useRef(fieldKey);
  fieldKeyRef.current = fieldKey;
  const strikeKey = (strikeCells ?? []).map((c) => `${c.row},${c.col}`).join(";");
  const layoutKeyRef = useRef("");
  layoutKeyRef.current = `${fieldKey}|${strikeKey}`;

  useEffect(() => {
    const grid = gridContainerRef.current;
    const canvas = canvasRef.current;
    if (!grid || !canvas) return;
    const reduceMotion = prefersReducedMotion();
    const overlay = attachOverlayCanvas(grid, canvas);

    const key = soundOnceKeyRef.current;
    const audio =
      !soundsMutedRef.current && (key == null || takeFirstPlay(FIELD_PLAYED_KEY, key)) ? playSoundEffect(FIELD_SOUND) : null;
    const startedAt = Date.now();

    let layout: FieldLayout | null = null;
    let layoutKey = "";
    const ro = new ResizeObserver(() => {
      layout = null;
    });
    ro.observe(grid);
    let run: FieldRun | null = null;
    let runKey = "";

    const paint = (now: number) => {
      if (!layout || layoutKey !== layoutKeyRef.current) {
        const a = aimRef.current;
        layout = fieldLayoutFrom((r, c) => cellLayoutBox(grid, r, c), a.originRow, a.originCol, a.range, a.strikeCells);
        layoutKey = layoutKeyRef.current;
      }
      if (!run || runKey !== fieldKeyRef.current) {
        run = newFieldRun(now, onceRef.current);
        runKey = fieldKeyRef.current;
      }
      const ctx = overlay.begin();
      if (!ctx) return;
      paintLightningField(ctx, run, now, layout, reduceMotion);
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
