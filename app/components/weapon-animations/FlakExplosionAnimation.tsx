"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { FLAK_MS } from "../../constants/animationTiming";
import { gridLayoutSize } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import {
  FX_CANVAS_STYLE,
  FX_SOLID_CANVAS_STYLE,
  type RGB,
  attachOverlayCanvas,
  fxCellSize,
  mixRgb,
  prefersReducedMotion,
  radialGlow,
  strokeSegment,
} from "./canvasFx";
import { playSoundEffect } from "../../hooks/useSoundEffects";
import { takeFirstPlay } from "./playOnce";
import { useWeaponSoundsMuted } from "./weaponSounds";

// The Flak Array: an area barrage over every tile in range. Every
// FLAK_TICK_MS a group of tiles bursts at once (at least six, or an eighth of
// the range), a third of them twice. Four arrays along the ship's centre line
// each cover one quadrant of the range (back, down, up, front); each shell's
// tracer streaks from its array before it bursts: a white flash, a fireball,
// shrapnel and a dark puff of smoke that hangs and drifts. Bursts on the
// sound's booms (FLAK_BOOMS_MS) are full size, the rest smaller. `once`
// (move playback) stops firing at FLAK_LAST_TICK_MS so everything is over by
// FLAK_MS; without it (the aiming preview) the barrage repeats. Smoke is
// drawn normally on one canvas, light added onto the board on another above
// it (canvasFx). Reviewed in the flak rework artifact (2026-11-06).
//
// One rolling flak barrage (flak.wav, 1.8 s) as the bursts start; a
// played-back move plays it once per move (soundOnceKey). It stops if the
// bursts go away first (after SOUND_STOP_AFTER_MS, so React's quick dev-mode
// remount doesn't cut it).
const FLAK_SOUND = "/sound/flak.wav";
const FLAK_PITCH_VARIATION = 0.05;
const FLAK_PLAYED_KEY = "vt-flak-played-v1";
const SOUND_STOP_AFTER_MS = 200;

const FLAK_TICK_MS = 90;
const FLAK_LAST_TICK_MS = 1500;
/** The booms in flak.wav; bursts within FLAK_BOOM_WINDOW_MS of one are full size. */
const FLAK_BOOMS_MS = [50, 280, 580, 820, 980, 1240];
const FLAK_BOOM_WINDOW_MS = 45;
const TRACER_MS = 70;
/** The four arrays, back to front, as fractions of the cell from the ship's centre along its axis. */
const ARRAYS = [-0.3, -0.1, 0.1, 0.3];
const ARRAY_BACK = 0;
const ARRAY_DOWN = 1;
const ARRAY_UP = 2;
const ARRAY_FRONT = 3;
/** A smaller burst's size, against a full one on a boom. */
const SMALL_BURST = 0.62;

const SMOKE: [RGB, RGB] = [[70, 62, 54], [40, 38, 36]];
const SHRAPNEL: [RGB, RGB] = [[255, 240, 190], [255, 90, 20]];

type GridCell = { row: number; col: number };

interface FlakExplosionAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  targetCells: GridCell[];
  /** The ship firing it (its arrays sit on this cell) and which way it faces. */
  attacker: GridCell;
  facingRight: boolean;
  /**
   * The move being played back: the sound plays once per key this session.
   * Omitted (aiming preview), it plays each time the bursts start.
   */
  soundOnceKey?: string;
  /** Move playback: one barrage, over by FLAK_MS. Omitted (the aiming preview), the barrage repeats. */
  once?: boolean;
}

type Shrapnel = { a: number; v: number; life: number };
export type FlakShell = { t: number; x: number; y: number; array: number; big: boolean; drift: number; shrapnel: Shrapnel[] };
export type FlakLayout = { cellW: number; cellH: number; ax: number; ay: number; face: 1 | -1 };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Which array covers a tile: by its direction from the ship, forward being the
 * way it faces. Front within 45° of straight ahead, then down, back and up;
 * tiles exactly on a diagonal go clockwise, so the four share evenly.
 */
export function flakArrayFor(attacker: GridCell, cell: GridCell, facingRight: boolean): number {
  const dx = (cell.col - attacker.col) * (facingRight ? 1 : -1);
  const dy = cell.row - attacker.row;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg >= -45 && deg < 45) return ARRAY_FRONT;
  if (deg >= 45 && deg < 135) return ARRAY_DOWN;
  if (deg >= -135 && deg < -45) return ARRAY_UP;
  return ARRAY_BACK;
}

/** One barrage's shells, from `start`. Exported for tests. */
export function planFlak(start: number, cells: GridCell[], attacker: GridCell, facingRight: boolean, cellW: number, cellH: number, reduceMotion: boolean): FlakShell[] {
  const shells: FlakShell[] = [];
  if (!cells.length) return shells;
  const perTick = Math.min(cells.length, Math.max(6, Math.ceil(cells.length / 8)));
  let order = shuffle(cells);
  let idx = 0;
  for (let t = 0; t <= FLAK_LAST_TICK_MS; t += FLAK_TICK_MS) {
    const big = FLAK_BOOMS_MS.some((b) => Math.abs(b - t) <= FLAK_BOOM_WINDOW_MS);
    for (let i = 0; i < perTick; i++) {
      if (idx >= order.length) {
        order = shuffle(cells);
        idx = 0;
      }
      const cell = order[idx++];
      const array = flakArrayFor(attacker, cell, facingRight);
      const pops = 1 + (Math.random() < 0.35 ? 1 : 0);
      for (let p = 0; p < pops; p++) {
        shells.push({
          t: start + t,
          x: (cell.col + 0.5 + (Math.random() - 0.5) * 0.5) * cellW,
          y: (cell.row + 0.5 + (Math.random() - 0.5) * 0.5) * cellH,
          array,
          big,
          drift: (Math.random() - 0.5) * 0.8,
          shrapnel: Array.from({ length: reduceMotion ? 3 : big ? 6 : 4 }, () => ({
            a: Math.random() * Math.PI * 2,
            v: 0.7 + Math.random() * 0.6,
            life: 160 + Math.random() * 120,
          })),
        });
      }
    }
  }
  return shells;
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

/** Draws the barrage at `now`: smoke on `solid`, light on `light`. `endAt`: when everything must be gone (Infinity in the preview). Exported for tests. */
export function paintFlak(solid: CanvasRenderingContext2D, light: CanvasRenderingContext2D, shells: FlakShell[], now: number, layout: FlakLayout, endAt: number) {
  if (now >= endAt) return;
  const fx = fxCellSize(layout.cellW);
  const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
  for (const s of shells) {
    const age = now - s.t;
    const fire = s.t - TRACER_MS;
    if (now < fire || age > 800) continue;
    const gx = layout.ax + layout.face * ARRAYS[s.array] * layout.cellW;
    const gy = layout.ay;
    // The tracer: from its array to the burst.
    if (now < s.t + 30) {
      const u = Math.min(1, (now - fire) / TRACER_MS);
      const tu = Math.max(0, u - 0.35);
      const k = now < s.t ? 1 : 1 - (now - s.t) / 30;
      strokeSegment(light, gx + (s.x - gx) * tu, gy + (s.y - gy) * tu, gx + (s.x - gx) * u, gy + (s.y - gy) * u, s.big ? 1.3 : 0.9, `rgba(255,220,150,${0.7 * k})`);
      if (u < 0.25) radialGlow(light, gx, gy, fx * 0.04, [[0, `rgba(255,235,190,${0.8 * (1 - u / 0.25)})`], [1, "rgba(255,150,60,0)"]]);
    }
    if (age < 0) continue;
    const sc = s.big ? 1 : SMALL_BURST;
    // Smoke: a dark puff that hangs and drifts, gone by endAt.
    const life = Math.min(600 * sc + 120, endAt - s.t);
    if (age < life) {
      const q = age / life;
      smokePuff(solid, s.x + s.drift * fx * 0.04 * q, s.y - fx * 0.02 * q, fx * (0.04 + 0.07 * easeOut(q)) * sc, 0.38 * Math.pow(1 - q, 1.3) * Math.min(1, age / 50), mixRgb(SMOKE[0], SMOKE[1], q));
    }
    // The flash and the fireball.
    if (age < 90) {
      const k = (1 - age / 90) ** 2;
      radialGlow(light, s.x, s.y, fx * 0.07 * sc, [[0, `rgba(255,255,240,${k})`], [0.35, `rgba(255,230,150,${0.8 * k})`], [1, "rgba(255,160,60,0)"]]);
    }
    if (age < 260) {
      const q = age / 260;
      const k = Math.pow(1 - q, 1.4);
      radialGlow(light, s.x, s.y, fx * (0.04 + 0.05 * easeOut(q)) * sc, [[0, `rgba(255,220,130,${0.9 * k})`], [0.5, `rgba(255,120,30,${0.55 * k})`], [1, "rgba(200,40,10,0)"]]);
    }
    // Shrapnel.
    for (const sh of s.shrapnel) {
      if (age > sh.life) continue;
      const q = age / sh.life;
      const d = fx * 0.09 * sh.v * easeOut(q) * sc;
      const d0 = Math.max(0, d - fx * 0.025);
      strokeSegment(light, s.x + Math.cos(sh.a) * d0, s.y + Math.sin(sh.a) * d0, s.x + Math.cos(sh.a) * d, s.y + Math.sin(sh.a) * d, 0.8, `rgba(${mixRgb(SHRAPNEL[0], SHRAPNEL[1], q)},${1 - q})`);
    }
  }
}

function sameCells(a: GridCell[], b: GridCell[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].row !== b[i].row || a[i].col !== b[i].col) return false;
  }
  return true;
}

export const FlakExplosionAnimation = React.memo(function FlakExplosionAnimation({
  gridContainerRef,
  targetCells,
  attacker,
  facingRight,
  soundOnceKey,
  once = false,
}: FlakExplosionAnimationProps) {
  const soundsMuted = useWeaponSoundsMuted();
  const soundOnceKeyRef = useRef(soundOnceKey);
  const soundsMutedRef = useRef(soundsMuted);
  useEffect(() => {
    const key = soundOnceKeyRef.current;
    if (soundsMutedRef.current || (key != null && !takeFirstPlay(FLAK_PLAYED_KEY, key))) return;
    const audio = playSoundEffect(FLAK_SOUND, { pitchVariation: FLAK_PITCH_VARIATION });
    const startedAt = Date.now();
    return () => {
      if (audio && Date.now() - startedAt > SOUND_STOP_AFTER_MS) audio.pause();
    };
  }, []);

  const cellsKey = targetCells.map((c) => `${c.row},${c.col}`).join(";");
  const uniqueCells = useMemo(() => {
    const seen = new Set<string>();
    const out: GridCell[] = [];
    for (const c of targetCells) {
      const key = `${c.row}:${c.col}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(c);
      }
    }
    return out;
    // Callers often pass a freshly allocated targetCells array with the same
    // tiles (last-move replay). Key off contents so the barrage isn't replanned
    // on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellsKey]);
  const aimRef = useRef({ cells: uniqueCells, attacker, facingRight, once });
  aimRef.current = { cells: uniqueCells, attacker, facingRight, once };
  const planKey = `${cellsKey}|${attacker.row},${attacker.col}|${facingRight ? 1 : 0}`;
  const planKeyRef = useRef(planKey);
  planKeyRef.current = planKey;
  const solidRef = useRef<HTMLCanvasElement | null>(null);
  const lightRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const grid = gridContainerRef.current;
    const solidCanvas = solidRef.current;
    const lightCanvas = lightRef.current;
    if (!grid || !solidCanvas || !lightCanvas) return;
    const reduceMotion = prefersReducedMotion();
    const solidLayer = attachOverlayCanvas(grid, solidCanvas, "normal");
    const lightLayer = attachOverlayCanvas(grid, lightCanvas, "add");
    let layout: FlakLayout | null = null;
    const ro = new ResizeObserver(() => {
      layout = null;
    });
    ro.observe(grid);

    let shells: FlakShell[] = [];
    let shellsKey = "";
    let barrageStart = 0;
    let endAt = Infinity;

    const paint = (now: number) => {
      const a = aimRef.current;
      if (!layout || shellsKey !== planKeyRef.current) {
        const { cellWidth, cellHeight } = gridLayoutSize(grid);
        layout = {
          cellW: cellWidth,
          cellH: cellHeight,
          ax: (a.attacker.col + 0.5) * cellWidth,
          ay: (a.attacker.row + 0.5) * cellHeight,
          face: a.facingRight ? 1 : -1,
        };
      }
      if (shellsKey !== planKeyRef.current) {
        shellsKey = planKeyRef.current;
        barrageStart = now;
        shells = planFlak(now, a.cells, a.attacker, a.facingRight, layout.cellW, layout.cellH, reduceMotion);
        endAt = a.once ? now + FLAK_MS : Infinity;
      } else if (!a.once && now - barrageStart >= FLAK_MS) {
        // The aiming preview repeats the barrage.
        barrageStart = now;
        shells = planFlak(now, a.cells, a.attacker, a.facingRight, layout.cellW, layout.cellH, reduceMotion);
      }
      const solid = solidLayer.begin();
      const light = lightLayer.begin();
      if (!solid || !light) return;
      paintFlak(solid, light, shells, now, layout, endAt);
    };

    const stopRaf = startCancelledRaf(paint);
    return () => {
      stopRaf();
      ro.disconnect();
      solidLayer.dispose();
      lightLayer.dispose();
    };
  }, [gridContainerRef]);

  if (uniqueCells.length === 0) return null;

  return (
    <>
      <canvas ref={solidRef} className="absolute pointer-events-none z-60" style={FX_SOLID_CANVAS_STYLE} aria-hidden="true" />
      <canvas ref={lightRef} className="absolute pointer-events-none z-60" style={FX_CANVAS_STYLE} aria-hidden="true" />
    </>
  );
}, (prev, next) =>
  prev.gridContainerRef === next.gridContainerRef &&
  sameCells(prev.targetCells, next.targetCells) &&
  prev.attacker.row === next.attacker.row &&
  prev.attacker.col === next.attacker.col &&
  prev.facingRight === next.facingRight &&
  prev.once === next.once &&
  prev.soundOnceKey === next.soundOnceKey,
);
