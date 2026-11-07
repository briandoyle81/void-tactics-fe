"use client";

import React, { useEffect, useRef } from "react";
import {
  MISSILE_DRIFT_MS,
  MISSILE_IMPACT_DURATION_MS,
  MISSILE_RESPAWN_DELAY_MS,
  MISSILE_SECOND_FIRE_DELAY_MS,
  TORPEDO_IMPACT_DURATION_MS,
  TORPEDO_SPEED_SCALE,
} from "../../constants/animationTiming";
import { cellCenterOnGrid, gridLayoutSize } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import {
  FX_CANVAS_STYLE,
  FX_SOLID_CANVAS_STYLE,
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

// Missiles, launched from behind the ship's centre. The Missile Launcher fires two missiles MISSILE_SECOND_FIRE_DELAY_MS
// apart; the Torpedo Launcher (variant 2) one heavier, slower torpedo. Each
// ejects up and back with a puff of gas and slows to a stop over
// MISSILE_DRIFT_MS while it turns to face the target. Then its motor lights
// with a flash and it arcs into the target on a flickering flame, laying a
// smoke trail, in the time a straight flight at 4 cells/s (torpedoes slower)
// takes. A missile hit is a white flash, a fireball, a shock ring, sparks and
// a smoke burst; a torpedo's is bigger, with a double shockwave and a ring of
// smoke. Bodies and smoke are drawn normally on one canvas, light added onto
// the board on another above it (canvasFx). Everything after a hit is over
// within its impact duration. Reviewed in the missile rework artifact
// (2026-11-06).
//
// Each round of the first volley clunks out of its launcher
// (missile-eject.mp3, credited on /audio-credits) as it appears, its motor
// lights (missile-motor.wav) at ignition, and it explodes (missile-impact.wav)
// when it hits; later volleys in the aiming preview are silent. A played-back
// move plays them once per move (soundOnceKey).
const LAUNCH_SOUND = "/sound/missile-eject.mp3";
/** missile-eject.mp3 opens with ~0.12 s of quiet; skip it so the clunk lands as the missile appears. */
const LAUNCH_SOUND_START_S = 0.1;
const MOTOR_SOUND = "/sound/missile-motor.wav";
const MOTOR_PITCH_VARIATION = 0.05;
const IMPACT_SOUND = "/sound/missile-impact.wav";
const IMPACT_PITCH_VARIATION = 0.05;
/** The Torpedo Launcher plays the same three sounds 15% lower (and slower). */
const TORPEDO_PITCH = 0.85;
/** Its explosion lower still: 30% longer than that (so lower again), and 15% louder. */
const TORPEDO_IMPACT_PITCH = TORPEDO_PITCH / 1.3;
const TORPEDO_IMPACT_VOLUME = 1.15;
const LAUNCH_PLAYED_KEY = "vt-missile-launch-played-v1";

interface MissileShootingAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  attackerRow: number;
  attackerCol: number;
  targetRow: number;
  targetCol: number;
  facingRight: boolean;
  /** Variant 2 is the Torpedo Launcher: one slower, heavier round with a double shockwave. */
  variant?: number;
  /**
   * The move being played back: its sounds play once per key this session.
   * Omitted (aiming preview), they play for the first volley each time it mounts.
   */
  soundOnceKey?: string;
  /** Move playback: fire one volley. Omitted (the aiming preview), it fires again MISSILE_RESPAWN_DELAY_MS after the last hit. */
  once?: boolean;
}

/** Where the launcher is: this far forward of the ship's centre (negative: behind it), and up, as fractions of the cell. */
const LAUNCH_FORWARD = -0.08;
/** The Torpedo Launcher's tube sits further forward: 2% of a cell ahead of the ship's centre. */
const TORPEDO_LAUNCH_FORWARD = 0.02;
const LAUNCH_UP = 0.16;
/** Hit points around the hull centre, as fractions of the target cell. */
const AIM_SPREAD_X = 0.1;
const AIM_CLAMP_X = 0.22;
const AIM_SPREAD_Y = 0.05;
/** Body length and width, as fractions of the cell. */
const MISSILE_BODY = { length: 0.224, width: 0.043 };
/** The torpedo: half the size it was first built at (0.48 × 0.16). */
const TORPEDO_BODY = { length: 0.24, width: 0.08 };
/** The flame and nozzle glows scale with the body: the missile's at 66%, the torpedo's at 50%. */
const MISSILE_FLAME_SCALE = 0.66;
const TORPEDO_FLAME_SCALE = 0.5;
const SMOKE_EVERY_MS = 14;

type Spark = { ang: number; v: number; life: number; w: number };
type SmokePuff = { ang: number; d: number };
type Point = { x: number; y: number };

export type MissileRound = {
  /** When it appears (ejects). */
  start: number;
  hit: number;
  spawn: Point;
  H: Point;
  /** Its drift direction, and how far it has drifted after t ms. */
  driftDir: number;
  driftV0: number;
  h0: number;
  hAim: number;
  P0: Point;
  P1: Point;
  P2: Point;
  flightMs: number;
  sparks: Spark[];
  puffs: SmokePuff[];
  noiseSeed: number;
  index: number;
  sounding: boolean;
  played: { eject: boolean; motor: boolean; impact: boolean };
};

export type MissileLayout = { ox: number; oy: number; tcx: number; tcy: number; cellW: number; cellH: number };

function easeOutCubic(p: number) {
  return 1 - Math.pow(1 - p, 3);
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
/** Flight progress: it eases out of the stop and is still accelerating at the target. */
function easeInFlight(t: number) {
  return t * t * (1.6 - 0.6 * t);
}
function noise(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}
function bezier(p0: Point, p1: Point, p2: Point, p3: Point, u: number): Point {
  const v = 1 - u;
  return {
    x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
    y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
  };
}
function bezierTangent(p0: Point, p1: Point, p2: Point, p3: Point, u: number): Point {
  const v = 1 - u;
  return {
    x: 3 * v * v * (p1.x - p0.x) + 6 * v * u * (p2.x - p1.x) + 3 * u * u * (p3.x - p2.x),
    y: 3 * v * v * (p1.y - p0.y) + 6 * v * u * (p2.y - p1.y) + 3 * u * u * (p3.y - p2.y),
  };
}

export function missileLayout(
  grid: HTMLElement,
  ar: number,
  ac: number,
  tr: number,
  tc: number,
  facingRight: boolean,
  torpedo = false,
): MissileLayout {
  const { cellWidth, cellHeight } = gridLayoutSize(grid);
  const center = cellCenterOnGrid(grid, ar, ac);
  const target = cellCenterOnGrid(grid, tr, tc);
  return {
    ox: center.x + (facingRight ? 1 : -1) * cellWidth * (torpedo ? TORPEDO_LAUNCH_FORWARD : LAUNCH_FORWARD),
    oy: center.y - cellHeight * LAUNCH_UP,
    tcx: target.x,
    tcy: target.y,
    cellW: cellWidth,
    cellH: cellHeight,
  };
}

/** One volley: two missiles (one torpedo) from `start`. Exported for tests. */
export function newVolley(start: number, layout: MissileLayout, torpedo: boolean, sounding: boolean, reduceMotion: boolean): MissileRound[] {
  const avgCell = (layout.cellW + layout.cellH) / 2;
  const top = (avgCell * 4 * (torpedo ? TORPEDO_SPEED_SCALE : 1)) / 1000; // px per ms
  const driftV0 = (top / 8) * 1.8;
  const offsets = torpedo ? [0] : [0, MISSILE_SECOND_FIRE_DELAY_MS];
  const spawn = { x: layout.ox, y: layout.oy };
  return offsets.map((offset, index) => {
    const H = {
      x: layout.tcx + Math.max(-AIM_CLAMP_X, Math.min(AIM_CLAMP_X, gaussian() * AIM_SPREAD_X)) * layout.cellW,
      y: layout.tcy + gaussian() * AIM_SPREAD_Y * layout.cellH,
    };
    const ta = Math.atan2(H.y - spawn.y, H.x - spawn.x);
    const vari = (Math.random() - 0.5) * ((30 * Math.PI) / 180);
    // Ejected up and back: halfway between straight back and the perpendicular up the screen.
    const upSign = Math.sin(ta - Math.PI / 2) <= 0 ? -1 : 1;
    const up = ta + (upSign * Math.PI) / 2;
    const back = ta + Math.PI;
    const driftDir = Math.atan2(Math.sin(up) + Math.sin(back), Math.cos(up) + Math.cos(back)) + vari * 0.5;
    const driftEnd = driftV0 * MISSILE_DRIFT_MS * 0.5;
    const P0 = { x: spawn.x + Math.cos(driftDir) * driftEnd, y: spawn.y + Math.sin(driftDir) * driftEnd };
    const hAim = Math.atan2(H.y - P0.y, H.x - P0.x);
    const L = Math.hypot(H.x - P0.x, H.y - P0.y);
    // Out of the stop it arcs slightly over the top into the target.
    const tx = 0.2 * Math.cos(up) + 0.8 * Math.cos(hAim);
    const ty = 0.2 * Math.sin(up) + 0.8 * Math.sin(hAim);
    const tn = Math.hypot(tx, ty) || 1;
    const flightMs = Math.hypot(H.x - spawn.x, H.y - spawn.y) / Math.max(top, 0.0001);
    const roundStart = start + offset;
    const sparkCount = Math.round((torpedo ? 16 : 10) * (reduceMotion ? 0.5 : 1));
    return {
      start: roundStart,
      hit: roundStart + MISSILE_DRIFT_MS + flightMs,
      spawn,
      H,
      driftDir,
      driftV0,
      h0: ta + upSign * 0.45 + vari * 0.5,
      hAim,
      P0,
      P1: { x: P0.x + (tx / tn) * 0.35 * L, y: P0.y + (ty / tn) * 0.35 * L },
      P2: { x: H.x - Math.cos(hAim) * 0.2 * L, y: H.y - Math.sin(hAim) * 0.2 * L },
      flightMs,
      sparks: Array.from({ length: sparkCount }, () => ({
        ang: Math.random() * Math.PI * 2,
        v: 0.12 + Math.random() * 0.18,
        life: 200 + Math.random() * 220,
        w: 0.6 + Math.random() * 0.8,
      })),
      puffs: Array.from({ length: torpedo ? 10 : 6 }, (_, i) => ({
        ang: torpedo ? (i * Math.PI) / 5 : Math.random() * Math.PI * 2,
        d: 0.6 + Math.random() * 0.4,
      })),
      noiseSeed: Math.floor(Math.random() * 1e6),
      index,
      sounding,
      played: { eject: false, motor: false, impact: false },
    };
  });
}

/** Where a round is and which way it points, t ms after it appears. */
function roundState(m: MissileRound, t: number): Point & { h: number; flying: boolean } {
  if (t < MISSILE_DRIFT_MS) {
    // It slows to a stop as the motor lights.
    const d = m.driftV0 * t * (1 - (0.5 * t) / MISSILE_DRIFT_MS);
    return {
      x: m.spawn.x + Math.cos(m.driftDir) * d,
      y: m.spawn.y + Math.sin(m.driftDir) * d,
      h: m.h0 + (m.hAim - m.h0) * easeInOut(t / MISSILE_DRIFT_MS),
      flying: false,
    };
  }
  const u = easeInFlight(Math.min(1, Math.max(0, (t - MISSILE_DRIFT_MS) / m.flightMs)));
  const b = bezier(m.P0, m.P1, m.P2, m.H, u);
  const d = bezierTangent(m.P0, m.P1, m.P2, m.H, Math.max(0.001, u));
  return { x: b.x, y: b.y, h: Math.atan2(d.y, d.x), flying: true };
}

function smokePuff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, rgb: string) {
  if (!(r > 0) || a <= 0.003) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.6, `rgba(${rgb},${a * 0.6})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A flame tapering back from the nozzle at (x, y), the missile heading h. */
function flame(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, len: number, w: number, fill: string) {
  const cx = Math.cos(h);
  const cy = Math.sin(h);
  const nx = -cy;
  const ny = cx;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + (nx * w) / 2, y + (ny * w) / 2);
  ctx.quadraticCurveTo(x - cx * len * 0.45 + nx * w * 0.45, y - cy * len * 0.45 + ny * w * 0.45, x - cx * len, y - cy * len);
  ctx.quadraticCurveTo(x - cx * len * 0.45 - nx * w * 0.45, y - cy * len * 0.45 - ny * w * 0.45, x - (nx * w) / 2, y - (ny * w) / 2);
  ctx.closePath();
  ctx.fill();
}

function drawBody(solid: CanvasRenderingContext2D, light: CanvasRenderingContext2D, s: Point & { h: number }, torpedo: boolean, cellW: number) {
  const body = torpedo ? TORPEDO_BODY : MISSILE_BODY;
  const L = body.length * cellW;
  const W = body.width * cellW;
  solid.save();
  solid.translate(s.x, s.y);
  solid.rotate(s.h);
  if (torpedo) {
    const r = W / 2;
    solid.fillStyle = "#3b4350";
    solid.beginPath();
    solid.moveTo(L / 2 - r, -r);
    solid.arc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
    solid.lineTo(-L / 2 + r * 0.6, r);
    solid.lineTo(-L / 2, r * 0.6);
    solid.lineTo(-L / 2, -r * 0.6);
    solid.lineTo(-L / 2 + r * 0.6, -r);
    solid.closePath();
    solid.fill();
    solid.fillStyle = "#6b7685";
    solid.fillRect(-L / 2 + r * 0.6, -r, L - r * 1.6, W * 0.22);
    solid.fillStyle = "#2a3039";
    solid.fillRect(-L / 2 - W * 0.12, -r * 0.75, W * 0.14, r * 1.5);
  } else {
    solid.fillStyle = "#3a414c"; // fins
    solid.beginPath();
    solid.moveTo(-L / 2, -W * 1.05);
    solid.lineTo(-L / 2 + L * 0.22, -W / 2);
    solid.lineTo(-L / 2 + L * 0.22, W / 2);
    solid.lineTo(-L / 2, W * 1.05);
    solid.closePath();
    solid.fill();
    solid.fillStyle = "#4d5664";
    solid.fillRect(-L / 2, -W / 2, L * 0.74, W);
    solid.fillStyle = "#aab4c1";
    solid.fillRect(-L / 2, -W / 2, L * 0.74, Math.max(0.6, W * 0.22));
    solid.fillStyle = "#d63a2c"; // nose
    solid.beginPath();
    solid.moveTo(-L / 2 + L * 0.74, -W / 2);
    solid.quadraticCurveTo(L / 2, -W * 0.2, L / 2, 0);
    solid.quadraticCurveTo(L / 2, W * 0.2, -L / 2 + L * 0.74, W / 2);
    solid.closePath();
    solid.fill();
  }
  solid.restore();
  if (torpedo) {
    const bx = s.x + Math.cos(s.h) * L * 0.22;
    const by = s.y + Math.sin(s.h) * L * 0.22;
    radialGlow(light, bx, by, W * 0.9, [
      [0, "rgba(255,190,110,0.85)"],
      [0.4, "rgba(255,110,40,0.45)"],
      [1, "rgba(255,80,20,0)"],
    ]);
  }
}

const SMOKE_LIGHT: [RGB, RGB] = [[175, 180, 188], [105, 110, 118]];
const SMOKE_BURST: [RGB, RGB] = [[160, 165, 172], [95, 100, 108]];
const EJECT_GAS: [RGB, RGB] = [[200, 205, 212], [130, 136, 145]];
const SPARK: [RGB, RGB] = [[255, 236, 180], [255, 70, 20]];

/** Draws every round of a volley at `now`: bodies and smoke on `solid`, light on `light`. Exported for tests. */
export function paintVolley(
  solid: CanvasRenderingContext2D,
  light: CanvasRenderingContext2D,
  volley: MissileRound[],
  now: number,
  cellW: number,
  torpedo: boolean,
) {
  const fx = fxCellSize(cellW);
  const impactMs = torpedo ? TORPEDO_IMPACT_DURATION_MS : MISSILE_IMPACT_DURATION_MS;
  const smokeLife = torpedo ? 900 : 650;
  const fs = torpedo ? TORPEDO_FLAME_SCALE : MISSILE_FLAME_SCALE;
  const L = (torpedo ? TORPEDO_BODY : MISSILE_BODY).length * cellW;
  for (const m of volley) {
    const t = now - m.start;
    if (t < 0 || now - m.hit >= impactMs) continue;

    // Ejection: a puff of gas and a spark at the launcher.
    if (t < 420) {
      const q = t / 420;
      for (let i = 0; i < 3; i++) {
        const a = m.driftDir + (i - 1) * 0.6;
        smokePuff(
          solid,
          m.spawn.x + Math.cos(a) * fx * 0.04 * easeOutCubic(q),
          m.spawn.y + Math.sin(a) * fx * 0.04 * easeOutCubic(q),
          fx * (0.02 + 0.045 * q),
          0.32 * Math.pow(1 - q, 1.5),
          mixRgb(EJECT_GAS[0], EJECT_GAS[1], q),
        );
      }
    }
    if (t < 60) {
      const k = 1 - t / 60;
      radialGlow(light, m.spawn.x, m.spawn.y, fx * 0.04, [[0, `rgba(255,240,220,${k})`], [1, "rgba(255,160,80,0)"]]);
    }

    // The smoke trail: a puff at the nozzle every SMOKE_EVERY_MS of powered flight, gone by the hit's end.
    const ignition = m.start + MISSILE_DRIFT_MS;
    for (let te = ignition, i = 0; te <= Math.min(now, m.hit); te += SMOKE_EVERY_MS, i++) {
      const life = Math.min(smokeLife, m.hit + impactMs - te);
      const age = now - te;
      if (age < 0 || age >= life) continue;
      const s = roundState(m, te - m.start);
      const q = age / life;
      const nx = s.x - Math.cos(s.h) * L * 0.55;
      const ny = s.y - Math.sin(s.h) * L * 0.55;
      const wob = (noise(m.noiseSeed + i) - 0.5) * fx * 0.04 * q;
      smokePuff(
        solid,
        nx - Math.sin(s.h) * wob,
        ny + Math.cos(s.h) * wob,
        fx * (0.014 + (torpedo ? 0.07 : 0.05) * Math.pow(q, 0.7)),
        (torpedo ? 0.3 : 0.24) * Math.pow(1 - q, 1.5) * Math.min(1, age / 40),
        mixRgb(SMOKE_LIGHT[0], SMOKE_LIGHT[1], q),
      );
    }

    if (now < m.hit) {
      const s = roundState(m, t);
      const nozX = s.x - Math.cos(s.h) * L * 0.5;
      const nozY = s.y - Math.sin(s.h) * L * 0.5;
      if (s.flying) {
        // A hot exhaust streak just behind the flame.
        let prev: Point | null = null;
        for (let back = 0; back <= 120; back += 10) {
          const tb = t - back;
          if (tb < MISSILE_DRIFT_MS) break;
          const q = roundState(m, tb);
          const p = { x: q.x - Math.cos(q.h) * L * 0.5, y: q.y - Math.sin(q.h) * L * 0.5 };
          if (prev) strokeSegment(light, prev.x, prev.y, p.x, p.y, fx * 0.025 * fs, `rgba(255,130,50,${0.5 * Math.exp(-back / 45)})`);
          prev = p;
        }
        const flicker = 0.78 + 0.22 * Math.sin(now * 0.09 + m.index * 2.1) * Math.sin(now * 0.23 + m.index);
        const len = fx * (torpedo ? 0.26 : 0.18) * fs * flicker;
        flame(light, nozX, nozY, s.h, len, fx * (torpedo ? 0.08 : 0.06) * fs, "rgba(255,110,40,0.55)");
        flame(light, nozX, nozY, s.h, len * 0.7, fx * (torpedo ? 0.05 : 0.035) * fs, "rgba(255,210,110,0.8)");
        flame(light, nozX, nozY, s.h, len * 0.38, fx * (torpedo ? 0.022 : 0.015) * fs, "rgba(255,250,235,1)");
        radialGlow(light, nozX, nozY, fx * 0.07 * fs, [[0, "rgba(255,220,150,0.7)"], [1, "rgba(255,120,40,0)"]]);
        const ig = t - MISSILE_DRIFT_MS;
        if (ig < 90) {
          const k = (1 - ig / 90) ** 2;
          radialGlow(light, nozX, nozY, fx * (torpedo ? 0.16 : 0.12) * fs, [
            [0, `rgba(255,255,245,${k})`],
            [0.35, `rgba(255,170,80,${0.8 * k})`],
            [1, "rgba(255,90,30,0)"],
          ]);
        }
      }
      drawBody(solid, light, s, torpedo, cellW);
      continue;
    }

    // The hit.
    const e = now - m.hit;
    const { x: hx, y: hy } = m.H;
    const q01 = e / impactMs;
    radialGlow(light, hx, hy, cellW * 0.36, [[0, `rgba(255,120,50,${0.2 * Math.exp(-e / 60)})`], [1, "rgba(255,120,50,0)"]]);
    for (const pf of m.puffs) {
      const dist = (torpedo ? fx * 0.5 : fx * (0.06 + 0.06 * pf.d)) * easeOutCubic(q01);
      smokePuff(
        solid,
        hx + Math.cos(pf.ang) * dist,
        hy + Math.sin(pf.ang) * dist,
        fx * (torpedo ? 0.05 + 0.08 * q01 : 0.05 + 0.1 * q01),
        (torpedo ? 0.28 : 0.3) * Math.pow(1 - q01, 1.5) * Math.min(1, e / 60),
        mixRgb(SMOKE_BURST[0], SMOKE_BURST[1], q01),
      );
    }
    const flashMs = torpedo ? 110 : 70;
    if (e < flashMs) {
      const k = (1 - e / flashMs) ** 2;
      radialGlow(light, hx, hy, fx * (torpedo ? 0.26 : 0.14), [
        [0, `rgba(255,255,255,${k})`],
        [0.4, `rgba(255,230,170,${0.7 * k})`],
        [1, "rgba(255,160,80,0)"],
      ]);
    }
    const fireballMs = torpedo ? 600 : 400;
    if (e < fireballMs) {
      const q = e / fireballMs;
      const k = Math.pow(1 - q, 1.3);
      radialGlow(light, hx, hy, fx * (torpedo ? 0.12 + 0.2 * easeOutCubic(q) : 0.08 + 0.14 * easeOutCubic(q)), [
        [0, `rgba(255,250,230,${k})`],
        [0.25, `rgba(255,215,120,${0.9 * k})`],
        [0.55, `rgba(255,120,40,${0.6 * k})`],
        [1, "rgba(200,40,10,0)"],
      ]);
    }
    if (torpedo) {
      const eo = 1 - Math.pow(1 - q01, 2);
      const a1 = Math.max(0, 1 - q01 * 1.15);
      const w1 = Math.max(1.5, 0.11 * fx * (1 - q01));
      strokeRing(light, hx, hy, eo * 0.77 * fx, w1 * 2.4, `rgba(255,170,80,${0.18 * a1})`);
      strokeRing(light, hx, hy, eo * 0.77 * fx, w1, `rgba(255,204,102,${0.8 * a1})`);
      strokeRing(light, hx, hy, eo * 0.98 * fx, Math.max(1, 0.065 * fx * (1 - q01)), `rgba(255,119,34,${0.8 * Math.max(0, 0.85 - q01)})`);
    } else if (e < 220) {
      const q = e / 220;
      strokeRing(light, hx, hy, fx * (0.04 + 0.26 * easeOutCubic(q)), 0.5 + 1.5 * (1 - q), `rgba(255,170,90,${0.55 * (1 - q)})`);
    }
    for (const s of m.sparks) {
      if (e > s.life) continue;
      const q = e / s.life;
      const drag = 0.006;
      const reach = s.v * fx * 0.01;
      const d = (reach * (1 - Math.exp(-drag * e))) / drag;
      const d0 = (reach * (1 - Math.exp(-drag * Math.max(0, e - 18)))) / drag;
      strokeSegment(light, hx + Math.cos(s.ang) * d0, hy + Math.sin(s.ang) * d0, hx + Math.cos(s.ang) * d, hy + Math.sin(s.ang) * d, s.w, `rgba(${mixRgb(SPARK[0], SPARK[1], q)},${1 - q})`);
    }
  }
}

export const MissileShootingAnimation = React.memo(function MissileShootingAnimation({
  gridContainerRef,
  attackerRow,
  attackerCol,
  targetRow,
  targetCol,
  facingRight,
  variant = 1,
  soundOnceKey,
  once = false,
}: MissileShootingAnimationProps) {
  const soundsMuted = useWeaponSoundsMuted();
  const soundsMutedRef = useRef(soundsMuted);
  soundsMutedRef.current = soundsMuted;
  const soundOnceKeyRef = useRef(soundOnceKey);
  soundOnceKeyRef.current = soundOnceKey;
  const onceRef = useRef(once);
  onceRef.current = once;
  const solidRef = useRef<HTMLCanvasElement | null>(null);
  const lightRef = useRef<HTMLCanvasElement | null>(null);
  const torpedo = Number(variant) === 2;
  const aimRef = useRef({ attackerRow, attackerCol, targetRow, targetCol, facingRight, torpedo });
  aimRef.current = { attackerRow, attackerCol, targetRow, targetCol, facingRight, torpedo };
  /** A new attack starts a fresh volley. */
  const attackKey = `${attackerRow}-${attackerCol}-${targetRow}-${targetCol}-${facingRight ? 1 : 0}-${torpedo ? 2 : 1}`;
  const attackKeyRef = useRef(attackKey);
  attackKeyRef.current = attackKey;

  useEffect(() => {
    const grid = gridContainerRef.current;
    const solidCanvas = solidRef.current;
    const lightCanvas = lightRef.current;
    if (!grid || !solidCanvas || !lightCanvas) return;
    const reduceMotion = prefersReducedMotion();
    const solidLayer = attachOverlayCanvas(grid, solidCanvas, "normal");
    const lightLayer = attachOverlayCanvas(grid, lightCanvas, "add");

    let layout: MissileLayout | null = null;
    let layoutKey = "";
    const ro = new ResizeObserver(() => {
      layout = null;
    });
    ro.observe(grid);
    const currentLayout = () => {
      if (!layout || layoutKey !== attackKeyRef.current) {
        const a = aimRef.current;
        layout = missileLayout(grid, a.attackerRow, a.attackerCol, a.targetRow, a.targetCol, a.facingRight, a.torpedo);
        layoutKey = attackKeyRef.current;
      }
      return layout;
    };

    let volley: MissileRound[] = [];
    let volleyKey = "";
    let nextVolleyAt = -1;

    const paint = (now: number) => {
      const isTorpedo = aimRef.current.torpedo;
      if (volleyKey !== attackKeyRef.current) {
        volleyKey = attackKeyRef.current;
        const key = soundOnceKeyRef.current;
        const sounding = !soundsMutedRef.current && (key == null || takeFirstPlay(LAUNCH_PLAYED_KEY, key));
        volley = newVolley(now, currentLayout(), isTorpedo, sounding, reduceMotion);
        nextVolleyAt = onceRef.current ? -1 : Math.max(...volley.map((m) => m.hit)) + MISSILE_RESPAWN_DELAY_MS;
      } else if (nextVolleyAt >= 0 && now >= nextVolleyAt) {
        volley = newVolley(now, currentLayout(), isTorpedo, false, reduceMotion);
        nextVolleyAt = Math.max(...volley.map((m) => m.hit)) + MISSILE_RESPAWN_DELAY_MS;
      }

      const pitch = isTorpedo ? TORPEDO_PITCH : 1;
      for (const m of volley) {
        if (!m.sounding) continue;
        if (!m.played.eject && now >= m.start) {
          m.played.eject = true;
          playSoundEffect(LAUNCH_SOUND, { startAt: LAUNCH_SOUND_START_S, pitch });
        }
        if (!m.played.motor && now >= m.start + MISSILE_DRIFT_MS) {
          m.played.motor = true;
          playSoundEffect(MOTOR_SOUND, { pitch, pitchVariation: MOTOR_PITCH_VARIATION });
        }
        if (!m.played.impact && now >= m.hit) {
          m.played.impact = true;
          playSoundEffect(IMPACT_SOUND, {
            pitch: isTorpedo ? TORPEDO_IMPACT_PITCH : 1,
            volume: isTorpedo ? TORPEDO_IMPACT_VOLUME : 1,
            pitchVariation: IMPACT_PITCH_VARIATION,
          });
        }
      }

      const solid = solidLayer.begin();
      const light = lightLayer.begin();
      if (!solid || !light) return;
      paintVolley(solid, light, volley, now, currentLayout().cellW, isTorpedo);
    };

    const stopRaf = startCancelledRaf(paint);
    return () => {
      stopRaf();
      ro.disconnect();
      solidLayer.dispose();
      lightLayer.dispose();
    };
  }, [gridContainerRef]);

  return (
    <>
      <canvas ref={solidRef} className="absolute pointer-events-none z-20" style={FX_SOLID_CANVAS_STYLE} aria-hidden="true" />
      <canvas ref={lightRef} className="absolute pointer-events-none z-20" style={FX_CANVAS_STYLE} aria-hidden="true" />
    </>
  );
});
