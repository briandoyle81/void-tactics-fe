"use client";

import React, { useEffect, useRef } from "react";
import {
  LASER_BEAM_COUNT,
  LASER_BEAM_LIFE_MS,
  LASER_FIRE_INTERVAL_MS,
  LASER_SCORCH_MS,
  LASER_TRACE_PERIOD_MS,
} from "../../constants/animationTiming";
import { cellLayoutBox } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import { playSoundEffect } from "../../hooks/useSoundEffects";
import {
  FX_CANVAS_STYLE,
  type RGB,
  attachOverlayCanvas,
  fxCellSize,
  gaussian,
  mixRgb,
  prefersReducedMotion,
  radialGlow,
} from "./canvasFx";
import { takeFirstPlay } from "./playOnce";
import { useWeaponSoundsMuted } from "./weaponSounds";

// Each of the red laser's beams in a volley snaps (laser-snap.wav), pitched
// a little differently each time; in the aiming preview the beams after the
// first SNAP_COUNT are silent, so it doesn't rattle for as long as it's on
// screen. A played-back move snaps once per move (soundOnceKey).
const SNAP_SOUND = "/sound/laser-snap.wav";
const SNAP_COUNT = LASER_BEAM_COUNT;
const SNAP_PITCH_VARIATION = 0.05;
const SNAP_PLAYED_KEY = "vt-laser-snap-played-v1";

// The Mining Laser's burn (mining-laser.wav, 2.8 s = LASER_TRACE_PERIOD_MS) as
// it starts; a played-back move plays it once per move. It stops if the beam
// goes away first (after SOUND_STOP_AFTER_MS, so React's quick dev-mode
// remount doesn't cut it).
const MINING_SOUND = "/sound/mining-laser.wav";
const MINING_PITCH_VARIATION = 0.05;
const MINING_PLAYED_KEY = "vt-mining-laser-played-v1";
const SOUND_STOP_AFTER_MS = 200;

/** The Mining Laser's wander: within this far of the target cell's centre, as fractions of the cell. */
const TRACE_X_BAND = 0.42;
const TRACE_Y_BAND = 0.2;

interface LaserShootingAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  attackerRow: number;
  attackerCol: number;
  targetRow: number;
  targetCol: number;
  facingRight: boolean;
  /** Variant 2 is the Mining Laser: one green wander beam. Variant 1 is the red pulse volley. */
  variant?: number;
  /**
   * The last move being replayed: the laser's sound (the red laser's snaps,
   * the Mining Laser's burn) plays once per key this session. Omitted
   * (aiming preview), it plays each time the beam starts.
   */
  soundOnceKey?: string;
  /**
   * Move playback: fire once and finish: the red laser's LASER_BEAM_COUNT
   * beams, or one Mining Laser burn that shuts off and cools within
   * LASER_TRACE_PERIOD_MS. Omitted (the aiming preview), it keeps firing
   * until it unmounts.
   */
  once?: boolean;
}

// Muzzle points, as offsets from the attacker cell's centre. The sprite
// fills the cell and a right-facing ship is the same art mirrored
// horizontally (scale-x(-1)), so only x flips with facing; the height is
// the same both ways. (A facing-dependent y term here used to make every
// fix for one side break the other: the hero shows right-facing ships, the
// AI in single-player faces left.)
function faction1LaserOrigin(
  grid: HTMLElement,
  row: number,
  col: number,
  facingRight: boolean,
) {
  const box = cellLayoutBox(grid, row, col);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dir = facingRight ? 1 : -1;
  return {
    x: cx + dir * box.width * 0.06,
    y: cy - box.height * 0.16,
  };
}

/** The Mining Laser's emitter: 33% of a cell forward of the ship's centre, 19% up. */
function miningLaserOrigin(
  grid: HTMLElement,
  row: number,
  col: number,
  facingRight: boolean,
) {
  const box = cellLayoutBox(grid, row, col);
  const dir = facingRight ? 1 : -1;
  return {
    x: box.x + box.width / 2 + dir * box.width * 0.33,
    y: box.y + box.height / 2 - box.height * 0.19,
  };
}

// The red laser: needle-thin beams that hit instantly, one every
// LASER_FIRE_INTERVAL_MS. Each beam starts slightly thick and snaps thin,
// retracts into the hull as it fades, and leaves a pinpoint scorch that
// cools. Drawn on one canvas with additive blending. `once` (move playback)
// fires LASER_BEAM_COUNT beams, one snap each, and is over by
// LASER_BEAM_COUNT - 1 beams' interval + LASER_SCORCH_MS (1,300 ms, inside
// weaponOnceMs' slot). Without it (the aiming preview) it fires until it
// unmounts. Reviewed in the red laser rework artifact (2026-11-06).

/** Hit points around the hull centre, as fractions of the target cell: wide across, tight up and down. */
const AIM_SPREAD_X = 0.14;
const AIM_CLAMP_X = 0.32;
const AIM_SPREAD_Y = 0.045;
const SPARKS_PER_HIT = 4;

/** A spark's direction is an offset from straight back toward the shooter. */
type NeedleSpark = { off: number; v: number; life: number; w: number };
type NeedleBeam = { t: number; ux: number; uy: number; sparks: NeedleSpark[] };

/** A beam tapering from width w0 at (x0, y0) to w1 at (x1, y1). */
function taperedBeam(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  fill: string,
) {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x0 + (nx * w0) / 2, y0 + (ny * w0) / 2);
  ctx.lineTo(x1 + (nx * w1) / 2, y1 + (ny * w1) / 2);
  ctx.lineTo(x1 - (nx * w1) / 2, y1 - (ny * w1) / 2);
  ctx.lineTo(x0 - (nx * w0) / 2, y0 - (ny * w0) / 2);
  ctx.closePath();
  ctx.fill();
}

const SCORCH_HOT: RGB = [255, 190, 130];
const SCORCH_COLD: RGB = [120, 18, 8];
const SPARK_HOT: RGB = [255, 236, 200];
const SPARK_COLD: RGB = [255, 60, 30];

function paintNeedleBeam(
  ctx: CanvasRenderingContext2D,
  beam: NeedleBeam,
  age: number,
  origin: { x: number; y: number },
  box: { x: number; y: number; width: number; height: number },
) {
  const fx = fxCellSize(box.width);
  const hx = box.x + box.width / 2 + beam.ux * box.width;
  const hy = box.y + box.height / 2 + beam.uy * box.height;

  // The pinpoint scorch builds up on the hull through the volley, then cools.
  if (age < LASER_SCORCH_MS) {
    const p = age / LASER_SCORCH_MS;
    const c = mixRgb(SCORCH_HOT, SCORCH_COLD, p);
    radialGlow(ctx, hx, hy, fx * 0.035, [[0, `rgba(${c},${0.9 * (1 - p)})`], [1, `rgba(${c},0)`]]);
  }
  if (age >= LASER_BEAM_LIFE_MS + 10) return;

  // The needle: lands in one frame, snaps thin, retracts into the hull as it fades.
  const p = Math.min(1, age / LASER_BEAM_LIFE_MS);
  const alpha = Math.max(0, Math.exp(-age / 50) - 0.06 * p);
  const snap = 1 + 0.9 * Math.exp(-age / 16);
  const tail = p * p * 0.9;
  const x0 = origin.x + (hx - origin.x) * tail;
  const y0 = origin.y + (hy - origin.y) * tail;
  taperedBeam(ctx, x0, y0, hx, hy, fx * 0.075 * snap, fx * 0.03 * snap, `rgba(255,40,30,${0.22 * alpha})`);
  taperedBeam(ctx, x0, y0, hx, hy, fx * 0.026 * snap, fx * 0.009 * snap, `rgba(255,59,48,${0.95 * alpha})`);
  taperedBeam(ctx, x0, y0, hx, hy, fx * 0.009 * snap, fx * 0.003 * snap, `rgba(255,246,242,${alpha})`);

  // Pinpoint muzzle flash and a thin glint.
  if (age < 50) {
    const k = 1 - age / 50;
    radialGlow(ctx, origin.x, origin.y, fx * 0.05, [
      [0, `rgba(255,245,240,${k})`],
      [0.4, `rgba(255,70,50,${0.6 * k})`],
      [1, "rgba(255,40,30,0)"],
    ]);
    ctx.strokeStyle = `rgba(255,210,200,${0.7 * k})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(origin.x - fx * 0.08 * k, origin.y);
    ctx.lineTo(origin.x + fx * 0.08 * k, origin.y);
    ctx.stroke();
  }

  // Where it lands: a pin flash, a faint glow across the hull, a few sparks.
  if (age < 70) {
    const k = (1 - age / 70) ** 2;
    radialGlow(ctx, hx, hy, fx * 0.07, [
      [0, `rgba(255,252,248,${k})`],
      [0.35, `rgba(255,120,80,${0.7 * k})`],
      [1, "rgba(255,30,20,0)"],
    ]);
  }
  if (age < 120) {
    const k = 0.18 * Math.exp(-age / 40);
    radialGlow(ctx, hx, hy, box.width * 0.32, [[0, `rgba(255,74,58,${k})`], [1, "rgba(255,74,58,0)"]]);
  }
  const back = Math.atan2(origin.y - hy, origin.x - hx);
  for (const sp of beam.sparks) {
    if (age > sp.life) continue;
    const ang = back + sp.off;
    const q = age / sp.life;
    const drag = 0.008;
    const d = (sp.v * fx * (1 - Math.exp(-drag * age))) / drag;
    const d0 = (sp.v * fx * (1 - Math.exp(-drag * Math.max(0, age - 16)))) / drag;
    ctx.strokeStyle = `rgba(${mixRgb(SPARK_HOT, SPARK_COLD, q)},${1 - q})`;
    ctx.lineWidth = sp.w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(ang) * d0, hy + Math.sin(ang) * d0);
    ctx.lineTo(hx + Math.cos(ang) * d, hy + Math.sin(ang) * d);
    ctx.stroke();
  }
}

const Faction1LaserAnimation = React.memo(function Faction1LaserAnimation({
  gridContainerRef,
  attackerRow,
  attackerCol,
  targetRow,
  targetCol,
  facingRight,
  soundOnceKey,
  once = false,
}: Omit<LaserShootingAnimationProps, "variant">) {
  const soundsMuted = useWeaponSoundsMuted();
  const soundOnceKeyRef = useRef(soundOnceKey);
  const soundsMutedRef = useRef(soundsMuted);
  const onceRef = useRef(once);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aimRef = useRef({ attackerRow, attackerCol, targetRow, targetCol, facingRight });
  aimRef.current = { attackerRow, attackerCol, targetRow, targetCol, facingRight };

  useEffect(() => {
    const grid = gridContainerRef.current;
    const canvas = canvasRef.current;
    if (!grid || !canvas) return;
    const reduceMotion = prefersReducedMotion();
    const overlay = attachOverlayCanvas(grid, canvas);

    const key = soundOnceKeyRef.current;
    let snapsLeft =
      !soundsMutedRef.current && (key == null || takeFirstPlay(SNAP_PLAYED_KEY, key)) ? SNAP_COUNT : 0;
    const maxBeams = onceRef.current ? LASER_BEAM_COUNT : Infinity;
    const beams: NeedleBeam[] = [];
    let fired = 0;
    let start = -1;

    const fire = (t: number) => {
      const sparkCount = reduceMotion ? SPARKS_PER_HIT / 2 : SPARKS_PER_HIT;
      beams.push({
        t,
        ux: -0.02 + Math.max(-AIM_CLAMP_X, Math.min(AIM_CLAMP_X, gaussian() * AIM_SPREAD_X)),
        uy: gaussian() * AIM_SPREAD_Y,
        sparks: Array.from({ length: sparkCount }, () => ({
          off: gaussian() * 1.1,
          v: 0.0012 + Math.random() * 0.0022,
          life: 90 + Math.random() * 90,
          w: 0.5 + Math.random() * 0.6,
        })),
      });
      fired += 1;
      if (snapsLeft > 0) {
        snapsLeft -= 1;
        playSoundEffect(SNAP_SOUND, { pitchVariation: SNAP_PITCH_VARIATION });
      }
    };

    const paint = (now: number) => {
      if (start < 0) start = now;
      const elapsed = now - start;
      while (fired < maxBeams && fired * LASER_FIRE_INTERVAL_MS <= elapsed) fire(start + fired * LASER_FIRE_INTERVAL_MS);
      while (beams.length && now - beams[0].t > LASER_SCORCH_MS) beams.shift();

      const ctx = overlay.begin();
      if (!ctx || !beams.length) return;
      const { attackerRow: ar, attackerCol: ac, targetRow: tr, targetCol: tc, facingRight: face } = aimRef.current;
      const origin = faction1LaserOrigin(grid, ar, ac, face);
      const box = cellLayoutBox(grid, tr, tc);
      for (const beam of beams) paintNeedleBeam(ctx, beam, now - beam.t, origin, box);
    };

    const stopRaf = startCancelledRaf(paint);
    return () => {
      stopRaf();
      overlay.dispose();
    };
  }, [gridContainerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute pointer-events-none z-20"
      style={FX_CANVAS_STYLE}
      aria-hidden="true"
    />
  );
});

type TracePoint = { x: number; y: number };

function randIn(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clampTrace(p: TracePoint): TracePoint {
  return {
    x: Math.max(-TRACE_X_BAND, Math.min(TRACE_X_BAND, p.x)),
    y: Math.max(-TRACE_Y_BAND, Math.min(TRACE_Y_BAND, p.y)),
  };
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/** One wander across the target: four control points, at least 0.55 cell end to end. */
function makeTracePath(from?: TracePoint): TracePoint[] {
  const start = from
    ? clampTrace(from)
    : {
        x: randIn(-TRACE_X_BAND, TRACE_X_BAND),
        y: randIn(-TRACE_Y_BAND, TRACE_Y_BAND),
      };
  let end = {
    x: randIn(-TRACE_X_BAND, TRACE_X_BAND),
    y: randIn(-TRACE_Y_BAND, TRACE_Y_BAND),
  };
  if (Math.hypot(end.x - start.x, end.y - start.y) < 0.55) {
    end = clampTrace({
      x: start.x >= 0 ? -TRACE_X_BAND * randIn(0.75, 1) : TRACE_X_BAND * randIn(0.75, 1),
      y: randIn(-TRACE_Y_BAND, TRACE_Y_BAND),
    });
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts = [start];
  for (let i = 1; i <= 2; i++) {
    const u = i / 3;
    const side = i % 2 === 0 ? 1 : -1;
    pts.push(
      clampTrace({
        x: start.x + dx * u + nx * randIn(0.14, 0.24) * side,
        y: start.y + dy * u + ny * randIn(0.1, 0.18) * side,
      }),
    );
  }
  pts.push(end);
  return pts;
}

function sampleTracePath(pts: TracePoint[], t: number): TracePoint {
  const n = pts.length;
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < n - 1; i++) {
    const len = Math.max(
      Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y),
      0.04,
    );
    lens.push(len);
    total += len;
  }
  let dist = Math.max(0, Math.min(1, t)) * total;
  let i = 0;
  while (i < n - 2 && dist > lens[i]) {
    dist -= lens[i];
    i += 1;
  }
  const f = dist / lens[i];
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n - 1, i + 2)];
  return clampTrace({
    x: catmull(p0.x, p1.x, p2.x, p3.x, f),
    y: catmull(p0.y, p1.y, p2.y, p3.y, f),
  });
}

// The Mining Laser: one green beam whose contact point wanders across the
// target (one smooth path every LASER_TRACE_PERIOD_MS), carving a scar of
// white-hot metal that cools through yellow, orange and cherry to dull red,
// dimming, over MINING_SCAR_MS; only its hottest part glows around itself.
// At the contact point, a white-hot spot throws molten sparks back off the
// cut. The beam ignites in MINING_IGNITE_MS; `once` (move playback) shuts it
// off from MINING_OFF_AT_MS and lets the scar finish cooling before
// LASER_TRACE_PERIOD_MS. Without it (the aiming preview) it keeps burning.
// Drawn on one canvas added onto the board (canvasFx). Reviewed in the
// Mining Laser rework artifact (2026-11-06).
const MINING_IGNITE_MS = 100;
const MINING_OFF_AT_MS = 2600;
const MINING_OFF_MS = 50;
const MINING_SCAR_MS = 4800;
const MINING_SCAR_STEP_MS = 20;
const MINING_SPARK_EVERY_MS = 20;

/** Hot metal, from white-hot (heat 1) to cold (heat 0). */
const SCAR_COLORS: Array<[number, RGB]> = [
  [1, [255, 250, 235]],
  [0.8, [255, 215, 120]],
  [0.6, [255, 130, 40]],
  [0.4, [190, 40, 15]],
  [0.2, [90, 15, 8]],
  [0, [40, 6, 4]],
];
const MINING_SPARK: [RGB, RGB] = [[255, 248, 200], [255, 110, 30]];

function scarColor(h: number) {
  for (let i = 0; i < SCAR_COLORS.length - 1; i++) {
    const [h0, c0] = SCAR_COLORS[i];
    const [h1, c1] = SCAR_COLORS[i + 1];
    if (h >= h1) return mixRgb(c1, c0, (h - h1) / (h0 - h1));
  }
  return SCAR_COLORS[SCAR_COLORS.length - 1][1].join(",");
}

function laserHash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export type MiningLaserLayout = { ox: number; oy: number; cx: number; cy: number; cellW: number; cellH: number };

/** One burn: its start, and the wander paths it has traced so far (one per LASER_TRACE_PERIOD_MS). */
export type MiningLaserRun = { start: number; seed: number; once: boolean; paths: TracePoint[][] };

export function newMiningLaserRun(start: number, once: boolean): MiningLaserRun {
  return { start, seed: Math.random() * 1000, once, paths: [] };
}

/** The contact point T ms into the run, as fractions of the target cell from its centre. */
function contactLocal(run: MiningLaserRun, T: number): TracePoint {
  const k = Math.max(0, Math.floor(T / LASER_TRACE_PERIOD_MS));
  while (run.paths.length <= k) {
    const prev = run.paths[run.paths.length - 1];
    run.paths.push(makeTracePath(prev ? sampleTracePath(prev, 1) : undefined));
  }
  return sampleTracePath(run.paths[k], (T - k * LASER_TRACE_PERIOD_MS) / LASER_TRACE_PERIOD_MS);
}

type Wide = { x: number; y: number; w: number };

/** A filled ribbon through pts: one shape, so its added light has no seams; rounded at both ends. */
function beamRibbon(ctx: CanvasRenderingContext2D, pts: Wide[], scale: number, fill: string) {
  const n = pts.length;
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const hw = (pts[i].w * scale) / 2;
    left.push([pts[i].x - ty * hw, pts[i].y + tx * hw]);
    right.push([pts[i].x + ty * hw, pts[i].y - tx * hw]);
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
  const e = pts[n - 1];
  const ea = Math.atan2(left[n - 1][1] - e.y, left[n - 1][0] - e.x);
  ctx.arc(e.x, e.y, (e.w * scale) / 2, ea, ea - Math.PI, true);
  for (let i = n - 2; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  const s = pts[0];
  const sa = Math.atan2(right[0][1] - s.y, right[0][0] - s.x);
  ctx.arc(s.x, s.y, (s.w * scale) / 2, sa, sa - Math.PI, true);
  ctx.closePath();
  ctx.fill();
}

function stroke(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, style: string, cap: CanvasLineCap) {
  ctx.strokeStyle = style;
  ctx.lineWidth = w;
  ctx.lineCap = cap;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** Draws the Mining Laser at `now`. Exported for tests. */
export function paintMiningLaser(ctx: CanvasRenderingContext2D, run: MiningLaserRun, now: number, layout: MiningLaserLayout, reduceMotion: boolean) {
  const T = now - run.start;
  if (T < 0 || (run.once && T >= LASER_TRACE_PERIOD_MS)) return;
  const fx = fxCellSize(layout.cellW);
  const { ox, oy } = layout;
  const at = (t: number) => {
    const l = contactLocal(run, t);
    return { x: layout.cx + l.x * layout.cellW, y: layout.cy + l.y * layout.cellH };
  };
  const off = run.once ? MINING_OFF_AT_MS : Infinity;
  const on = T < MINING_IGNITE_MS ? 1 - Math.pow(1 - T / MINING_IGNITE_MS, 3) : T < off ? 1 : Math.max(0, 1 - (T - off) / MINING_OFF_MS);
  const cool = run.once
    ? Math.min(1, Math.max(0, 1 - (T - (MINING_OFF_AT_MS + MINING_OFF_MS)) / (LASER_TRACE_PERIOD_MS - MINING_OFF_AT_MS - MINING_OFF_MS)))
    : 1;

  // The scar: hot metal, cooling and dimming along the path behind the beam.
  const lastBurn = Math.min(T, off + MINING_OFF_MS);
  const scar: Array<TracePoint & { h: number }> = [];
  for (let age = Math.max(0, T - lastBurn); age <= MINING_SCAR_MS; age += MINING_SCAR_STEP_MS) {
    const t = T - age;
    if (t < MINING_IGNITE_MS * 0.5) break;
    scar.push({ ...at(t), h: 1 - age / MINING_SCAR_MS });
  }
  const scarWidth = (h: number) => fx * 0.03 * (0.55 + 0.45 * h);
  const scarAlpha = (h: number) => 0.95 * Math.pow(h, 1.2) * cool;
  const glowAlpha = (h: number) => (h > 0.6 ? 0.25 * Math.pow((h - 0.6) / 0.4, 2) * cool : 0);
  for (let i = 0; i + 1 < scar.length; i++) {
    const a = scar[i];
    const b = scar[i + 1];
    const h = (a.h + b.h) / 2;
    const col = scarColor(h);
    // Square-ended, so the joints don't overlap into bright beads; only the hottest metal glows around itself.
    if (glowAlpha(h) > 0) stroke(ctx, a.x, a.y, b.x, b.y, fx * 0.03 * 2.4, `rgba(${col},${glowAlpha(h)})`, "butt");
    stroke(ctx, a.x, a.y, b.x, b.y, scarWidth(h), `rgba(${col},${scarAlpha(h)})`, "butt");
  }
  // Round both ends: a half-disc facing outward, matching the segment it caps.
  if (scar.length >= 2) {
    for (const [end, next] of [[scar[0], scar[1]], [scar[scar.length - 1], scar[scar.length - 2]]] as const) {
      const h = (end.h + next.h) / 2;
      const col = scarColor(h);
      const out = Math.atan2(end.y - next.y, end.x - next.x);
      const cap = (w: number, alpha: number) => {
        if (alpha <= 0) return;
        ctx.fillStyle = `rgba(${col},${alpha})`;
        ctx.beginPath();
        ctx.arc(end.x, end.y, w / 2, out - Math.PI / 2, out + Math.PI / 2);
        ctx.closePath();
        ctx.fill();
      };
      cap(fx * 0.03 * 2.4, glowAlpha(h));
      cap(scarWidth(h), scarAlpha(h));
    }
  }
  if (on <= 0) return;

  // The beam: four layers, one ribbon each, with a shimmer running along it.
  const e = at(T);
  const pts: Wide[] = [];
  for (let i = 0; i <= 18; i++) {
    const f = i / 18;
    pts.push({ x: ox + (e.x - ox) * f, y: oy + (e.y - oy) * f, w: (1 + 0.12 * Math.sin(f * 14 - T * 0.05)) * (0.55 + 0.45 * on) });
  }
  beamRibbon(ctx, pts, fx * 0.059, `rgba(107,255,143,${0.12 * on})`);
  beamRibbon(ctx, pts, fx * 0.033, `rgba(107,255,143,${0.3 * on})`);
  beamRibbon(ctx, pts, fx * 0.018, `rgba(120,255,155,${0.85 * on})`);
  beamRibbon(ctx, pts, fx * 0.0073, `rgba(236,255,242,${on})`);
  radialGlow(ctx, ox, oy, fx * 0.055, [
    [0, `rgba(236,255,242,${0.85 * on})`],
    [0.4, `rgba(107,255,143,${0.45 * on})`],
    [1, "rgba(107,255,143,0)"],
  ]);
  if (T < 120) {
    const k = (1 - T / 120) ** 2;
    radialGlow(ctx, ox, oy, fx * 0.12, [[0, `rgba(255,255,255,${k})`], [1, "rgba(107,255,143,0)"]]);
    radialGlow(ctx, e.x, e.y, fx * 0.12, [[0, `rgba(255,255,255,${k})`], [1, "rgba(107,255,143,0)"]]);
  }

  // The contact: a white-hot spot, molten sparks thrown back off the cut.
  radialGlow(ctx, e.x, e.y, fx * 0.06 * (0.9 + 0.1 * Math.sin(T * 0.13)), [
    [0, `rgba(255,255,240,${on})`],
    [0.3, `rgba(255,240,150,${0.7 * on})`],
    [0.6, `rgba(160,255,170,${0.3 * on})`],
    [1, "rgba(107,255,143,0)"],
  ]);
  const lastEmit = Math.min(T, off);
  for (let te = Math.max(MINING_IGNITE_MS, Math.floor((T - 280) / MINING_SPARK_EVERY_MS) * MINING_SPARK_EVERY_MS); te <= lastEmit; te += MINING_SPARK_EVERY_MS) {
    const p0 = at(te);
    const p1 = at(te + 30);
    const travel = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    for (let j = 0; j < (reduceMotion ? 2 : 4); j++) {
      const id = te * 4 + j;
      const life = Math.min(120 + laserHash(run.seed * 13 + id) * 140, run.once ? LASER_TRACE_PERIOD_MS - te : Infinity);
      const age = T - te;
      if (age < 0 || age >= life) continue;
      const ang = travel + Math.PI + (laserHash(run.seed * 29 + id) - 0.5) * 1.8;
      const v = fx * (0.002 + laserHash(run.seed * 41 + id) * 0.003);
      const q = age / life;
      const d = v * age * (1 - 0.45 * q);
      const d0 = Math.max(0, d - fx * 0.025);
      stroke(ctx, p0.x + Math.cos(ang) * d0, p0.y + Math.sin(ang) * d0, p0.x + Math.cos(ang) * d, p0.y + Math.sin(ang) * d, 0.85, `rgba(${mixRgb(MINING_SPARK[0], MINING_SPARK[1], q)},${1 - q})`, "round");
    }
  }
}

export function miningLaserLayout(grid: HTMLElement, ar: number, ac: number, tr: number, tc: number, facingRight: boolean): MiningLaserLayout {
  const origin = miningLaserOrigin(grid, ar, ac, facingRight);
  const t = cellLayoutBox(grid, tr, tc);
  return { ox: origin.x, oy: origin.y, cx: t.x + t.width / 2, cy: t.y + t.height / 2, cellW: t.width, cellH: t.height };
}

const MiningLaserAnimation = React.memo(function MiningLaserAnimation({
  gridContainerRef,
  attackerRow,
  attackerCol,
  targetRow,
  targetCol,
  facingRight,
  soundOnceKey,
  once = false,
}: Omit<LaserShootingAnimationProps, "variant">) {
  const soundsMuted = useWeaponSoundsMuted();
  const soundOnceKeyRef = useRef(soundOnceKey);
  const soundsMutedRef = useRef(soundsMuted);
  const onceRef = useRef(once);
  onceRef.current = once;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aimRef = useRef({ attackerRow, attackerCol, targetRow, targetCol, facingRight });
  aimRef.current = { attackerRow, attackerCol, targetRow, targetCol, facingRight };
  /** A new attack starts the burn again. */
  const attackKey = `${attackerRow}-${attackerCol}-${targetRow}-${targetCol}-${facingRight ? 1 : 0}`;
  const attackKeyRef = useRef(attackKey);
  attackKeyRef.current = attackKey;

  useEffect(() => {
    const key = soundOnceKeyRef.current;
    if (soundsMutedRef.current || (key != null && !takeFirstPlay(MINING_PLAYED_KEY, key))) return;
    const audio = playSoundEffect(MINING_SOUND, { pitchVariation: MINING_PITCH_VARIATION });
    const startedAt = Date.now();
    return () => {
      if (audio && Date.now() - startedAt > SOUND_STOP_AFTER_MS) audio.pause();
    };
  }, []);

  useEffect(() => {
    const grid = gridContainerRef.current;
    const canvas = canvasRef.current;
    if (!grid || !canvas) return;
    const reduceMotion = prefersReducedMotion();
    const overlay = attachOverlayCanvas(grid, canvas);
    let layout: MiningLaserLayout | null = null;
    let layoutKey = "";
    const ro = new ResizeObserver(() => {
      layout = null;
    });
    ro.observe(grid);
    let run: MiningLaserRun | null = null;
    let runKey = "";

    const paint = (now: number) => {
      if (!layout || layoutKey !== attackKeyRef.current) {
        const a = aimRef.current;
        layout = miningLaserLayout(grid, a.attackerRow, a.attackerCol, a.targetRow, a.targetCol, a.facingRight);
        layoutKey = attackKeyRef.current;
      }
      if (!run || runKey !== attackKeyRef.current) {
        run = newMiningLaserRun(now, onceRef.current);
        runKey = attackKeyRef.current;
      }
      // Keep only the paths the scar can still reach.
      const keep = Math.ceil(MINING_SCAR_MS / LASER_TRACE_PERIOD_MS) + 2;
      if (run.paths.length > keep + 8) {
        const drop = run.paths.length - keep;
        const shift = drop * LASER_TRACE_PERIOD_MS;
        run.paths.splice(0, drop);
        run.start += shift;
      }
      const ctx = overlay.begin();
      if (!ctx) return;
      paintMiningLaser(ctx, run, now, layout, reduceMotion);
    };

    const stopRaf = startCancelledRaf(paint);
    return () => {
      stopRaf();
      ro.disconnect();
      overlay.dispose();
    };
  }, [gridContainerRef]);

  return <canvas ref={canvasRef} className="absolute pointer-events-none z-20" style={FX_CANVAS_STYLE} aria-hidden="true" />;
});

export const LaserShootingAnimation = React.memo(function LaserShootingAnimation({
  variant = 1,
  ...props
}: LaserShootingAnimationProps) {
  if (Number(variant) === 2) {
    return <MiningLaserAnimation {...props} />;
  }
  return <Faction1LaserAnimation {...props} />;
});
