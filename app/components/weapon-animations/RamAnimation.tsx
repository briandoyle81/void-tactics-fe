"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GridShip } from "../../types/gridDisplay";
import { GridShipImage } from "../GridShipImage";
import { SosHullFires } from "../SosHullFires";
import { sosDriftAt } from "../sosState";
import { playSoundEffect } from "../../hooks/useSoundEffects";
import { RAM_HIT_MS } from "../../constants/animationTiming";
import { takeFirstPlay } from "./playOnce";
import { useWeaponSoundsMuted } from "./weaponSounds";
import { cellCenterOnGrid, gridLayoutSize } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import { attachOverlayCanvas, FX_CANVAS_STYLE, fxCellSize, prefersReducedMotion, radialGlow, strokeRing, strokeSegment } from "./canvasFx";

// A Ram (variant 1's FactionAbility) as it plays back (MovePlaybackLayer).
// The rammer has slid to the tile it rams from (the move's `ramFrom`); now
// it backs off a little while its engines and a ram field on its leading
// hull build, charges into its disabled victim, and on the hit (the crash
// and a board shake) shoves through onto the victim's tile. The victim is
// knocked on along the charge from its disabled pose, still burning,
// spinning and shedding embers, and blinks out as it leaves the board (it
// fled, it wasn't destroyed). While it plays, the board hides both ships
// (playbackHiddenShipIds) and this draws them, each with its own ship image
// set up as its cell draws it; the light is a canvas added on top.
// CombatCinematic's charge uses the same rammer motion and light
// (rammerAt, paintRamLight) with its own timing.

/** A ram's motion: back off, charge to the hit, shove through. */
export type RamTiming = { windupMs: number; chargeMs: number; followMs: number };
/** On the board: the hit at RAM_HIT_MS, the rammer on its new tile 360 ms later. */
export const BOARD_RAM_TIMING: RamTiming = { windupMs: 240, chargeMs: RAM_HIT_MS - 240, followMs: 360 };
/** The victim is knocked off the board over this long from the hit. */
export const RAM_KNOCK_MS = 800;
const PLAYED_KEY = "vt-ram-played-v1";
/** How far the rammer backs off before it charges, in cells. */
const BACK_OFF = 0.18;

/** The ram's crash sound, once per ram (shared with the cinematic, so a ram crashes once whichever way it plays). */
export function playRamCrash(playKey: string, muted: boolean): boolean {
  if (!takeFirstPlay(PLAYED_KEY, playKey)) return false;
  if (!muted) playSoundEffect("/sound/crash.mp3");
  return true;
}

type Pt = { x: number; y: number };
/**
 * The rammer's cell centre before it charges and its victim's (layout px),
 * the board's cell, which way the rammer faces, and the victim's disabled
 * pose as the board has it when the ram starts (sosDriftAt: its tilt in
 * radians, its bob as a fraction of the cell).
 */
export type RamLayout = { from: Pt; to: Pt; cell: number; facingRight: boolean; victimTilt: number; victimBob: number };
export type ShipPose = { x: number; y: number; rot: number; scale: number; alpha: number };

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function geometry(L: RamLayout) {
  const dx = L.to.x - L.from.x;
  const dy = L.to.y - L.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const d: [number, number] = [dx / len, dy / len];
  const dist = len / L.cell;
  // Ships fill their cells' width and about half their height: where the hulls meet, in cells from `from`.
  const contact = Math.max(0, dist - (Math.abs(d[0]) * 0.92 + Math.abs(d[1]) * 0.5));
  // How far the leading hull is ahead of a ship's centre.
  const reach = Math.abs(d[0]) * 0.46 + Math.abs(d[1]) * 0.25;
  return { d, n: [-d[1], d[0]] as [number, number], dist, contact, reach, side: d[0] >= 0 ? 1 : -1 };
}

/** The rammer's offset toward its victim, in cells, `f` ms into the ram. */
function rammerOffset(f: number, contact: number, dist: number, T: RamTiming, reduced: boolean) {
  const hit = T.windupMs + T.chargeMs;
  if (f >= hit + T.followMs) return dist;
  if (f >= hit) return contact + (dist - contact) * easeOut((f - hit) / T.followMs);
  if (reduced) return contact * Math.max(0, f / hit);
  if (f < T.windupMs) return -BACK_OFF * easeOut(Math.max(0, f) / T.windupMs);
  const p = (f - T.windupMs) / T.chargeMs;
  return -BACK_OFF + (contact + BACK_OFF) * p * p;
}

/** Where the rammer's centre is, `f` ms into the ram. */
export function rammerAt(f: number, L: RamLayout, T: RamTiming, reduced: boolean): Pt {
  const g = geometry(L);
  const s = rammerOffset(f, g.contact, g.dist, T, reduced) * L.cell;
  return { x: L.from.x + g.d[0] * s, y: L.from.y + g.d[1] * s };
}

/** The victim: in its disabled pose until the hit, then knocked on along the charge; null once it's gone. */
export function victimAt(f: number, L: RamLayout, T: RamTiming, reduced: boolean): ShipPose | null {
  const hit = T.windupMs + T.chargeMs;
  const y0 = L.to.y + L.victimBob * L.cell;
  if (f < hit) return { x: L.to.x, y: y0, rot: L.victimTilt, scale: 1, alpha: 1 };
  const q = (f - hit) / RAM_KNOCK_MS;
  if (q >= 1) return null;
  const { d, n, side } = geometry(L);
  const travel = 2.4 * easeOut(q);
  const aside = 0.3 * Math.pow(q, 1.5) * side;
  return {
    x: L.to.x + (d[0] * travel + n[0] * aside) * L.cell,
    y: y0 + (d[1] * travel + n[1] * aside) * L.cell,
    rot: L.victimTilt + (reduced ? 0 : side * easeOut(q) * Math.PI * 2.1),
    scale: 1 - 0.55 * q,
    alpha: q < 0.55 ? 1 : 1 - (q - 0.55) / 0.45,
  };
}

const HOT = "255,250,235";
const CYAN = "120,210,255";
const GOLD = "255,214,130";
const ORANGE = "255,140,50";

/**
 * The ram's light, `f` ms in (additive): the engine plume, the ram field, speed
 * lines, and from the hit a flash, a shock ring, sparks and hull chips. With
 * `withVictim`, also the embers off the tumbling victim and its blink as it goes.
 */
export function paintRamLight(
  ctx: CanvasRenderingContext2D,
  f: number,
  L: RamLayout,
  T: RamTiming,
  seed: number,
  reduced: boolean,
  withVictim: boolean,
) {
  const { cell } = L;
  const fx = fxCellSize(cell);
  const g = geometry(L);
  const { d, n } = g;
  const hit = T.windupMs + T.chargeMs;
  const end = hit + T.followMs;
  const R = rammerAt(f, L, T, reduced);
  const facing = L.facingRight ? 1 : -1;
  const e = f - hit;

  if (withVictim) {
    // Embers shed by the tumbling victim.
    for (let te = hit; te <= Math.min(f, hit + 600); te += 25) {
      const age = f - te;
      if (age >= 280) continue;
      const p = victimAt(te, L, T, reduced);
      if (!p) continue;
      const id = seed * 31 + te;
      const k = 1 - age / 280;
      const off = (hash(id) - 0.5) * cell * 0.4 * p.scale + (hash(id + 1) - 0.5) * cell * 0.0016 * age;
      radialGlow(ctx, p.x + n[0] * off, p.y + n[1] * off, cell * 0.035 * k + 0.4, [
        [0, `rgba(${GOLD},${0.85 * k * p.alpha})`],
        [1, `rgba(${ORANGE},0)`],
      ]);
    }
  }

  // Engines: a plume off the stern, building through the back-off, full on the charge, dying as it shoves through.
  const I =
    f < T.windupMs
      ? 0.35 + 0.35 * (Math.max(0, f) / T.windupMs)
      : f < hit
        ? 0.7 + 0.3 * ((f - T.windupMs) / T.chargeMs)
        : f < end
          ? 1 - e / T.followMs
          : 0;
  if (I > 0.01) {
    const fl = I * (0.85 + 0.15 * hash(seed + Math.floor(f / 40)));
    const sx = R.x - facing * cell * 0.42;
    const sy = R.y - cell * 0.02;
    const len = cell * (0.12 + 0.4 * fl);
    for (let k = 4; k >= 0; k--) {
      const a = fl * (1 - k * 0.15);
      radialGlow(ctx, sx - facing * (k / 4) * len, sy, cell * (0.1 - k * 0.014) * (0.6 + 0.4 * fl), [
        [0, `rgba(${HOT},${0.75 * a})`],
        [0.35, `rgba(${CYAN},${0.5 * a})`],
        [1, `rgba(${CYAN},0)`],
      ]);
    }
  }

  // The ram field: a bright arc on the leading hull, building to the hit, flaring, then gone.
  const field =
    f < T.windupMs
      ? 0.6 * (Math.max(0, f) / T.windupMs)
      : f < hit
        ? 0.6 + 0.4 * ((f - T.windupMs) / T.chargeMs)
        : 1.3 * Math.exp(-e / 150);
  if (field > 0.02) {
    const k = Math.min(1, field);
    const nose = { x: R.x + d[0] * g.reach * cell, y: R.y + d[1] * g.reach * cell };
    const cx = nose.x - d[0] * cell * 0.18;
    const cy = nose.y - d[1] * cell * 0.18;
    const a0 = Math.atan2(d[1], d[0]);
    for (const [w, col] of [
      [fx * 0.03, `rgba(${CYAN},${0.25 * k})`],
      [fx * 0.012, `rgba(${CYAN},${0.8 * k})`],
      [fx * 0.004, `rgba(${HOT},${k})`],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.26, a0 - 1, a0 + 1);
      ctx.stroke();
    }
    radialGlow(ctx, nose.x, nose.y, fx * 0.05 * field, [
      [0, `rgba(${HOT},${0.8 * k})`],
      [0.4, `rgba(${CYAN},${0.45 * k})`],
      [1, `rgba(${CYAN},0)`],
    ]);
  }

  // Speed lines behind it on the charge.
  if (!reduced && f >= T.windupMs && e < 150) {
    const a = f < hit ? (f - T.windupMs) / T.chargeMs : 1 - e / 150;
    [-0.22, -0.08, 0.08, 0.22].forEach((o, i) => {
      const len = 0.4 + 0.3 * hash(seed + i);
      const bx = R.x + n[0] * o * cell - d[0] * cell * 0.3;
      const by = R.y + n[1] * o * cell - d[1] * cell * 0.3;
      strokeSegment(ctx, bx, by, bx - d[0] * cell * len, by - d[1] * cell * len, Math.max(0.5, cell * 0.016), `rgba(${CYAN},${0.55 * a})`);
    });
  }

  if (e < 0) return;
  // The hit, where the hulls meet: a white flash, a shock ring, sparks thrown on along the charge, hot hull chips.
  const at = (g.contact + g.reach) * cell;
  const P = { x: L.from.x + d[0] * at, y: L.from.y + d[1] * at };
  const a0 = Math.atan2(d[1], d[0]);
  if (e < 260) {
    const q = e / 260;
    const k = Math.pow(1 - q, 1.5);
    radialGlow(ctx, P.x, P.y, fx * (0.18 + 0.22 * easeOut(q)), [
      [0, `rgba(255,255,255,${k})`],
      [0.25, `rgba(${GOLD},${0.85 * k})`],
      [0.6, `rgba(${ORANGE},${0.4 * k})`],
      [1, `rgba(${ORANGE},0)`],
    ]);
  }
  if (e < 420) {
    const q = e / 420;
    strokeRing(ctx, P.x, P.y, cell * (0.15 + 1.2 * easeOut(q)), cell * (0.048 * (1 - q) + 0.008), `rgba(${CYAN},${0.75 * (1 - q)})`);
  }
  const sparks = reduced ? 10 : 22;
  for (let i = 0; i < sparks; i++) {
    const id = seed * 101 + i;
    const back = i >= 16;
    const life = (back ? 160 : 220) + hash(id) * 260;
    if (e >= life) continue;
    const ang = back ? a0 + Math.PI + (hash(id + 1) - 0.5) * 1.8 : a0 + (hash(id + 1) - 0.5) * 2.4;
    const v = cell * (0.004 + hash(id + 2) * 0.008) * (back ? 0.6 : 1);
    const q = e / life;
    const r = v * e * (1 - 0.35 * q);
    const px = P.x + Math.cos(ang) * r;
    const py = P.y + Math.sin(ang) * r;
    const tail = v * 40;
    strokeSegment(ctx, px, py, px - Math.cos(ang) * tail, py - Math.sin(ang) * tail, Math.max(0.5, cell * 0.018), `rgba(${q < 0.3 ? HOT : q < 0.6 ? GOLD : ORANGE},${1 - q})`);
  }
  for (let i = 0; i < 7; i++) {
    const id = seed * 211 + i;
    const life = 500 + hash(id) * 300;
    if (e >= life) continue;
    const ang = a0 + (hash(id + 1) - 0.5) * 1.6;
    const v = cell * (0.002 + hash(id + 2) * 0.003);
    const q = e / life;
    const r = v * e * (1 - 0.4 * q);
    const size = cell * (0.03 + hash(id + 3) * 0.02);
    ctx.save();
    ctx.translate(P.x + Math.cos(ang) * r, P.y + Math.sin(ang) * r);
    ctx.rotate(e * 0.012 * (hash(id + 4) - 0.5) * 2 + i);
    ctx.fillStyle = `rgba(${q < 0.4 ? GOLD : ORANGE},${0.9 * (1 - q)})`;
    ctx.fillRect(-size / 2, -size / 4, size, size / 2);
    ctx.restore();
  }
  if (withVictim) {
    // As it drops off the board: a small blink (it's pushed out of the fight, not destroyed).
    const wink = e - RAM_KNOCK_MS * 0.88;
    const p = wink >= 0 && wink < 140 ? victimAt(hit + RAM_KNOCK_MS * 0.88, L, T, reduced) : null;
    if (p) {
      const k = 1 - wink / 140;
      radialGlow(ctx, p.x, p.y, fx * 0.07 * (0.6 + 0.6 * (wink / 140)), [
        [0, `rgba(${HOT},${0.8 * k})`],
        [0.4, `rgba(${CYAN},${0.5 * k})`],
        [1, `rgba(${CYAN},0)`],
      ]);
    }
  }
}

interface RamAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  /** The tile the rammer rams from (it has slid there). */
  fromRow: number;
  fromCol: number;
  /** The victim's tile, where the rammer ends up. */
  toRow: number;
  toCol: number;
  rammer: GridShip;
  /** Creator ships face right (their art is mirrored, as in GameGridCell). */
  rammerIsCreator: boolean;
  /** The rammed ship (null: the effect without it). */
  victim: GridShip | null;
  victimIsCreator: boolean;
  /** Identifies this ram, so the sound and shake play once. */
  playKey: string;
}

type Measured = { width: number; height: number; cellWidth: number; cellHeight: number; layout: RamLayout };

export const RamAnimation = React.memo(function RamAnimation({
  gridContainerRef,
  fromRow,
  fromCol,
  toRow,
  toCol,
  rammer,
  rammerIsCreator,
  victim,
  victimIsCreator,
  playKey,
}: RamAnimationProps) {
  const soundsMuted = useWeaponSoundsMuted();
  const [measured, setMeasured] = useState<Measured | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rammerRef = useRef<HTMLDivElement | null>(null);
  const victimRef = useRef<HTMLDivElement | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = gridContainerRef.current;
      if (!el) return;
      const { width, height, cellWidth, cellHeight } = gridLayoutSize(el);
      // The victim's disabled pose on the board right now (it sways on a shared clock).
      const drift = prefersReducedMotion() ? { rot: (15 * Math.PI) / 180, dy: 0 } : sosDriftAt();
      setMeasured({
        width,
        height,
        cellWidth,
        cellHeight,
        layout: {
          from: cellCenterOnGrid(el, fromRow, fromCol),
          to: cellCenterOnGrid(el, toRow, toCol),
          cell: Math.min(cellWidth, cellHeight),
          facingRight: rammerIsCreator,
          victimTilt: drift.rot,
          victimBob: drift.dy * (cellHeight / Math.min(cellWidth, cellHeight)),
        },
      });
    };
    measure();
    const el = gridContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridContainerRef, fromRow, fromCol, toRow, toCol, rammerIsCreator]);

  // Draw the ships and the light every frame, from the first one (before the browser paints).
  useLayoutEffect(() => {
    const grid = gridContainerRef.current;
    const canvas = canvasRef.current;
    if (!grid || !canvas || !measured) return;
    const surface = attachOverlayCanvas(grid, canvas, "add");
    const reduced = prefersReducedMotion();
    const seed = Math.floor(Math.random() * 1000);
    const { layout: L, cellWidth, cellHeight } = measured;
    if (startedAtRef.current == null) startedAtRef.current = performance.now();
    const place = (node: HTMLDivElement | null, x: number, y: number, rot = 0, scale = 1, alpha = 1) => {
      if (!node) return;
      node.style.transform = `translate(${x - cellWidth / 2}px, ${y - cellHeight / 2}px) rotate(${rot}rad) scale(${scale})`;
      node.style.opacity = String(alpha);
    };
    const paint = (now: number) => {
      const f = now - (startedAtRef.current ?? now);
      const r = rammerAt(f, L, BOARD_RAM_TIMING, reduced);
      place(rammerRef.current, r.x, r.y);
      const v = victimAt(f, L, BOARD_RAM_TIMING, reduced);
      if (v) place(victimRef.current, v.x, v.y, v.rot, v.scale, v.alpha);
      else place(victimRef.current, L.to.x, L.to.y, 0, 1, 0);
      const ctx = surface.begin();
      if (ctx) paintRamLight(ctx, f, L, BOARD_RAM_TIMING, seed, reduced, !!victim);
    };
    paint(performance.now());
    return startCancelledRaf(paint);
  }, [gridContainerRef, measured, victim]);

  // The crash and the board shake, once per ram, on the hit.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!playRamCrash(playKey, soundsMuted)) return;
      const grid = gridContainerRef.current;
      if (!grid || prefersReducedMotion() || typeof grid.animate !== "function") return;
      // Fractions of a cell (4 px, 3 px... at the desktop's 50 px cells); `translate` composes with the grid's own transform.
      const c = Math.min(gridLayoutSize(grid).cellWidth, gridLayoutSize(grid).cellHeight);
      const at = (x: number, y: number) => ({ translate: `${x * c}px ${y * c}px` });
      grid.animate([at(0, 0), at(0.08, -0.06), at(-0.06, 0.04), at(0.04, 0.02), at(0, 0)], { duration: 260, easing: "ease-out" });
    }, RAM_HIT_MS);
    return () => window.clearTimeout(timer);
  }, [playKey, gridContainerRef, soundsMuted]);

  const cellBox = measured ? { width: measured.cellWidth, height: measured.cellHeight } : { width: 0, height: 0 };
  return (
    <div
      className="absolute pointer-events-none z-30 overflow-visible"
      style={{ left: 0, top: 0, width: measured?.width ?? 0, height: measured?.height ?? 0 }}
      aria-hidden
    >
      {victim && (
        // The victim as its cell draws a disabled ship: tilted, mirrored on the creator's side, with its hull fires.
        <div ref={victimRef} className="absolute left-0 top-0 origin-center" style={{ ...cellBox, opacity: 0, willChange: "transform" }}>
          <div className={`relative h-full w-full ${victimIsCreator ? "scale-x-[-1]" : ""}`}>
            <GridShipImage ship={victim} className="relative h-full w-full" showLoadingState={false} hideRankStars />
            <SosHullFires shipId={victim.id} failing />
          </div>
        </div>
      )}
      <div ref={rammerRef} className="absolute left-0 top-0" style={{ ...cellBox, willChange: "transform" }}>
        <GridShipImage
          ship={rammer}
          className={`h-full w-full ${rammerIsCreator ? "[&_img]:scale-x-[-1]" : ""}`}
          showLoadingState={false}
          hideRankStars
        />
      </div>
      <canvas ref={canvasRef} style={FX_CANVAS_STYLE} />
    </div>
  );
});
