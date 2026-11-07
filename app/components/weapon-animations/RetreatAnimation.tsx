"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GridShip } from "../../types/gridDisplay";
import { GridShipImage } from "../GridShipImage";
import { SosHullFires } from "../SosHullFires";
import { sosDriftAt } from "../sosState";
import { playSoundEffect } from "../../hooks/useSoundEffects";
import { RETREAT_MS } from "../../constants/animationTiming";
import { takeFirstPlay } from "./playOnce";
import { useWeaponSoundsMuted } from "./weaponSounds";
import { cellCenterOnGrid, gridLayoutSize } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import { attachOverlayCanvas, FX_CANVAS_STYLE, fxCellSize, prefersReducedMotion, radialGlow, strokeRing, strokeSegment } from "./canvasFx";

// A Retreat as it plays back (MovePlaybackLayer), timed to its sound
// (warp-collapse.wav: it builds for 1.7 s, implodes and rings off). Only a
// disabled ship retreats, so it starts as its cell draws one: tilted, its
// hull fires burning. It turns to face its own side; its damaged drive
// coughs and catches, it levels out, sparks shake off the hull, and a warp
// field winds up round it. On the implosion it jumps, stretching and
// accelerating toward its own side with afterimages and a streak, and the
// field closes behind it in a flash, a flare and a ring; a few motes drift
// off as the sound rings out. The board hides the ship meanwhile
// (playbackHiddenShipIds) and this draws it, with its own ship image and
// SosHullFires (so the fires go with it); the light is a canvas added on top.

/** The turn to face its own side. */
export const RETREAT_TURN_MS = 260;
/** The jump to warp (the field closes on the sound's implosion, 50 ms later). */
export const RETREAT_JUMP_MS = 1650;
const IMPLODE_MS = 1700;
const GONE_MS = RETREAT_JUMP_MS + 180;
/** The last of the residue is gone. */
export const RETREAT_END_MS = 2450;
/** The drive coughs until it catches here. */
const CATCH_MS = 900;
/** How far it jumps, in cells. */
const JUMP_CELLS = 4.5;
// Points on the hull the sparks shake off (fractions of a cell from its centre, the art facing left).
const HULL_PTS: Array<[number, number]> = [[-0.3, -0.05], [-0.1, 0.08], [0.12, -0.1], [0.28, 0.05], [0.02, 0], [-0.38, 0.1]];

const COLLAPSE_SOUND = "/sound/warp-collapse.wav";
const COLLAPSE_PLAYED_KEY = "vt-warp-collapse-played-v1";
/** The sound stops if the retreat goes away first (after this, so React's quick dev-mode remount doesn't cut it). */
const SOUND_STOP_AFTER_MS = 200;

const HOT = "255,250,240";
const CYAN = "130,215,255";
const BLUE = "120,170,255";
const LILAC = "175,160,255";

/**
 * The retreating ship's cell centre (layout px), the board's cell, its side
 * (a creator ship faces right and flees left), and its disabled pose as the
 * board has it when the retreat starts (sosDriftAt: tilt in radians, bob as
 * a fraction of the cell).
 */
export type RetreatLayout = { x: number; y: number; cell: number; creator: boolean; tilt: number; bob: number };
export type RetreatPose = { x: number; y: number; sx: number; sy: number; rot: number; alpha: number; dir: number };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The ship `t` ms in: turning, levelling out of its tilt as it spools, trembling, then jumping to warp. `sx` < 0: mirrored. */
export function retreatPose(t: number, L: RetreatLayout, reduced: boolean): RetreatPose {
  const face = L.creator ? -1 : 1; // as the board draws it: a creator ship mirrored
  const dir = L.creator ? -1 : 1; // it flees to its own side
  let sx = -face;
  let sy = 1;
  let x = L.x;
  let y = L.y + L.bob * L.cell;
  let alpha = 1;
  let rot = L.tilt;
  if (t < RETREAT_TURN_MS) {
    if (reduced) sx = t < RETREAT_TURN_MS / 2 ? face : -face;
    else {
      sx = face * Math.cos(Math.PI * easeInOut(Math.max(0, t) / RETREAT_TURN_MS));
      if (Math.abs(sx) < 0.04) sx = 0.04 * (Math.sign(sx) || -face);
    }
  }
  if (t > 400) {
    const p = clamp((t - 400) / 900, 0, 1);
    const level = easeInOut(p);
    rot = L.tilt * (1 - level) + (reduced ? 0 : Math.sin(t * 0.02) * 0.05 * Math.sin(Math.PI * p));
    y = L.y + L.bob * L.cell * (1 - level);
  }
  if (!reduced && t >= RETREAT_TURN_MS && t < RETREAT_JUMP_MS) {
    const k = (t - RETREAT_TURN_MS) / (RETREAT_JUMP_MS - RETREAT_TURN_MS);
    const a = L.cell * (0.005 + 0.012 * k * k);
    x += (hash(Math.floor(t / 33)) - 0.5) * 2 * a;
    y += (hash(Math.floor(t / 33) + 7) - 0.5) * 2 * a;
  }
  if (t >= RETREAT_JUMP_MS) {
    const q = Math.min(1, (t - RETREAT_JUMP_MS) / (GONE_MS - RETREAT_JUMP_MS));
    if (reduced) alpha = 1 - q;
    else {
      x += dir * L.cell * JUMP_CELLS * q * q * q;
      sx *= 1 + 2.5 * q;
      sy = 1 - 0.35 * q;
      alpha = q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4;
    }
  }
  return { x, y, sx, sy, rot, alpha, dir };
}

/** When each afterimage is drawn from (it trails the ship's jump), or null when it isn't drawn. */
export function afterimageAt(t: number, i: number, reduced: boolean): number | null {
  const lag = [0.12, 0.24, 0.36][i] * (GONE_MS - RETREAT_JUMP_MS);
  return !reduced && t - lag > RETREAT_JUMP_MS && t - lag < GONE_MS ? t - lag : null;
}
export const AFTERIMAGE_ALPHA = [0.35, 0.2, 0.1];

function hullPoint(i: number, P: RetreatPose, cell: number): [number, number] {
  const lx = HULL_PTS[i][0] * cell * Math.abs(P.sx);
  const ly = HULL_PTS[i][1] * cell * P.sy;
  return [P.x + lx * Math.cos(P.rot) - ly * Math.sin(P.rot), P.y + lx * Math.sin(P.rot) + ly * Math.cos(P.rot)];
}

/** The retreat's light, `t` ms in (additive): the warp field, the plume, sparks, the jump's streak, the implosion and its residue. */
export function paintRetreat(ctx: CanvasRenderingContext2D, t: number, L: RetreatLayout, seed: number, reduced: boolean) {
  if (t < 0 || t >= RETREAT_END_MS) return;
  const { cell: c, x: cx, y: cy } = L;
  const fx = fxCellSize(c);
  const P = retreatPose(t, L, reduced);
  const dir = P.dir;

  // The warp field: three arms spiralling round the ship, tightening and speeding up as the sound builds, closing on the jump.
  if (t < IMPLODE_MS) {
    const k = clamp((t - 120) / (RETREAT_JUMP_MS - 120), 0, 1);
    const close = t > RETREAT_JUMP_MS ? (t - RETREAT_JUMP_MS) / (IMPLODE_MS - RETREAT_JUMP_MS) : 0;
    const outer = c * (1.25 - 0.45 * k) * (1 - close);
    const inner = c * (0.3 - 0.1 * k) * (1 - close);
    const spin = 0.0025 * t + 0.0000021 * t * t;
    const a = (0.15 + 0.6 * k) * (t < 200 ? t / 200 : 1);
    radialGlow(ctx, cx, cy, c * (0.95 - 0.3 * k) * (1 - close * 0.6) + 0.5, [
      [0, `rgba(${BLUE},${0.05 + 0.22 * k})`],
      [1, `rgba(${BLUE},0)`],
    ]);
    for (let arm = 0; arm < 3; arm++) {
      let px = 0;
      let py = 0;
      for (let i = 0; i <= 22; i++) {
        const u = i / 22;
        const r = lerp(outer, inner, u);
        const th = spin + (arm * Math.PI * 2) / 3 + u * 2.4;
        const x = cx + Math.cos(th) * r;
        const y = cy + Math.sin(th) * r * 0.62;
        if (i > 0) strokeSegment(ctx, px, py, x, y, fx * (0.004 + 0.006 * u), `rgba(${u > 0.6 ? CYAN : LILAC},${a * Math.sin(Math.PI * u)})`);
        px = x;
        py = y;
      }
    }
    // Motes drawn in along the arms.
    if (!reduced) {
      for (let i = 0; i < 12; i++) {
        const per = 520 + hash(seed + i) * 260;
        const ph = ((t + hash(seed + i * 3) * per) % per) / per;
        const r = lerp(c * 1.3, c * 0.15, ph * ph) * (1 - close);
        const th = hash(seed + i * 7) * 6.28 + spin * 1.3 + ph * 2.2;
        radialGlow(ctx, cx + Math.cos(th) * r, cy + Math.sin(th) * r * 0.62, c * 0.035 + 0.3, [
          [0, `rgba(${HOT},${0.7 * k * Math.sin(Math.PI * ph)})`],
          [1, `rgba(${CYAN},0)`],
        ]);
      }
    }
  }

  // Engines: a plume off the stern, coughing until the drive catches, building through the spool, doubled on the jump.
  if (t >= RETREAT_TURN_MS * 0.6 && t < GONE_MS) {
    const k = t < RETREAT_JUMP_MS ? clamp((t - RETREAT_TURN_MS * 0.6) / (RETREAT_JUMP_MS - RETREAT_TURN_MS * 0.6), 0, 1) : 1;
    const catches =
      t >= CATCH_MS || reduced
        ? 1
        : hash(seed * 3 + Math.floor(t / 55)) < 0.35 + 0.65 * clamp((t - RETREAT_TURN_MS) / (CATCH_MS - RETREAT_TURN_MS), 0, 1)
          ? 1
          : 0.12;
    const fl = (0.25 + 0.75 * k) * (0.85 + 0.15 * hash(seed + Math.floor(t / 40))) * P.alpha * catches;
    const cr = Math.cos(P.rot);
    const sr = Math.sin(P.rot);
    const lx = -dir * c * 0.42 * Math.abs(P.sx);
    const ly = -c * 0.02;
    const sx = P.x + lx * cr - ly * sr;
    const sy = P.y + lx * sr + ly * cr;
    const len = c * (0.15 + 0.5 * k) * (t >= RETREAT_JUMP_MS ? 2 : 1);
    const ex = sx - dir * len * cr;
    const ey = sy - dir * len * sr;
    const plume = (w: number, a: number, col: string) => {
      const g = ctx.createLinearGradient(sx, sy, ex, ey);
      g.addColorStop(0, `rgba(${col},${a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    };
    plume(c * 0.2 * (0.6 + 0.4 * fl), 0.3 * fl, CYAN);
    plume(c * 0.08 * (0.6 + 0.4 * fl), 0.75 * fl, CYAN);
    plume(c * 0.03 + 0.3, 0.9 * fl, HOT);
    radialGlow(ctx, sx, sy, c * 0.12 * (0.6 + 0.4 * fl), [
      [0, `rgba(${HOT},${0.8 * fl})`],
      [0.4, `rgba(${CYAN},${0.5 * fl})`],
      [1, `rgba(${CYAN},0)`],
    ]);
  }

  // Sparks shaken off the burning hull while it spools.
  if (!reduced && t >= RETREAT_TURN_MS && t < RETREAT_JUMP_MS + 460) {
    for (let te = Math.max(RETREAT_TURN_MS, Math.ceil((t - 400) / 90) * 90); te <= Math.min(t, RETREAT_JUMP_MS); te += 90) {
      const id = seed * 7 + te;
      const age = t - te;
      const life = 250 + hash(id) * 150;
      if (age >= life) continue;
      const q = age / life;
      const [x0, y0] = hullPoint(Math.floor(hash(id + 1) * HULL_PTS.length), retreatPose(te, L, reduced), c);
      const ang = -Math.PI / 2 + (hash(id + 2) - 0.5) * 2.4;
      const v = c * (0.002 + hash(id + 3) * 0.003);
      const px = x0 + Math.cos(ang) * v * age;
      const py = y0 + Math.sin(ang) * v * age + c * 0.000002 * age * age;
      strokeSegment(ctx, px, py, px - Math.cos(ang) * c * 0.06, py - Math.sin(ang) * c * 0.06, Math.max(0.5, c * 0.014), `rgba(${q < 0.4 ? HOT : "255,170,70"},${1 - q})`);
    }
  }

  // The jump's streak along its path, lingering and narrowing, and a pinpoint where it enters the warp.
  if (!reduced && t >= RETREAT_JUMP_MS) {
    const q = Math.min(1, (t - RETREAT_JUMP_MS) / (GONE_MS - RETREAT_JUMP_MS));
    const head = cx + dir * c * JUMP_CELLS * q * q * q;
    const fade = t < GONE_MS ? 1 : Math.max(0, 1 - (t - GONE_MS) / 600);
    const w = c * (0.07 * fade + 0.01);
    if (fade > 0) {
      strokeSegment(ctx, cx, cy, head, cy, w * 2.4, `rgba(${BLUE},${0.22 * fade})`);
      strokeSegment(ctx, cx, cy, head, cy, w, `rgba(${CYAN},${0.7 * fade})`);
      strokeSegment(ctx, cx, cy, head, cy, Math.max(0.5, w * 0.3), `rgba(${HOT},${0.9 * fade})`);
    }
    if (t >= GONE_MS - 40 && t < GONE_MS + 160) {
      const e = (t - GONE_MS + 40) / 200;
      radialGlow(ctx, cx + dir * c * JUMP_CELLS, cy, fx * (0.05 + 0.05 * e), [
        [0, `rgba(${HOT},${0.9 * (1 - e)})`],
        [0.4, `rgba(${CYAN},${0.5 * (1 - e)})`],
        [1, `rgba(${CYAN},0)`],
      ]);
    }
  }

  // The implosion, where the field closes: a white flash, a horizontal flare, a ring thrown out; then the residue.
  const e = t - IMPLODE_MS;
  if (e < 0) return;
  if (e < 320) {
    const k = Math.pow(1 - e / 320, 1.6);
    radialGlow(ctx, cx, cy, fx * (0.12 + 0.22 * easeOut(e / 320)), [
      [0, `rgba(255,255,255,${k})`],
      [0.3, `rgba(${CYAN},${0.7 * k})`],
      [1, `rgba(${BLUE},0)`],
    ]);
  }
  if (e < 260) {
    const k = 1 - e / 260;
    const half = c * (0.6 + easeOut(e / 260));
    strokeSegment(ctx, cx - half, cy, cx + half, cy, fx * 0.02 * k + 0.3, `rgba(${CYAN},${0.6 * k})`);
    strokeSegment(ctx, cx - half * 0.7, cy, cx + half * 0.7, cy, fx * 0.006 * k + 0.2, `rgba(${HOT},${0.9 * k})`);
  }
  if (e < 520) {
    const q = e / 520;
    strokeRing(ctx, cx, cy, c * (0.1 + 1.5 * easeOut(q)), fx * 0.012 * (1 - q) + 0.3, `rgba(${CYAN},${0.65 * (1 - q)})`);
  }
  const motes = reduced ? 4 : 9;
  for (let i = 0; i < motes; i++) {
    const life = 500 + hash(seed + i * 5) * (RETREAT_END_MS - IMPLODE_MS - 500);
    if (e >= life) continue;
    const q = e / life;
    const ang = hash(seed + i * 11) * 6.28;
    const r = c * (0.15 + 0.6 * easeOut(q) * (0.5 + hash(seed + i * 13)));
    const tw = 0.6 + 0.4 * Math.sin(e * 0.03 + i * 2);
    radialGlow(ctx, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.62, c * 0.03 + 0.3, [
      [0, `rgba(${HOT},${0.8 * (1 - q) * tw})`],
      [1, `rgba(${CYAN},0)`],
    ]);
  }
  const q = e / (RETREAT_END_MS - IMPLODE_MS);
  radialGlow(ctx, cx, cy, c * 0.4, [
    [0, `rgba(${BLUE},${0.18 * (1 - q)})`],
    [1, `rgba(${BLUE},0)`],
  ]);
}

interface RetreatAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  row: number;
  col: number;
  ship: GridShip;
  /** Creator ships face right on the board and flee left. */
  isCreator: boolean;
  /** The retreat being shown: the sound plays once per key this session. */
  soundOnceKey: string;
}

type Measured = { width: number; height: number; cellWidth: number; cellHeight: number; layout: RetreatLayout };

export const RetreatAnimation = React.memo(function RetreatAnimation({
  gridContainerRef,
  row,
  col,
  ship,
  isCreator,
  soundOnceKey,
}: RetreatAnimationProps) {
  const soundsMuted = useWeaponSoundsMuted();
  const [measured, setMeasured] = useState<Measured | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shipRef = useRef<HTMLDivElement | null>(null);
  const ghostRefs = useRef<Array<HTMLDivElement | null>>([]);
  const startedAtRef = useRef<number | null>(null);
  const soundOnceKeyRef = useRef(soundOnceKey);
  const soundsMutedRef = useRef(soundsMuted);

  // The sound as the retreat starts.
  useEffect(() => {
    if (soundsMutedRef.current || !takeFirstPlay(COLLAPSE_PLAYED_KEY, soundOnceKeyRef.current)) return;
    const audio = playSoundEffect(COLLAPSE_SOUND);
    const startedAt = Date.now();
    return () => {
      if (audio && Date.now() - startedAt > SOUND_STOP_AFTER_MS) audio.pause();
    };
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const el = gridContainerRef.current;
      if (!el) return;
      const { width, height, cellWidth, cellHeight } = gridLayoutSize(el);
      const centre = cellCenterOnGrid(el, row, col);
      // Its disabled pose on the board right now (it sways on a shared clock).
      const drift = prefersReducedMotion() ? { rot: (15 * Math.PI) / 180, dy: 0 } : sosDriftAt();
      setMeasured({
        width,
        height,
        cellWidth,
        cellHeight,
        layout: {
          x: centre.x,
          y: centre.y,
          cell: Math.min(cellWidth, cellHeight),
          creator: isCreator,
          tilt: drift.rot,
          bob: drift.dy * (cellHeight / Math.min(cellWidth, cellHeight)),
        },
      });
    };
    measure();
    const el = gridContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridContainerRef, row, col, isCreator]);

  // Draw the ship and the light every frame, from the first one (before the browser paints).
  useLayoutEffect(() => {
    const grid = gridContainerRef.current;
    const canvas = canvasRef.current;
    if (!grid || !canvas || !measured) return;
    const surface = attachOverlayCanvas(grid, canvas, "add");
    const reduced = prefersReducedMotion();
    const seed = Math.floor(Math.random() * 1000);
    const { layout: L, cellWidth, cellHeight } = measured;
    if (startedAtRef.current == null) startedAtRef.current = performance.now();
    const place = (node: HTMLDivElement | null | undefined, P: RetreatPose | null, alpha: number) => {
      if (!node) return;
      if (!P || alpha <= 0) {
        node.style.opacity = "0";
        return;
      }
      node.style.transform = `translate(${P.x - cellWidth / 2}px, ${P.y - cellHeight / 2}px) rotate(${P.rot}rad) scale(${P.sx}, ${P.sy})`;
      node.style.opacity = String(alpha);
    };
    const paint = (now: number) => {
      const t = Math.min(RETREAT_MS, now - (startedAtRef.current ?? now));
      const P = retreatPose(t, L, reduced);
      place(shipRef.current, P, P.alpha);
      for (let i = 0; i < 3; i++) {
        const at = afterimageAt(t, i, reduced);
        const G = at == null ? null : retreatPose(at, L, reduced);
        place(ghostRefs.current[i], G, G ? G.alpha * AFTERIMAGE_ALPHA[i] : 0);
      }
      const ctx = surface.begin();
      if (ctx) paintRetreat(ctx, t, L, seed, reduced);
    };
    paint(performance.now());
    return startCancelledRaf(paint);
  }, [gridContainerRef, measured]);

  const cellBox = measured ? { width: measured.cellWidth, height: measured.cellHeight } : { width: 0, height: 0 };
  return (
    <div
      className="absolute pointer-events-none z-30 overflow-visible"
      style={{ left: 0, top: 0, width: measured?.width ?? 0, height: measured?.height ?? 0 }}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          ref={(el) => {
            ghostRefs.current[i] = el;
          }}
          className="absolute left-0 top-0 origin-center"
          style={{ ...cellBox, opacity: 0, willChange: "transform" }}
        >
          <GridShipImage ship={ship} className="h-full w-full" showLoadingState={false} hideRankStars />
        </div>
      ))}
      {/* The ship as its cell draws a disabled one (the art unmirrored inside; the pose mirrors it), with its hull fires. */}
      <div ref={shipRef} className="absolute left-0 top-0 origin-center" style={{ ...cellBox, willChange: "transform" }}>
        <div className="relative h-full w-full">
          <GridShipImage ship={ship} className="relative h-full w-full" showLoadingState={false} hideRankStars />
          <SosHullFires shipId={ship.id} failing />
        </div>
      </div>
      <canvas ref={canvasRef} style={FX_CANVAS_STYLE} />
    </div>
  );
});
