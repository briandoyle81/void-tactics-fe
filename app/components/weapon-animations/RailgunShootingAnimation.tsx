"use client";

import React, { useEffect, useRef } from "react";
import {
  RAILGUN_IMPACT_DURATION_MS,
  RAILGUN_RESPAWN_DELAY_MS,
  railgunChargeMs,
  railgunSpeedCellsPerSec,
} from "../../constants/animationTiming";
import { cellCenterOnGrid, gridLayoutSize } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import {
  FX_CANVAS_STYLE,
  type RGB,
  attachOverlayCanvas,
  fxCellSize,
  gaussian,
  mixRgb,
  prefersReducedMotion,
  radialGlow,
  strokeRing,
  strokeSegment,
} from "./canvasFx";
import { playSoundEffect } from "../../hooks/useSoundEffects";
import { takeFirstPlay } from "./playOnce";
import { useWeaponSoundsMuted } from "./weaponSounds";

// The railgun: one hypersonic slug in a straight line. A short charge
// (arcs jump between the rails), a muzzle blast, then the slug, whose wake
// stays lit where it passed and cools from the muzzle forward, with a spiral
// that unwinds. The Railgun (variant 1) punches through: an entry flash, a
// streak through the hull, an exit blast and a cone of spall out the far
// side. The Linear Accelerator (variant 2) is a heavy bar, slower, that
// smashes the surface: a crushing flash, two shock rings, spall thrown back
// and a crater glow. Drawn on one canvas added onto the board (canvasFx).
// Everything after the hit is over within RAILGUN_IMPACT_DURATION_MS.
// Reviewed in the railgun rework artifact (2026-11-06).
//
// The shot's fire sound (railgun-fire.wav) plays at launch and its impact
// (railgun-impact.wav) at the hit, both pitched a little differently each
// time; the Linear Accelerator plays them 20% lower. Later shots in the
// aiming preview are silent. A played-back move plays them once per move
// (soundOnceKey).
const FIRE_SOUND = "/sound/railgun-fire.wav";
const IMPACT_SOUND = "/sound/railgun-impact.wav";
const PITCH_VARIATION = 0.05;
const LINEAR_ACCELERATOR_PITCH = 0.8;
const IMPACT_PLAYED_KEY = "vt-railgun-impact-played-v1";

interface RailgunShootingAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  attackerRow: number;
  attackerCol: number;
  targetRow: number;
  targetCol: number;
  facingRight: boolean;
  /** Variant 2 is the Linear Accelerator: same shot family, bigger and slower. */
  variant?: number;
  /**
   * The move being played back: the sounds play once per key this session.
   * Omitted (aiming preview), they play for the first shot each time it mounts.
   */
  soundOnceKey?: string;
  /** Move playback: fire one shot. Omitted (the aiming preview), it fires again RAILGUN_RESPAWN_DELAY_MS after each hit. */
  once?: boolean;
}

/** Hit points around the hull centre, as fractions of the target cell. */
const AIM_SPREAD_X = 0.08;
const AIM_CLAMP_X = 0.2;
const AIM_SPREAD_Y = 0.04;
/** How far past the entry point a Railgun round comes out, in cells. */
const EXIT_DEPTH_CELLS = 0.42;
const SPALL_DRAG = 0.0045;

type Spall = { ang: number; heat: number; v: number; life: number; w: number; chunk: boolean };
type Spark = { ang: number; v: number; life: number };
type Shot = {
  start: number;
  launch: number;
  travel: number;
  hit: number;
  /** Aim offset from the target cell's centre, as fractions of the cell. */
  ux: number;
  uy: number;
  spall: Spall[];
  sparks: Spark[];
  sounding: boolean;
  firePlayed: boolean;
  impactPlayed: boolean;
  arcSeed: number;
};

export type Layout = {
  ox: number;
  oy: number;
  tcx: number;
  tcy: number;
  cellW: number;
  cellH: number;
  /** Which way the ship (and so the Linear Accelerator's barrel) points: 1 right, -1 left. */
  face: 1 | -1;
};

const WHITE_BLUE: [RGB, RGB] = [[235, 250, 255], [86, 214, 255]];
const YELLOW: [RGB, RGB] = [[255, 232, 102], [255, 150, 30]];
const ORANGE: [RGB, RGB] = [[255, 150, 60], [200, 50, 10]];
const WAKE_SPIRAL: [RGB, RGB] = [[170, 240, 255], [40, 110, 255]];

/** Small deterministic noise for the charge arcs, so they flicker on a fixed beat. */
function arcNoise(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function railgunLayout(
  grid: HTMLElement,
  ar: number,
  ac: number,
  tr: number,
  tc: number,
  facingRight: boolean,
  linearAccelerator: boolean,
): Layout {
  const { cellWidth, cellHeight } = gridLayoutSize(grid);
  const center = cellCenterOnGrid(grid, ar, ac);
  const target = cellCenterOnGrid(grid, tr, tc);
  const forward = cellWidth * (0.3 + (linearAccelerator ? 0.09 : 0));
  return {
    ox: center.x + (facingRight ? forward : -forward),
    oy: center.y - cellHeight * 0.15,
    tcx: target.x,
    tcy: target.y,
    cellW: cellWidth,
    cellH: cellHeight,
    face: facingRight ? 1 : -1,
  };
}

/** Exported for tests. */
export function newShot(start: number, layout: Layout, la: boolean, sounding: boolean, reduceMotion: boolean): Shot {
  const ux = Math.max(-AIM_CLAMP_X, Math.min(AIM_CLAMP_X, gaussian() * AIM_SPREAD_X));
  const uy = gaussian() * AIM_SPREAD_Y;
  const hx = layout.tcx + ux * layout.cellW;
  const hy = layout.tcy + uy * layout.cellH;
  const dist = Math.hypot(hx - layout.ox, hy - layout.oy);
  const avgCell = (layout.cellW + layout.cellH) / 2;
  const speed = (avgCell * railgunSpeedCellsPerSec(la ? 2 : 1)) / 1000;
  const travel = Math.max(dist, avgCell * 0.12) / Math.max(speed, 0.001);
  const launch = start + railgunChargeMs(la ? 2 : 1);
  const spreadMax = la ? Math.PI * 0.72 : (48 * Math.PI) / 180;
  const nChunks = la ? 6 : 4;
  const nSpall = Math.round((la ? 20 : 16) * (reduceMotion ? 0.5 : 1));
  return {
    start,
    launch,
    travel,
    hit: launch + travel,
    ux,
    uy,
    // Spall angles are offsets from the slug's direction (the Linear Accelerator's from straight back).
    spall: Array.from({ length: nSpall + nChunks }, (_, i) => {
      const chunk = i < nChunks;
      const raw = (Math.random() * 2 - 1) * spreadMax * (chunk && !la ? 0.55 : 1);
      return {
        ang: raw,
        heat: Math.abs(raw) / spreadMax,
        v: (chunk ? 0.05 + Math.random() * 0.05 : 0.11 + Math.random() * 0.13) * (la ? 0.8 : 1),
        life: chunk ? 520 + Math.random() * 100 : 300 + Math.random() * 300,
        w: chunk ? 1.6 + Math.random() * 1.2 : 0.6 + Math.random() * 0.9,
        chunk,
      };
    }),
    sparks: Array.from({ length: la ? 7 : 4 }, () => ({
      ang: gaussian() * 0.35,
      v: 0.12 + Math.random() * 0.1,
      life: 110 + Math.random() * 60,
    })),
    sounding,
    firePlayed: false,
    impactPlayed: false,
    arcSeed: Math.floor(Math.random() * 1e9),
  };
}

function spallColor(heat: number, q: number) {
  const pair = heat < 0.3 ? WHITE_BLUE : heat < 0.65 ? YELLOW : ORANGE;
  return mixRgb(pair[0], pair[1], q);
}

/** Exported for tests. */
export function paintShot(ctx: CanvasRenderingContext2D, shot: Shot, now: number, layout: Layout, la: boolean) {
  if (la) {
    paintLinearAccelerator(ctx, shot, now, layout);
    return;
  }
  const fx = fxCellSize(layout.cellW);
  const { ox, oy } = layout;
  const hx = layout.tcx + shot.ux * layout.cellW;
  const hy = layout.tcy + shot.uy * layout.cellH;
  const ang = Math.atan2(hy - oy, hx - ox);
  const dist = Math.hypot(hx - ox, hy - oy);
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const nx = -dy;
  const ny = dx;
  const chargeMs = shot.launch - shot.start;
  const t = now - shot.start;

  // Charge: arcs jump between the rails behind the muzzle, and the barrel glows.
  if (t < chargeMs + 40) {
    const k = t < chargeMs ? 1 - Math.pow(1 - t / chargeMs, 3) : 1 - (t - chargeMs) / 40;
    radialGlow(ctx, ox, oy, fx * (la ? 0.08 : 0.06) * (0.5 + 0.5 * k), [
      [0, `rgba(220,248,255,${0.8 * k})`],
      [0.35, `rgba(86,214,255,${0.5 * k})`],
      [1, "rgba(86,214,255,0)"],
    ]);
    if (t < chargeMs) {
      const rnd = arcNoise(shot.arcSeed + Math.floor(t / 30));
      const gap = fx * 0.025;
      for (let i = 0; i < (la ? 3 : 2); i++) {
        const back = fx * (0.02 + 0.045 * i + rnd() * 0.02);
        const bx = ox - dx * back;
        const by = oy - dy * back;
        const pts: Array<[number, number]> = [];
        for (let s = 0; s <= 4; s++) {
          const f = s / 4 - 0.5;
          const j = s === 0 || s === 4 ? 0 : (rnd() - 0.5) * fx * 0.02;
          pts.push([bx + nx * gap * 2 * f + dx * j, by + ny * gap * 2 * f + dy * j]);
        }
        for (const [w, a] of [[fx * 0.012, 0.35], [1, 0.95]] as const) {
          ctx.strokeStyle = `rgba(190,240,255,${a * k})`;
          ctx.lineWidth = w;
          ctx.lineJoin = "round";
          ctx.beginPath();
          pts.forEach(([x, y], n) => (n ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
      }
    }
  }
  const a = now - shot.launch;
  if (a < 0) return;

  // Launch: a hot flash, a thin shock ring, a few sparks out of the barrel.
  if (a < 90) {
    const k = (1 - a / 90) ** 2;
    radialGlow(ctx, ox, oy, fx * (la ? 0.14 : 0.09), [
      [0, `rgba(255,255,255,${k})`],
      [0.3, `rgba(150,230,255,${0.8 * k})`],
      [1, "rgba(86,214,255,0)"],
    ]);
  }
  if (a < 160) {
    const q = a / 160;
    strokeRing(ctx, ox, oy, fx * (0.03 + (la ? 0.2 : 0.12) * (1 - Math.pow(1 - q, 3))), 0.6 + 1.4 * (1 - q), `rgba(140,225,255,${0.55 * (1 - q)})`);
  }
  for (const s of shot.sparks) {
    if (a > s.life) continue;
    const q = a / s.life;
    const d = s.v * fx * 0.01 * a * (1 - 0.5 * q);
    const d0 = Math.max(0, d - fx * 0.03);
    const sa = ang + s.ang;
    strokeSegment(ctx, ox + Math.cos(sa) * d0, oy + Math.sin(sa) * d0, ox + Math.cos(sa) * d, oy + Math.sin(sa) * d, 0.8, `rgba(${mixRgb(WHITE_BLUE[0], WHITE_BLUE[1], q)},${1 - q})`);
  }

  // The wake: each point lights as the slug passes and cools from there, with a spiral that unwinds.
  const u = Math.min(1, a / shot.travel);
  const headD = u * dist;
  const coreFade = la ? 140 : 90;
  const spiralFade = la ? 320 : 220;
  const glowFade = la ? 260 : 170;
  const lambda = fx * (la ? 0.32 : 0.22);
  type WakePoint = { x: number; y: number; s1x: number; s1y: number; s2x: number; s2y: number };
  // The wake fades out over the impact's last 150 ms, so it's gone when the shot is.
  const wakeEnd = Math.max(0, Math.min(1, (shot.travel + RAILGUN_IMPACT_DURATION_MS - a) / 150));
  let prev: WakePoint | null = null;
  for (let s = 0; s <= headD; s += 2) {
    const age = a - (s / dist) * shot.travel;
    if (age > spiralFade * 2.2) {
      prev = null;
      continue;
    }
    const x = ox + dx * s;
    const y = oy + dy * s;
    const amp = fx * (0.012 + (la ? 0.04 : 0.03) * Math.min(1, age / 350));
    const sin = Math.sin((s / lambda) * Math.PI * 2 + age * 0.004);
    const cur: WakePoint = { x, y, s1x: x + nx * amp * sin, s1y: y + ny * amp * sin, s2x: x - nx * amp * sin, s2y: y - ny * amp * sin };
    if (prev) {
      const ga = wakeEnd * (la ? 0.4 : 0.32) * Math.exp(-age / glowFade);
      if (ga > 0.01) strokeSegment(ctx, prev.x, prev.y, x, y, fx * (la ? 0.06 : 0.035), `rgba(86,214,255,${ga})`);
      const ca = wakeEnd * Math.exp(-age / coreFade);
      if (ca > 0.01) strokeSegment(ctx, prev.x, prev.y, x, y, Math.max(1, fx * (la ? 0.018 : 0.01)), `rgba(225,248,255,${ca})`);
      const sa = wakeEnd * 0.7 * Math.exp(-age / spiralFade);
      if (sa > 0.01) {
        const c = mixRgb(WAKE_SPIRAL[0], WAKE_SPIRAL[1], age / 400);
        strokeSegment(ctx, prev.s1x, prev.s1y, cur.s1x, cur.s1y, 0.8, `rgba(${c},${sa})`);
        strokeSegment(ctx, prev.s2x, prev.s2y, cur.s2x, cur.s2y, 0.8, `rgba(${c},${sa * 0.8})`);
      }
    }
    prev = cur;
  }

  // The slug: a white-hot dart, or the Linear Accelerator's heavy bar.
  if (a < shot.travel) {
    const px = ox + dx * headD;
    const py = oy + dy * headD;
    if (la) {
      const tx = px - dx * fx * 0.28;
      const ty = py - dy * fx * 0.28;
      strokeSegment(ctx, tx, ty, px, py, fx * 0.11, "rgba(86,214,255,0.35)");
      strokeSegment(ctx, tx, ty, px, py, fx * 0.05, "rgba(160,232,255,0.9)");
      strokeSegment(ctx, tx, ty, px, py, fx * 0.02, "rgba(255,255,255,1)");
      radialGlow(ctx, px, py, fx * 0.07, [[0, "rgba(255,255,255,0.9)"], [0.4, "rgba(86,214,255,0.5)"], [1, "rgba(86,214,255,0)"]]);
    } else {
      const tx = px - dx * fx * 0.1;
      const ty = py - dy * fx * 0.1;
      strokeSegment(ctx, tx, ty, px, py, fx * 0.04, "rgba(86,214,255,0.5)");
      strokeSegment(ctx, tx, ty, px, py, Math.max(1, fx * 0.012), "rgba(255,255,255,1)");
      radialGlow(ctx, px, py, fx * 0.035, [[0, "rgba(255,255,255,1)"], [0.4, "rgba(120,225,255,0.6)"], [1, "rgba(86,214,255,0)"]]);
    }
    return;
  }

  // The hit.
  const e = a - shot.travel;
  if (e >= RAILGUN_IMPACT_DURATION_MS) return;
  radialGlow(ctx, hx, hy, layout.cellW * (la ? 0.4 : 0.32), [
    [0, `rgba(86,214,255,${(la ? 0.2 : 0.16) * Math.exp(-e / 50)})`],
    [1, "rgba(86,214,255,0)"],
  ]);
  const exitX = hx + dx * layout.cellW * EXIT_DEPTH_CELLS;
  const exitY = hy + dy * layout.cellW * EXIT_DEPTH_CELLS;
  if (la) {
    if (e < 140) {
      const k = (1 - e / 140) ** 2;
      radialGlow(ctx, hx, hy, fx * 0.22, [
        [0, `rgba(255,255,255,${k})`],
        [0.25, `rgba(170,235,255,${0.85 * k})`],
        [0.6, `rgba(86,214,255,${0.35 * k})`],
        [1, "rgba(86,214,255,0)"],
      ]);
      strokeSegment(ctx, hx - dx * fx * 0.12, hy - dy * fx * 0.12, hx, hy, fx * 0.05 * (1 - e / 140) + 0.5, `rgba(220,248,255,${0.9 * k})`);
    }
    if (e < 260) {
      const q = e / 260;
      strokeRing(ctx, hx, hy, fx * 0.3 * (1 - Math.pow(1 - q, 3)) + 0.5, 0.6 + 2 * (1 - q), `rgba(140,225,255,${0.7 * (1 - q)})`);
    }
    if (e < 520) {
      const q = e / 520;
      strokeRing(ctx, hx, hy, fx * 0.45 * (1 - Math.pow(1 - q, 3)) + 0.5, 0.6 + 1.2 * (1 - q), `rgba(86,214,255,${0.3 * (1 - q)})`);
    }
    if (e < 600) {
      const q = e / 600;
      radialGlow(ctx, hx, hy, fx * 0.06, [
        [0, `rgba(${mixRgb([255, 200, 140], [140, 30, 10], q)},${0.85 * (1 - q)})`],
        [1, "rgba(140,30,10,0)"],
      ]);
    }
  } else {
    if (e < 90) {
      const k = (1 - e / 90) ** 2;
      radialGlow(ctx, hx, hy, fx * 0.08, [
        [0, `rgba(255,255,255,${k})`],
        [0.35, `rgba(150,230,255,${0.7 * k})`],
        [1, "rgba(86,214,255,0)"],
      ]);
      strokeSegment(ctx, hx, hy, exitX, exitY, fx * 0.02, `rgba(230,250,255,${1 - e / 90})`);
    }
    if (e < 120) {
      const k = (1 - e / 120) ** 2;
      radialGlow(ctx, exitX, exitY, fx * 0.1, [
        [0, `rgba(255,250,235,${k})`],
        [0.3, `rgba(255,190,90,${0.8 * k})`],
        [1, "rgba(255,120,40,0)"],
      ]);
    }
    if (e < 450) {
      const q = e / 450;
      radialGlow(ctx, hx, hy, fx * 0.03, [
        [0, `rgba(${mixRgb([220, 248, 255], [40, 90, 200], q)},${0.9 * (1 - q)})`],
        [1, "rgba(40,90,200,0)"],
      ]);
    }
  }
  const fromX = la ? hx : exitX;
  const fromY = la ? hy : exitY;
  const base = la ? ang + Math.PI : ang;
  for (const s of shot.spall) {
    if (e > s.life) continue;
    const q = e / s.life;
    const reach = s.v * fx * 0.02;
    const d = (reach * (1 - Math.exp(-SPALL_DRAG * e))) / SPALL_DRAG;
    const d0 = (reach * (1 - Math.exp(-SPALL_DRAG * Math.max(0, e - (s.chunk ? 10 : 22))))) / SPALL_DRAG;
    const sa = base + s.ang;
    strokeSegment(ctx, fromX + Math.cos(sa) * d0, fromY + Math.sin(sa) * d0, fromX + Math.cos(sa) * d, fromY + Math.sin(sa) * d, s.w, `rgba(${spallColor(s.heat, q)},${1 - q})`);
  }
}

// The Linear Accelerator (variant 2, fired by variant-2 ships): a coil gun. Four coils along the barrel
// (always along the ship's axis) light one after another through the charge; the slug leaves the end
// of the barrel at the shot's angle, leaving three acceleration rings. It's a small heavy slug with a bow
// shock ahead of it and a line of halo rings behind (not the Railgun's spiral). It smashes the surface:
// a kinetic flash, a crater rim that cools from white-cyan to dark red, a wide fan of molten spall and
// two shockwaves. Everything fades over the impact's last 150 ms. Reviewed in the Linear Accelerator
// rework artifact (2026-11-06).
const LA_COILS = 4;
const LA_LAUNCH_RINGS = 3;
/** Halo rings are left this far apart along the path, as a fraction of the cell. */
const LA_WAKE_RING_EVERY = 0.18;
const LA_WAKE_RING_MS = 360;
/** The slug, as fractions of an effect cell. */
const LA_SLUG = { length: 0.093, width: 0.017 };

/** An ellipse at (x, y), its axis at `ang`: rAlong along it, rAcross across it. */
function ellipseRing(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, rAcross: number, rAlong: number, width: number, style: string) {
  if (!(rAcross > 0)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(0.1, rAlong), rAcross, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function paintLinearAccelerator(ctx: CanvasRenderingContext2D, shot: Shot, now: number, layout: Layout) {
  const fx = fxCellSize(layout.cellW);
  const { ox, oy } = layout;
  const hx = layout.tcx + shot.ux * layout.cellW;
  const hy = layout.tcy + shot.uy * layout.cellH;
  const ang = Math.atan2(hy - oy, hx - ox);
  const dist = Math.hypot(hx - ox, hy - oy);
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const chargeMs = shot.launch - shot.start;
  const t = now - shot.start;
  const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
  const end = Math.max(0, Math.min(1, (shot.hit + RAILGUN_IMPACT_DURATION_MS - now) / 150));

  // Charge: the coils along the barrel light in sequence, and the muzzle glows.
  if (t < chargeMs + 60) {
    const k = t < chargeMs ? easeOut(t / chargeMs) : 1 - (t - chargeMs) / 60;
    radialGlow(ctx, ox, oy, fx * 0.09 * (0.5 + 0.5 * k), [
      [0, `rgba(220,248,255,${0.8 * k})`],
      [0.35, `rgba(86,214,255,${0.5 * k})`],
      [1, "rgba(86,214,255,0)"],
    ]);
    const barrelAng = layout.face > 0 ? 0 : Math.PI;
    for (let i = 0; i < LA_COILS; i++) {
      const litAt = (i / LA_COILS) * chargeMs;
      const lit = t < chargeMs ? Math.min(1, Math.max(0, (t - litAt) / 40)) : k;
      if (lit <= 0) continue;
      const x = ox - layout.face * fx * (0.2 - i * 0.045);
      ellipseRing(ctx, x, oy, barrelAng, fx * 0.04, fx * 0.012, 1.4, `rgba(170,240,255,${0.9 * lit})`);
      ellipseRing(ctx, x, oy, barrelAng, fx * 0.045, fx * 0.016, fx * 0.02, `rgba(86,214,255,${0.18 * lit})`);
    }
  }
  const a = now - shot.launch;
  if (a < 0) return;

  // Launch: a flash, and acceleration rings along the first stretch of the path.
  if (a < 100) {
    const k = (1 - a / 100) ** 2;
    radialGlow(ctx, ox, oy, fx * 0.15, [
      [0, `rgba(255,255,255,${k})`],
      [0.3, `rgba(150,230,255,${0.8 * k})`],
      [1, "rgba(86,214,255,0)"],
    ]);
  }
  for (let i = 0; i < LA_LAUNCH_RINGS; i++) {
    const e = a - i * 45;
    if (e < 0 || e > 320) continue;
    const q = e / 320;
    const s = layout.cellW * (0.05 + 0.22 * i);
    ellipseRing(ctx, ox + dx * s, oy + dy * s, ang, fx * (0.05 + 0.09 * easeOut(q)), fx * (0.016 + 0.03 * easeOut(q)), 1 + 1.2 * (1 - q), `rgba(150,230,255,${0.65 * (1 - q)})`);
  }

  // The wake: a straight core that cools fast, and halo rings left behind the slug.
  const headD = Math.min(1, a / shot.travel) * dist;
  let prev: { x: number; y: number } | null = null;
  for (let s = 0; s <= headD; s += 2) {
    const age = a - (s / dist) * shot.travel;
    const x = ox + dx * s;
    const y = oy + dy * s;
    if (prev) {
      const ca = Math.exp(-age / 140) * end;
      if (ca > 0.01) {
        strokeSegment(ctx, prev.x, prev.y, x, y, fx * 0.05, `rgba(86,214,255,${0.3 * ca})`);
        strokeSegment(ctx, prev.x, prev.y, x, y, Math.max(1, fx * 0.016), `rgba(225,248,255,${ca})`);
      }
    }
    prev = { x, y };
  }
  const ringEvery = layout.cellW * LA_WAKE_RING_EVERY;
  for (let s = ringEvery; s <= headD; s += ringEvery) {
    const age = a - (s / dist) * shot.travel;
    if (age < 0 || age > LA_WAKE_RING_MS) continue;
    const q = age / LA_WAKE_RING_MS;
    ellipseRing(ctx, ox + dx * s, oy + dy * s, ang, fx * (0.035 + 0.07 * easeOut(q)), fx * (0.012 + 0.02 * easeOut(q)), 0.9 + 0.8 * (1 - q), `rgba(140,225,255,${0.6 * (1 - q) * end})`);
  }

  // The slug, with a bow shock ahead of it.
  if (a < shot.travel) {
    const px = ox + dx * headD;
    const py = oy + dy * headD;
    const L = fx * LA_SLUG.length;
    const W = fx * LA_SLUG.width;
    const tx = px - dx * L;
    const ty = py - dy * L;
    strokeSegment(ctx, tx, ty, px, py, W * 2.2, "rgba(86,214,255,0.35)");
    strokeSegment(ctx, tx, ty, px, py, W, "rgba(160,232,255,0.9)");
    strokeSegment(ctx, tx, ty, px, py, Math.max(0.8, W * 0.4), "rgba(255,255,255,1)");
    radialGlow(ctx, px, py, W * 1.4, [[0, "rgba(255,255,255,0.9)"], [0.4, "rgba(86,214,255,0.5)"], [1, "rgba(86,214,255,0)"]]);
    const arcR = L;
    ctx.save();
    ctx.translate(px + dx * L * 0.38, py + dy * L * 0.38);
    ctx.rotate(ang);
    for (const [w, alpha] of [[W * 0.6, 0.25], [0.8, 0.9]] as const) {
      ctx.strokeStyle = `rgba(200,245,255,${alpha})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(-arcR, 0, arcR, -0.75, 0.75);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // The hit.
  const e = a - shot.travel;
  if (e >= RAILGUN_IMPACT_DURATION_MS) return;
  radialGlow(ctx, hx, hy, layout.cellW * 0.42, [[0, `rgba(86,214,255,${0.22 * Math.exp(-e / 60)})`], [1, "rgba(86,214,255,0)"]]);
  if (e < 120) {
    const k = (1 - e / 120) ** 2;
    radialGlow(ctx, hx, hy, fx * 0.24, [
      [0, `rgba(255,255,255,${k})`],
      [0.25, `rgba(180,238,255,${0.85 * k})`],
      [0.6, `rgba(86,214,255,${0.35 * k})`],
      [1, "rgba(86,214,255,0)"],
    ]);
  }
  // The crater rim stays and cools.
  const q = e / RAILGUN_IMPACT_DURATION_MS;
  const rim = q < 0.3 ? mixRgb([220, 248, 255], [255, 200, 120], q / 0.3) : mixRgb([255, 200, 120], [120, 25, 10], (q - 0.3) / 0.7);
  ellipseRing(ctx, hx, hy, ang, fx * (0.08 + 0.04 * easeOut(q)), fx * (0.03 + 0.015 * easeOut(q)), fx * 0.02 * (1 - 0.5 * q), `rgba(${rim},${0.85 * Math.pow(1 - q, 0.8) * end})`);
  radialGlow(ctx, hx, hy, fx * 0.06, [[0, `rgba(${rim},${0.7 * (1 - q) * end})`], [1, "rgba(120,25,10,0)"]]);
  if (e < 260) {
    const r = e / 260;
    strokeRing(ctx, hx, hy, fx * 0.3 * easeOut(r) + 0.5, 0.6 + 2 * (1 - r), `rgba(140,225,255,${0.7 * (1 - r)})`);
  }
  if (e < 520) {
    const r = e / 520;
    strokeRing(ctx, hx, hy, fx * 0.45 * easeOut(r) + 0.5, 0.6 + 1.2 * (1 - r), `rgba(86,214,255,${0.3 * (1 - r)})`);
  }
  const back = ang + Math.PI;
  for (const sp of shot.spall) {
    if (e > sp.life) continue;
    const r = e / sp.life;
    const reach = sp.v * fx * 0.02;
    const d = (reach * (1 - Math.exp(-SPALL_DRAG * e))) / SPALL_DRAG;
    const d0 = (reach * (1 - Math.exp(-SPALL_DRAG * Math.max(0, e - (sp.chunk ? 10 : 22))))) / SPALL_DRAG;
    const sa = back + sp.ang;
    strokeSegment(ctx, hx + Math.cos(sa) * d0, hy + Math.sin(sa) * d0, hx + Math.cos(sa) * d, hy + Math.sin(sa) * d, sp.w, `rgba(${spallColor(sp.heat, r)},${1 - r})`);
  }
}

export const RailgunShootingAnimation = React.memo(function RailgunShootingAnimation({
  gridContainerRef,
  attackerRow,
  attackerCol,
  targetRow,
  targetCol,
  facingRight,
  variant = 1,
  soundOnceKey,
  once = false,
}: RailgunShootingAnimationProps) {
  const soundsMuted = useWeaponSoundsMuted();
  const soundOnceKeyRef = useRef(soundOnceKey);
  soundOnceKeyRef.current = soundOnceKey;
  const soundsMutedRef = useRef(soundsMuted);
  soundsMutedRef.current = soundsMuted;
  const onceRef = useRef(once);
  onceRef.current = once;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const la = Number(variant) === 2;
  const aimRef = useRef({ attackerRow, attackerCol, targetRow, targetCol, facingRight, la });
  aimRef.current = { attackerRow, attackerCol, targetRow, targetCol, facingRight, la };
  /** Bumped when the attack changes, so the loop starts a fresh shot. */
  const attackKey = `${attackerRow}-${attackerCol}-${targetRow}-${targetCol}-${la ? 2 : 1}`;
  const attackKeyRef = useRef(attackKey);
  attackKeyRef.current = attackKey;

  useEffect(() => {
    const grid = gridContainerRef.current;
    const canvas = canvasRef.current;
    if (!grid || !canvas) return;
    const reduceMotion = prefersReducedMotion();
    const overlay = attachOverlayCanvas(grid, canvas);

    let layout: Layout | null = null;
    let layoutKey = "";
    const ro = new ResizeObserver(() => {
      layout = null;
    });
    ro.observe(grid);
    const currentLayout = () => {
      const { attackerRow: ar, attackerCol: ac, targetRow: tr, targetCol: tc, facingRight: face, la: isLa } = aimRef.current;
      const key = `${attackKeyRef.current}-${face ? 1 : 0}`;
      if (!layout || layoutKey !== key) {
        layout = railgunLayout(grid, ar, ac, tr, tc, face, isLa);
        layoutKey = key;
      }
      return layout;
    };

    let shot: Shot | null = null;
    let shotKey = "";
    let nextShotAt = -1;

    const paint = (now: number) => {
      const lay = currentLayout();
      const isLa = aimRef.current.la;
      if (shotKey !== attackKeyRef.current) {
        // A new attack: fire now, with its sounds if this move hasn't played them yet.
        shotKey = attackKeyRef.current;
        const key = soundOnceKeyRef.current;
        const sounding = !soundsMutedRef.current && (key == null || takeFirstPlay(IMPACT_PLAYED_KEY, key));
        shot = newShot(now, lay, isLa, sounding, reduceMotion);
        nextShotAt = -1;
      } else if (shot && nextShotAt < 0 && !onceRef.current) {
        nextShotAt = shot.hit + RAILGUN_RESPAWN_DELAY_MS;
      } else if (nextShotAt >= 0 && now >= nextShotAt) {
        shot = newShot(now, lay, isLa, false, reduceMotion);
        nextShotAt = -1;
      }

      if (shot?.sounding) {
        const pitch = isLa ? LINEAR_ACCELERATOR_PITCH : 1;
        if (!shot.firePlayed && now >= shot.launch) {
          shot.firePlayed = true;
          playSoundEffect(FIRE_SOUND, { pitch, pitchVariation: PITCH_VARIATION });
        }
        if (!shot.impactPlayed && now >= shot.hit) {
          shot.impactPlayed = true;
          playSoundEffect(IMPACT_SOUND, { pitch, pitchVariation: PITCH_VARIATION });
        }
      }

      const ctx = overlay.begin();
      if (!ctx || !shot) return;
      if (now - shot.hit >= RAILGUN_IMPACT_DURATION_MS) return;
      paintShot(ctx, shot, now, lay, isLa);
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
