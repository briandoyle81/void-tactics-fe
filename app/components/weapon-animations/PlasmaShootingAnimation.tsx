"use client";

import React, { useEffect, useRef } from "react";
import { PLASMA_BURST_MS, PLASMA_FIRE_MS } from "../../constants/animationTiming";
import { cellCenterOnGrid, gridLayoutSize } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import {
  FX_CANVAS_STYLE,
  type RGB,
  attachOverlayCanvas,
  fxCellSize,
  mixRgb,
  prefersReducedMotion,
  radialGlow,
  strokeRing,
  strokeSegment,
} from "./canvasFx";
import { playSoundEffect } from "../../hooks/useSoundEffects";
import { takeFirstPlay } from "./playOnce";
import { useWeaponSoundsMuted } from "./weaponSounds";

// The plasma stream: one continuous jet of blue-violet plasma from the
// nozzle into the target's hull. Points of plasma are laid every EMIT_MS and
// take 300–420 ms to land; each layer of the jet (a soft glow, a blue body, a
// white-hot core) is one tapered ribbon through them, widening and cooling to
// violet along its length, with pulses flowing down it, while the aim sweeps
// slowly across the hull. Where it lands: a white-hot spot, droplets flung
// back, a heat glow that builds on the hull, and a flare every FLARE_EVERY_MS.
// `once` (move playback): it builds out of the nozzle, stops firing at
// PLASMA_FIRE_MS, and its tail runs into the target and cools before
// PLASMA_BURST_MS. Without it (the aiming preview) it streams until it
// unmounts. Drawn on one canvas added onto the board (canvasFx). Reviewed in
// the plasma rework artifact (2026-11-06).
//
// One flamethrower burst (plasma-flame.wav, 2.7 s) as the stream starts; a
// played-back move plays it once per move (soundOnceKey). It stops if the
// stream goes away first (after FLAME_STOP_AFTER_MS, so React's quick
// dev-mode remount doesn't cut it).
const FLAME_SOUND = "/sound/plasma-flame.wav";
const FLAME_PLAYED_KEY = "vt-plasma-flame-played-v1";
const FLAME_STOP_AFTER_MS = 200;

interface PlasmaShootingAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  attackerRow: number;
  attackerCol: number;
  targetRow: number;
  targetCol: number;
  facingRight: boolean;
  /**
   * The move being played back: the flame sound plays once per key this
   * session. Omitted (aiming preview), it plays each time the stream starts.
   */
  soundOnceKey?: string;
  /** Move playback: one burst that ends within PLASMA_BURST_MS. Omitted (the aiming preview), it streams until it unmounts. */
  once?: boolean;
}

/** The nozzle: this far forward of the ship's centre and up, as fractions of the cell. */
const NOZZLE_FORWARD = 0.09;
const NOZZLE_UP = 0.16;
const EMIT_MS = 12;
const BUILD_MS = 120;
/** Plasma tails off over this long before the stream stops firing. */
const TAIL_OFF_MS = 150;
/** Splash effects (droplets, hull heat) last at most this long after plasma lands. */
const SPLASH_MS = 280;
const FLARE_EVERY_MS = 250;
const FIRST_LANDING_MS = 280;
const MAX_TRAVEL_MS = 420;

const PLASMA_COLORS: RGB[] = [[235, 252, 255], [86, 214, 255], [90, 130, 255], [150, 110, 255]];
const DROPLET: [RGB, RGB] = [[220, 245, 255], [150, 110, 255]];

export type PlasmaLayout = { ox: number; oy: number; cx: number; cy: number; cellW: number; cellH: number };
export type PlasmaStream = { start: number; seed: number; end: number };

type Bead = { i: number; t: number; ax: number; ay: number; travel: number; ph: number };
type RibbonPoint = { x: number; y: number; w: number; u: number };

export function plasmaLayout(grid: HTMLElement, ar: number, ac: number, tr: number, tc: number, facingRight: boolean): PlasmaLayout {
  const { cellWidth, cellHeight } = gridLayoutSize(grid);
  const center = cellCenterOnGrid(grid, ar, ac);
  const target = cellCenterOnGrid(grid, tr, tc);
  return {
    ox: center.x + (facingRight ? 1 : -1) * cellWidth * NOZZLE_FORWARD,
    oy: center.y - cellHeight * NOZZLE_UP,
    cx: target.x,
    cy: target.y,
    cellW: cellWidth,
    cellH: cellHeight,
  };
}

/** A stream starting at `start`; `once` makes it stop firing at PLASMA_FIRE_MS. */
export function newPlasmaStream(start: number, once: boolean): PlasmaStream {
  return { start, seed: Math.random() * 1000, end: once ? PLASMA_FIRE_MS : Infinity };
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function plasmaColor(u: number) {
  if (u < 0.25) return mixRgb(PLASMA_COLORS[0], PLASMA_COLORS[1], u / 0.25);
  if (u < 0.6) return mixRgb(PLASMA_COLORS[1], PLASMA_COLORS[2], (u - 0.25) / 0.35);
  return mixRgb(PLASMA_COLORS[2], PLASMA_COLORS[3], (u - 0.6) / 0.4);
}

/** Where the stream aims at time t (ms since it started): sweeping across the hull. */
function aimAt(layout: PlasmaLayout, seed: number, t: number) {
  return {
    x: layout.cx - layout.cellW * 0.02 + layout.cellW * 0.18 * Math.sin((2 * Math.PI * t) / 900 + seed),
    y: layout.cy + layout.cellH * 0.04 * Math.sin((2 * Math.PI * t) / 1300 + 1 + seed),
  };
}

function bead(layout: PlasmaLayout, s: PlasmaStream, i: number): Bead {
  const r = (k: number) => hash(s.seed * 7919 + i * 13 + k);
  const g = (k: number) => (r(k) + r(k + 50) + r(k + 100) - 1.5) * 1.15; // roughly normal
  const t = i * EMIT_MS;
  const a = aimAt(layout, s.seed, t);
  return {
    i,
    t,
    ax: a.x + g(1) * layout.cellW * 0.02,
    ay: a.y + g(2) * layout.cellH * 0.02,
    // Varies smoothly from one point to the next, so the stream doesn't fold back on itself.
    travel: 300 + 100 * (0.5 + 0.5 * Math.sin(i * 0.07 + s.seed)) + r(3) * 20,
    ph: r(4) * Math.PI * 2,
  };
}

/** How strongly plasma laid at t burns: it builds at the start and tails off before the stream stops. */
function emitStrength(t: number, end: number) {
  const build = Math.min(1, Math.max(0, t / BUILD_MS));
  return end === Infinity ? build : build * Math.min(1, Math.max(0, (end - t) / TAIL_OFF_MS));
}

/** A filled ribbon through pts: one shape, so its added light has no seams; rounded at both ends. */
function ribbon(ctx: CanvasRenderingContext2D, pts: RibbonPoint[], scale: number, fill: CanvasGradient) {
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

/** Draws the stream at `now`. Exported for tests. */
export function paintPlasma(ctx: CanvasRenderingContext2D, s: PlasmaStream, now: number, layout: PlasmaLayout, reduceMotion: boolean) {
  const T = now - s.start;
  if (T < 0) return;
  if (s.end !== Infinity && T >= PLASMA_BURST_MS) return;
  const fx = fxCellSize(layout.cellW);
  const { ox, oy } = layout;
  const end = s.end;

  // The nozzle glows while it fires.
  const nk = T < end ? Math.min(1, T / BUILD_MS) : Math.max(0, 1 - (T - end) / 100);
  if (nk > 0) {
    radialGlow(ctx, ox, oy, fx * 0.06 * (0.85 + 0.15 * Math.sin(T * 0.07)), [
      [0, `rgba(235,250,255,${0.85 * nk})`],
      [0.35, `rgba(110,200,255,${0.55 * nk})`],
      [1, "rgba(120,110,255,0)"],
    ]);
  }

  // The jet: one ribbon through every point of plasma still in flight, from the nozzle out.
  const last = Math.floor(Math.min(T, end - 1) / EMIT_MS);
  const firstInFlight = Math.max(0, Math.floor((T - MAX_TRAVEL_MS) / EMIT_MS) - 2);
  const pts: RibbonPoint[] = [];
  let tip: { b: Bead; k: number } | null = null;
  for (let i = last; i >= firstInFlight; i--) {
    const b = bead(layout, s, i);
    const age = T - b.t;
    if (age < 0) continue;
    const k = emitStrength(b.t, end);
    if (k <= 0) continue;
    if (age >= b.travel) {
      if (!tip || b.t > tip.b.t) tip = { b, k };
      continue;
    }
    const u = 1 - Math.pow(1 - age / b.travel, 1.3);
    const dx = b.ax - ox;
    const dy = b.ay - oy;
    const len = Math.hypot(dx, dy) || 1;
    const rip = fx * 0.012 * u * Math.sin(age * 0.03 + b.ph);
    const pulse = 0.82 + 0.18 * Math.sin(u * 18 - T * 0.045);
    pts.push({ x: ox + dx * u - (dy / len) * rip, y: oy + dy * u + (dx / len) * rip, w: fx * (0.035 + 0.07 * u) * pulse * (0.35 + 0.65 * k), u });
  }
  pts.sort((a, b) => a.u - b.u);
  // It ends where the newest plasma to land hit the hull, and starts at the nozzle while it's firing.
  if (tip) pts.push({ x: tip.b.ax, y: tip.b.ay, w: fx * 0.105 * (0.35 + 0.65 * tip.k), u: 1 });
  if (T < end && pts.length && pts[0].u > 0) pts.unshift({ x: ox, y: oy, w: fx * 0.03, u: 0 });
  if (pts.length >= 2) {
    const head = pts[0];
    const tail = pts[pts.length - 1];
    const along = (alpha: number) => {
      const g = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
      const u0 = head.u;
      const span = Math.max(0.0001, tail.u - u0);
      if (u0 > 0) g.addColorStop(0, `rgba(${plasmaColor(u0)},${alpha})`);
      for (const uu of [0, 0.25, 0.6, 1]) {
        if (uu < u0) continue;
        g.addColorStop(Math.min(1, Math.max(0, (uu - u0) / span)), `rgba(${plasmaColor(uu)},${alpha * (uu > 0.85 ? 0.75 : 1)})`);
      }
      return g;
    };
    ribbon(ctx, pts, 2.4, along(0.22));
    ribbon(ctx, pts, 1, along(0.6));
    const core = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    core.addColorStop(0, "rgba(245,252,255,0.95)");
    core.addColorStop(0.55, "rgba(200,235,255,0.55)");
    core.addColorStop(1, "rgba(170,160,255,0.15)");
    ribbon(ctx, pts, 0.32, core);
  }

  // The splash: plasma that landed in the last SPLASH_MS.
  let heat = 0;
  const firstLanded = Math.max(0, Math.floor((T - MAX_TRAVEL_MS - SPLASH_MS) / EMIT_MS) - 2);
  for (let i = firstLanded; i <= last; i++) {
    const b = bead(layout, s, i);
    const e = T - (b.t + b.travel);
    if (e < 0 || e >= SPLASH_MS) continue;
    const k = emitStrength(b.t, end);
    if (k <= 0) continue;
    heat += k * (1 - e / SPLASH_MS);
    if (e < 120) {
      radialGlow(ctx, b.ax, b.ay, fx * 0.08 * (1 - e / 120) + 0.5, [
        [0, `rgba(250,253,255,${0.3 * k})`],
        [0.4, `rgba(140,200,255,${0.2 * k})`],
        [1, "rgba(130,110,255,0)"],
      ]);
    }
    if (b.i % 3 !== 0) continue;
    for (let d = 0; d < (reduceMotion ? 1 : 2); d++) {
      const r = (kk: number) => hash(s.seed * 7919 + b.i * 13 + kk);
      const life = 160 + r(20 + d) * 120;
      if (e >= life) continue;
      const back = Math.atan2(oy - b.ay, ox - b.ax) + (r(30 + d) - 0.5) * 2.4;
      const v = fx * (0.002 + r(40 + d) * 0.003);
      const q = e / life;
      const dd = v * e * (1 - 0.45 * q);
      const d0 = Math.max(0, dd - fx * 0.03);
      strokeSegment(ctx, b.ax + Math.cos(back) * d0, b.ay + Math.sin(back) * d0, b.ax + Math.cos(back) * dd, b.ay + Math.sin(back) * dd, 0.9, `rgba(${mixRgb(DROPLET[0], DROPLET[1], q)},${(1 - q) * k})`);
    }
  }
  // The hull's heat glow builds while the stream holds.
  const hk = Math.min(1, heat / 18);
  if (hk > 0) {
    radialGlow(ctx, layout.cx, layout.cy, layout.cellW * 0.4, [
      [0, `rgba(150,140,255,${0.22 * hk})`],
      [0.5, `rgba(110,150,255,${0.12 * hk})`],
      [1, "rgba(110,150,255,0)"],
    ]);
  }
  // A flare every FLARE_EVERY_MS of the stream landing.
  for (let f = 0; ; f++) {
    const at = FIRST_LANDING_MS + f * FLARE_EVERY_MS;
    if (at > T || (end !== Infinity && at > end + SPLASH_MS)) break;
    const e = T - at;
    if (e >= 160) continue;
    const a = aimAt(layout, s.seed, at - 350);
    const q = e / 160;
    radialGlow(ctx, a.x, a.y, fx * 0.12 * (0.6 + 0.4 * (1 - Math.pow(1 - q, 3))), [
      [0, `rgba(255,255,255,${0.7 * (1 - q)})`],
      [0.35, `rgba(150,200,255,${0.45 * (1 - q)})`],
      [1, "rgba(140,110,255,0)"],
    ]);
    strokeRing(ctx, a.x, a.y, fx * (0.03 + 0.12 * (1 - Math.pow(1 - q, 3))), 0.6 + 1.2 * (1 - q), `rgba(170,190,255,${0.5 * (1 - q)})`);
  }
}

export const PlasmaShootingAnimation = React.memo(function PlasmaShootingAnimation({
  gridContainerRef,
  attackerRow,
  attackerCol,
  targetRow,
  targetCol,
  facingRight,
  soundOnceKey,
  once = false,
}: PlasmaShootingAnimationProps) {
  const soundsMuted = useWeaponSoundsMuted();
  const soundOnceKeyRef = useRef(soundOnceKey);
  const soundsMutedRef = useRef(soundsMuted);
  const onceRef = useRef(once);
  onceRef.current = once;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aimRef = useRef({ attackerRow, attackerCol, targetRow, targetCol, facingRight });
  aimRef.current = { attackerRow, attackerCol, targetRow, targetCol, facingRight };
  /** A new attack starts the stream again. */
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
    const flame =
      !soundsMutedRef.current && (key == null || takeFirstPlay(FLAME_PLAYED_KEY, key)) ? playSoundEffect(FLAME_SOUND) : null;
    const flameStartedAt = Date.now();

    let layout: PlasmaLayout | null = null;
    let layoutKey = "";
    const ro = new ResizeObserver(() => {
      layout = null;
    });
    ro.observe(grid);
    let stream: PlasmaStream | null = null;
    let streamKey = "";

    const paint = (now: number) => {
      if (!layout || layoutKey !== attackKeyRef.current) {
        const a = aimRef.current;
        layout = plasmaLayout(grid, a.attackerRow, a.attackerCol, a.targetRow, a.targetCol, a.facingRight);
        layoutKey = attackKeyRef.current;
      }
      if (!stream || streamKey !== attackKeyRef.current) {
        stream = newPlasmaStream(now, onceRef.current);
        streamKey = attackKeyRef.current;
      }
      const ctx = overlay.begin();
      if (!ctx) return;
      paintPlasma(ctx, stream, now, layout, reduceMotion);
    };

    const stopRaf = startCancelledRaf(paint);
    return () => {
      stopRaf();
      ro.disconnect();
      overlay.dispose();
      if (flame && Date.now() - flameStartedAt > FLAME_STOP_AFTER_MS) flame.pause();
    };
  }, [gridContainerRef]);

  return <canvas ref={canvasRef} className="absolute pointer-events-none z-20" style={FX_CANVAS_STYLE} aria-hidden="true" />;
});
