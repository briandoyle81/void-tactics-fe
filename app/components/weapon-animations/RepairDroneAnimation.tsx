"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { REPAIR_DRONES_MS } from "../../constants/animationTiming";
import type { GridShip } from "../../types/gridDisplay";
import type { ShipVisual } from "../../types/shipVisual";
import { renderSpecial2 } from "../../utils/shipRenderer/renderers/RenderSpecial2";
import {
  type CasterCell,
  type DroneState,
  type Pt,
  bez,
  bezD,
  clamp,
  dockOf as dockAt,
  drawDocked,
  drawDrone,
  ease,
  easeOut,
  hash,
  onDrone as pointOnDrone,
  useDroneImages,
  useHoldDroneArt,
} from "./droneArt";
import { cellLayoutBox } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import {
  FX_CANVAS_STYLE,
  FX_SOLID_CANVAS_STYLE,
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

// Repair Drones: the three drones on the ship's own art (RenderSpecial2,
// cut out one by one, shiny tint and all) lift off their spots on the hull,
// fly to the ship being repaired, repair it and settle back. Each drone,
// launched DRONE_LAUNCHES_MS apart:
// - out, 0–OUT_MS: a blip, then it rises off the hull (growing from its size
//   on the art to a third of a cell) and flies a curve to a station round the
//   target, turning to face it;
// - scan, to SCAN_END_MS: it holds station on a slow ellipse and sweeps the
//   hull with a cyan fan from its lens;
// - weld, to WELD_END_MS (the sound's weld): a thin green beam from its front
//   claw to a wandering point on the hull, with a white-hot spot, sparks and
//   green motes rising; the hull glows green while drones weld it, and a
//   pulse rolls over it when the last weld ends;
// - home, to HOME_MS: it curves back and settles onto its spot, shrinking to
//   the art's size. The last is home within REPAIR_DRONES_MS.
// While the sortie's on, the ship drawn at the launch cell leaves its drones
// out (droneArt.ts) and this draws them, parked until they launch and once
// they're back. A ship with no drone art (variant 2's innate
// repair) launches the same drones, in their standard colours, from its
// centre. `once` (move playback) plays it once; without it (the aiming
// preview) it repeats. Two canvases over the board: the drones drawn
// normally, the light added on top (canvasFx). Reviewed in the Repair Drones
// rework artifact (2026-11-06).
//
// Each drone plays its own sound (repair-drone.wav: a bleep-bloop as it
// leaves, then its weld) as it launches, pitched a little differently each
// time. A played-back move plays them once per move (soundOnceKey). They stop
// if the drones go away first (after SOUND_STOP_AFTER_MS, so React's quick
// dev-mode remount doesn't cut them).
const DRONE_SOUND = "/sound/repair-drone.wav";
const DRONE_PITCH_VARIATION = 0.05;
const DRONE_PLAYED_KEY = "vt-repair-drones-played-v1";
const SOUND_STOP_AFTER_MS = 200;

/** Each drone's launch (and its sound). */
const DRONE_LAUNCHES_MS = [0, 180, 360];

interface RepairDroneAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  attackerRow: number;
  attackerCol: number;
  targetRow: number;
  targetCol: number;
  /** The casting ship faces right (the creator's side): its art, and so its drones' spots, are mirrored. */
  facingRight: boolean;
  /** The casting ship: its drones are cut out of its art. Omitted, the standard drones launch from its centre. */
  ship?: GridShip;
  /** Take the drones off the ship's art while they're out (default). False where this board doesn't draw the caster (the cinematic's defender panel). */
  hideShipArt?: boolean;
  /**
   * The move being played back: the sounds play once per key this session.
   * Omitted (aiming preview), they play each time the drones launch.
   */
  soundOnceKey?: string;
  /** Move playback: one sortie, done within REPAIR_DRONES_MS. Omitted (the aiming preview), it repeats. */
  once?: boolean;
}

const OUT_MS = 1000;
const SCAN_END_MS = 1350;
const WELD_END_MS = 2100;
const HOME_MS = 2900;
const LIFT_MS = 200;
/** The aiming preview repeats the sortie this often. */
const LOOP_MS = REPAIR_DRONES_MS + 300;
/** Stations: an ellipse this wide and tall (fractions of the cell) round the target, turning this fast (rad/ms). */
const STATION_RX = 0.45;
const STATION_RY = 0.34;
const STATION_OMEGA = 0.0012;

/** The drones on the ship's art: each one's box in the art's 256-unit square, its lens and front claw (fractions of the box; the art faces left). */
const DRONES = [
  { box: [44, 20, 36], eye: [0.42, 0.45], claw: [0.12, 0.88] },
  { box: [82, 40, 27], eye: [0.43, 0.5], claw: [0.1, 0.86] },
  { box: [80, 198, 38], eye: [0.4, 0.39], claw: [0.1, 0.84] },
] as const;
const DRONE_BOXES = DRONES.map((d) => d.box);

const GREEN = "107,255,143";
const CYAN = "86,214,255";
const WHITE = "235,255,240";

export type RepairLayout = CasterCell & {
  /** The target's centre. */
  tx: number;
  ty: number;
  cellW: number;
};
export type RepairRun = { start: number; seed: number; once: boolean };
type RepairDrone = DroneState & { phase: "out" | "scan" | "weld" | "home" };
const MAX_TILT = 0.22;

export function repairLayout(
  grid: HTMLElement,
  ar: number,
  ac: number,
  tr: number,
  tc: number,
  facingRight: boolean,
  fromArt: boolean,
): RepairLayout {
  const a = cellLayoutBox(grid, ar, ac);
  const t = cellLayoutBox(grid, tr, tc);
  return { ax: a.x, ay: a.y, aw: a.width, ah: a.height, tx: t.x + t.width / 2, ty: t.y + t.height / 2, cellW: t.width, facingRight, fromArt };
}

export function newRepairRun(start: number, once: boolean): RepairRun {
  return { start, seed: Math.random() * 1000, once };
}

/** The ship's drone art (shiny tint and all); a ship with none gets the standard drones. */
/** Whether these drones are the ones on the ship's art: a variant-1 ship with Repair Drones. */
function ownsRepairDroneArt(ship: ShipVisual | undefined): ship is ShipVisual {
  return !!ship && Number(ship.traits.variant) !== 2 && Number(ship.equipment.special) === 2;
}

export function droneArtFor(ship: ShipVisual | undefined): string {
  const own = ownsRepairDroneArt(ship);
  const source = own
    ? ship
    : ({
        equipment: { mainWeapon: 0, armor: 0, shields: 0, special: 2 },
        traits: { colors: { h1: 0, s1: 0, l1: 0, h2: 0, s2: 0, l2: 0 }, variant: 1, accuracy: 0, hull: 0, speed: 0 },
        shipData: { shipsDestroyed: 0, shiny: false, constructed: true, timestampDestroyed: 0 },
      } as unknown as ShipVisual);
  return renderSpecial2(source);
}

const dockOf = (i: number, L: RepairLayout) => dockAt(DRONES[i].box, L);

/** A drone's size in flight: about a third of a cell, the three keeping their sizes relative to each other. */
const flightSize = (i: number, L: RepairLayout) => (DRONES[i].box[2] / 36) * L.cellW * 0.34;

function station(L: RepairLayout, i: number, t: number, seed: number): Pt {
  const th = hash(seed) * Math.PI * 2 + (i * Math.PI * 2) / 3 + STATION_OMEGA * t;
  return [L.tx + Math.cos(th) * L.cellW * STATION_RX, L.ty + Math.sin(th) * L.cellW * STATION_RY];
}

/** A flight's bend: to one side going out, the other coming home; a short hop loops out. */
function control(from: Pt, to: Pt, i: number, home: boolean, cellW: number): Pt {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const d = Math.hypot(dx, dy);
  if (d < cellW * 0.6) {
    const an = Math.atan2(dy, dx) + ((home ? -1 : 1) * Math.PI) / 2;
    return [from[0] + dx / 2 + Math.cos(an) * cellW * 0.55, from[1] + dy / 2 + Math.sin(an) * cellW * 0.55];
  }
  const bend = clamp(d * 0.25, cellW * 0.3, cellW * 0.9) * [0.8, -1, 0.6][i] * (home ? -1 : 1);
  return [from[0] + dx * 0.5 - (dy / d) * bend, from[1] + dy * 0.5 + (dx / d) * bend];
}

/** Drone i, u ms after its launch (launched `delay` ms in); null once it's home. */
function droneAt(i: number, u: number, L: RepairLayout, delay: number, seed: number): RepairDrone | null {
  const dock = dockOf(i, L);
  const O: Pt = [dock.x, dock.y];
  const big = flightSize(i, L);
  const dockFace = L.facingRight ? L.cellW : -L.cellW;
  if (u < OUT_MS) {
    const S1 = station(L, i, delay + OUT_MS, seed);
    const C = control(O, S1, i, false, L.cellW);
    const p = ease(u / OUT_MS);
    const pos = bez(O, C, S1, p);
    // Lift-off: it rises off the hull, growing from its size on the art, turning from the ship's facing to the target.
    const lift = easeOut(Math.min(1, u / LIFT_MS));
    return { pos, vel: bezD(O, C, S1, p), size: dock.size + (big - dock.size) * lift, face: dockFace * (1 - lift) + (L.tx - pos[0]) * lift, phase: "out" };
  }
  if (u < WELD_END_MS) {
    const s = station(L, i, delay + u, seed);
    const bob = Math.sin(u * 0.009 + i * 2) * L.cellW * 0.012;
    return { pos: [s[0], s[1] + bob], vel: [0, 0], size: big, face: L.tx - s[0], phase: u < SCAN_END_MS ? "scan" : "weld" };
  }
  const v = u - WELD_END_MS;
  const span = HOME_MS - WELD_END_MS;
  if (v >= span) return null;
  const S2 = station(L, i, delay + WELD_END_MS, seed);
  const C = control(S2, O, i, true, L.cellW);
  const p = ease(v / span);
  const pos = bez(S2, C, O, p);
  // Docking: it settles onto its spot, shrinking to the art's size.
  const left = span - v;
  const settle = left < LIFT_MS ? easeOut(1 - left / LIFT_MS) : 0;
  return { pos, vel: bezD(S2, C, O, p), size: big + (dock.size - big) * settle, face: dockFace * settle + (O[0] - pos[0]) * (1 - settle), phase: "home" };
}

const onDrone = (d: RepairDrone, rel: readonly [number, number], cellW: number) => pointOnDrone(d, rel, cellW, MAX_TILT);

/** Draws the sortie at `now`: drones on `solid` (drawn normally), light on `light` (added). Exported for tests. */
export function paintRepair(
  solid: CanvasRenderingContext2D | null,
  light: CanvasRenderingContext2D,
  run: RepairRun,
  now: number,
  L: RepairLayout,
  images: ReadonlyArray<CanvasImageSource | null> | null,
  reduceMotion: boolean,
  /** The ship's art has left its drones out (droneArt.ts): draw them parked whenever they aren't flying. */
  docked = false,
) {
  const parkAll = () => {
    if (docked && solid && images) DRONES.forEach((d, i) => images[i] && drawDocked(solid, images[i], d.box, L));
  };
  const elapsed = now - run.start;
  if (elapsed < 0) return parkAll();
  if (run.once && elapsed >= REPAIR_DRONES_MS) return parkAll();
  const t = run.once ? elapsed : elapsed % LOOP_MS;
  if (t >= REPAIR_DRONES_MS) return parkAll();
  const cycle = run.once ? 0 : Math.floor(elapsed / LOOP_MS);
  const sd = run.seed * 13 + cycle * 5;
  const fx = fxCellSize(L.cellW);
  const unit = L.cellW / 50;
  const { tx, ty, cellW } = L;
  let welders = 0;

  DRONE_LAUNCHES_MS.forEach((delay, i) => {
    const u = t - delay;
    const img = images?.[i] ?? null;
    const park = () => {
      if (docked && solid && img) drawDocked(solid, img, DRONES[i].box, L);
    };
    if (u < 0) return park();
    const dock = dockOf(i, L);
    // A blip as it lifts off (the sound's bleep), and another as it docks.
    if (u < 260) {
      const q = u / 260;
      strokeRing(light, dock.x, dock.y, dock.size * (0.4 + 0.9 * easeOut(q)), (0.4 + 0.8 * (1 - q)) * unit, `rgba(${CYAN},${0.7 * (1 - q)})`);
    }
    const dk = u - HOME_MS;
    if (dk >= -60 && dk < 200) {
      const q = clamp((dk + 60) / 260, 0, 1);
      strokeRing(light, dock.x, dock.y, dock.size * (1.2 - 0.7 * q), 0.6 * unit, `rgba(${GREEN},${0.5 * (1 - q)})`);
    }
    const d = droneAt(i, u, L, delay, sd);
    if (!d) return park();
    const eye = onDrone(d, DRONES[i].eye, cellW);
    const claw = onDrone(d, DRONES[i].claw, cellW);

    if (d.phase === "scan") {
      // Scan: a cyan fan from its lens sweeping the hull.
      const q = (u - OUT_MS) / (SCAN_END_MS - OUT_MS);
      const sw = Math.sin(q * Math.PI * 2) * 0.55;
      const base = Math.atan2(ty - eye[1], tx - eye[0]);
      const R = Math.hypot(tx - eye[0], ty - eye[1]) + cellW * 0.12;
      const k = Math.sin(Math.PI * q);
      const a0 = base + sw - 0.12;
      const a1 = base + sw + 0.12;
      light.fillStyle = `rgba(${CYAN},${0.12 * k})`;
      light.beginPath();
      light.moveTo(eye[0], eye[1]);
      light.lineTo(eye[0] + Math.cos(a0) * R, eye[1] + Math.sin(a0) * R);
      light.lineTo(eye[0] + Math.cos(a1) * R, eye[1] + Math.sin(a1) * R);
      light.closePath();
      light.fill();
      strokeSegment(light, eye[0] + Math.cos(a1) * R * 0.55, eye[1] + Math.sin(a1) * R * 0.55, eye[0] + Math.cos(a1) * R, eye[1] + Math.sin(a1) * R, 0.7 * unit, `rgba(${WHITE},${0.6 * k})`);
    }
    if (d.phase === "weld") {
      welders++;
      // Weld: from its front claw, a thin green beam to a wandering point on the hull.
      const ramp = Math.min(1, (u - SCAN_END_MS) / 80) * Math.min(1, (WELD_END_MS - u) / 100);
      const weldPoint = (at: number): Pt => {
        const s = station(L, i, delay + at, sd);
        const a = Math.atan2(s[1] - ty, s[0] - tx) + Math.sin(at * 0.011 + i * 2) * 0.35;
        return [tx + Math.cos(a) * cellW * 0.17, ty + Math.sin(a) * cellW * 0.13];
      };
      const W = weldPoint(u);
      const flick = 0.85 + 0.15 * hash(sd + i + Math.floor(u / 30));
      strokeSegment(light, claw[0], claw[1], W[0], W[1], fx * 0.018, `rgba(${GREEN},${0.25 * ramp})`);
      strokeSegment(light, claw[0], claw[1], W[0], W[1], Math.max(0.6, fx * 0.006), `rgba(${WHITE},${0.9 * ramp * flick})`);
      radialGlow(light, W[0], W[1], fx * 0.05 * flick, [
        [0, `rgba(255,255,255,${0.95 * ramp})`],
        [0.35, `rgba(${GREEN},${0.7 * ramp})`],
        [1, `rgba(${GREEN},0)`],
      ]);
      // Sparks off the weld, falling a little.
      for (let te = Math.max(SCAN_END_MS, Math.floor((u - 240) / 30) * 30); te <= Math.min(u, WELD_END_MS - 60); te += 30) {
        for (let j = 0; j < (reduceMotion ? 1 : 2); j++) {
          const id = sd * 7 + i * 1000 + te * 3 + j;
          const age = u - te;
          const life = 160 + hash(id) * 100;
          if (age < 0 || age >= life) continue;
          const ang = hash(id + 1) * Math.PI * 2;
          const v = cellW * (0.004 + hash(id + 2) * 0.004);
          const q = age / life;
          const [sx, sy] = weldPoint(te);
          const px = sx + Math.cos(ang) * v * age;
          const py = sy + Math.sin(ang) * v * age + 0.00004 * cellW * age * age;
          strokeSegment(light, px, py, px - Math.cos(ang) * cellW * 0.04, py - Math.sin(ang) * cellW * 0.04, 0.7 * unit, `rgba(${q < 0.4 ? WHITE : GREEN},${1 - q})`);
        }
      }
      // Green motes rising off the hull.
      for (let te = Math.max(SCAN_END_MS, Math.floor((u - 500) / 70) * 70); te <= u; te += 70) {
        const id = sd * 3 + i * 500 + te;
        const age = u - te;
        if (age >= 500) continue;
        const q = age / 500;
        const k = Math.sin(Math.PI * q);
        const mx = tx + (hash(id) - 0.5) * cellW * 0.5;
        const my = ty + (hash(id + 1) - 0.5) * cellW * 0.35 - q * cellW * 0.22;
        radialGlow(light, mx, my, cellW * 0.035, [
          [0, `rgba(${WHITE},${0.8 * k})`],
          [0.5, `rgba(${GREEN},${0.5 * k})`],
          [1, `rgba(${GREEN},0)`],
        ]);
      }
    }

    // The drone itself: its own art, mirrored to its facing and tipped with its climb.
    if (solid && img) drawDrone(solid, img, d, cellW, MAX_TILT);
    // Its lens glowing, brighter while it scans; its claw lit while it welds.
    const lens = d.phase === "scan" ? 1 : 0.55 + 0.2 * Math.sin(u * 0.012 + i);
    radialGlow(light, eye[0], eye[1], d.size * 0.3, [
      [0, `rgba(${WHITE},${0.7 * lens})`],
      [0.3, `rgba(${CYAN},${0.55 * lens})`],
      [1, `rgba(${CYAN},0)`],
    ]);
    if (d.phase === "weld") radialGlow(light, claw[0], claw[1], d.size * 0.14, [[0, `rgba(${WHITE},0.8)`], [1, `rgba(${GREEN},0)`]]);
  });

  // The hull glows green while it's welded, and a pulse rolls over it when the last weld ends.
  if (welders) radialGlow(light, tx, ty, cellW * 0.5, [[0, `rgba(${GREEN},${0.06 * welders})`], [1, `rgba(${GREEN},0)`]]);
  const done = t - (DRONE_LAUNCHES_MS[DRONE_LAUNCHES_MS.length - 1] + WELD_END_MS);
  if (done >= 0 && done < 450) {
    const q = done / 450;
    radialGlow(light, tx, ty, cellW * 0.48, [
      [0, `rgba(${WHITE},${0.25 * (1 - q)})`],
      [0.5, `rgba(${GREEN},${0.25 * (1 - q)})`],
      [1, `rgba(${GREEN},0)`],
    ]);
    strokeRing(light, tx, ty, cellW * (0.2 + 0.4 * easeOut(q)), (0.6 + 1.4 * (1 - q)) * unit, `rgba(${GREEN},${0.7 * (1 - q)})`);
  }
}

export const RepairDroneAnimation = React.memo(function RepairDroneAnimation({
  gridContainerRef,
  attackerRow,
  attackerCol,
  targetRow,
  targetCol,
  facingRight,
  ship,
  hideShipArt = true,
  soundOnceKey,
  once = false,
}: RepairDroneAnimationProps) {
  const soundsMuted = useWeaponSoundsMuted();
  const soundOnceKeyRef = useRef(soundOnceKey);
  const soundsMutedRef = useRef(soundsMuted);
  soundOnceKeyRef.current = soundOnceKey;
  soundsMutedRef.current = soundsMuted;
  const onceRef = useRef(once);
  onceRef.current = once;
  const solidRef = useRef<HTMLCanvasElement | null>(null);
  const lightRef = useRef<HTMLCanvasElement | null>(null);
  const fromArt = ownsRepairDroneArt(ship);
  const aimRef = useRef({ attackerRow, attackerCol, targetRow, targetCol, facingRight, fromArt });
  aimRef.current = { attackerRow, attackerCol, targetRow, targetCol, facingRight, fromArt };
  /** A new sortie for a new caster or target. */
  const attackKey = `${attackerRow}-${attackerCol}-${targetRow}-${targetCol}-${facingRight ? 1 : 0}-${fromArt ? 1 : 0}`;
  const attackKeyRef = useRef(attackKey);
  attackKeyRef.current = attackKey;

  // The drones' images, cut out of the ship's art (only its colours and shine matter).
  const art = useMemo(() => droneArtFor(ship), [ship]);
  const images = useDroneImages(art, DRONE_BOXES);
  const imagesRef = useRef(images);
  imagesRef.current = images;
  // With its images ready, take the drones off the ship's art at the launch cell; this draws them from then on.
  const paintNowRef = useRef<() => void>(() => {});
  const paintNow = useCallback(() => paintNowRef.current(), []);
  const docked = useHoldDroneArt(hideShipArt && fromArt && !!images, ship?.id, attackerRow, attackerCol, paintNow);
  const dockedRef = useRef(docked);
  dockedRef.current = docked;

  // One sound per drone, as each launches.
  useEffect(() => {
    const key = soundOnceKeyRef.current;
    if (soundsMutedRef.current || (key != null && !takeFirstPlay(DRONE_PLAYED_KEY, key))) return;
    const startedAt = Date.now();
    const playing: HTMLAudioElement[] = [];
    const timers = DRONE_LAUNCHES_MS.map((delay) =>
      window.setTimeout(() => {
        const audio = playSoundEffect(DRONE_SOUND, { pitchVariation: DRONE_PITCH_VARIATION });
        if (audio) playing.push(audio);
      }, delay),
    );
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      if (Date.now() - startedAt > SOUND_STOP_AFTER_MS) playing.forEach((a) => a.pause());
    };
  }, []);

  // Set up in a layout effect and painted at once, so the drones parked on the canvas are there in the
  // same frame the ship's art leaves them out.
  useLayoutEffect(() => {
    const grid = gridContainerRef.current;
    const solidCanvas = solidRef.current;
    const lightCanvas = lightRef.current;
    if (!grid || !solidCanvas || !lightCanvas) return;
    const reduceMotion = prefersReducedMotion();
    const solid = attachOverlayCanvas(grid, solidCanvas, "normal");
    const light = attachOverlayCanvas(grid, lightCanvas);

    let layout: RepairLayout | null = null;
    let layoutKey = "";
    const ro = new ResizeObserver(() => {
      layout = null;
    });
    ro.observe(grid);
    let run: RepairRun | null = null;
    let runKey = "";

    const paint = (now: number) => {
      if (!layout || layoutKey !== attackKeyRef.current) {
        const a = aimRef.current;
        layout = repairLayout(grid, a.attackerRow, a.attackerCol, a.targetRow, a.targetCol, a.facingRight, a.fromArt);
        layoutKey = attackKeyRef.current;
      }
      if (!run || runKey !== attackKeyRef.current) {
        run = newRepairRun(now, onceRef.current);
        runKey = attackKeyRef.current;
      }
      const sctx = solid.begin();
      const lctx = light.begin();
      if (!lctx) return;
      paintRepair(sctx, lctx, run, now, layout, imagesRef.current, reduceMotion, dockedRef.current);
    };
    paintNowRef.current = () => paint(performance.now());
    paint(performance.now());

    const stopRaf = startCancelledRaf(paint);
    return () => {
      paintNowRef.current = () => {};
      stopRaf();
      ro.disconnect();
      solid.dispose();
      light.dispose();
    };
  }, [gridContainerRef]);

  return (
    <>
      <canvas ref={solidRef} className="absolute pointer-events-none z-20" style={FX_SOLID_CANVAS_STYLE} aria-hidden="true" />
      <canvas ref={lightRef} className="absolute pointer-events-none z-20" style={FX_CANVAS_STYLE} aria-hidden="true" />
    </>
  );
});
