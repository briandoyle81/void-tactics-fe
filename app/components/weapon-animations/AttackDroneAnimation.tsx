"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { ATTACK_DRONES_MS } from "../../constants/animationTiming";
import type { GridShip } from "../../types/gridDisplay";
import type { ShipVisual } from "../../types/shipVisual";
import { renderSpecial2V2 } from "../../utils/shipRenderer/renderersV2/RenderSpecial2V2";
import { cellLayoutBox } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import { FX_CANVAS_STYLE, FX_SOLID_CANVAS_STYLE, attachOverlayCanvas, fxCellSize, prefersReducedMotion, radialGlow, strokeRing, strokeSegment } from "./canvasFx";
import {
  type CasterCell,
  type DroneBox,
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
import { playSoundEffect } from "../../hooks/useSoundEffects";
import { takeFirstPlay } from "./playOnce";
import { useWeaponSoundsMuted } from "./weaponSounds";

// Attack Drones (Drone Swarm): the nine drones on the ship's own art
// (RenderSpecial2V2, cut out one by one, shiny tint and all) leave in four
// waves, harry one enemy ship, cut it with lasers and come back. Each drone:
// - launch, 0–OUT_MS: a blip, then it lifts off its spot (growing from its
//   size on the art to a quarter of a cell) and darts out on a quick curve,
//   its thruster flickering;
// - close in, to SAW_AT_MS: it circles the target fast, at its own speed,
//   switching direction;
// - cut, to CUT_END_MS (its wave's buzzsaw): a red-orange laser from its head
//   slashing back and forth across the hull, leaving a score that cools from
//   gold to red, with sparks; the hull glows while it's cut;
// - home, to HOME_MS: it races back and settles onto its spot. The last wave
//   is home within ATTACK_DRONES_MS.
// While the sortie's on, the ship drawn at the launch cell leaves its drones
// out (droneArt.ts) and this draws them, parked until they launch and once
// they're back. A ship with no drone art launches the same drones, in their
// standard colours, from its centre. `once` (move playback) plays it once;
// without it (the aiming preview) it repeats. Two canvases over the board:
// the drones drawn normally, the light added on top (canvasFx). Reviewed in
// the Attack Drones rework artifact (2026-11-06).
//
// Each wave plays its own sounds, pitched a little differently each time: an
// angry beep as it leaves (attack-drone-launch.wav) and a buzzsaw while it
// cuts (attack-drone-saw.wav, 1.15 s). A played-back move plays them once per
// move (soundOnceKey). They stop if the drones go away first (after
// SOUND_STOP_AFTER_MS, so React's quick dev-mode remount doesn't cut them).
const LAUNCH_SOUND = "/sound/attack-drone-launch.wav";
const SAW_SOUND = "/sound/attack-drone-saw.wav";
const DRONE_PITCH_VARIATION = 0.05;
const DRONE_PLAYED_KEY = "vt-attack-drones-played-v1";
const SOUND_STOP_AFTER_MS = 200;

/** Each wave's launch (and its beep); its saw starts SAW_AT_MS later. */
const WAVES_MS = [0, 150, 300, 450];
const SAW_AT_MS = 960;
const OUT_MS = 700;
const CUT_END_MS = SAW_AT_MS + 1150;
const HOME_MS = 2900;
const LIFT_MS = 160;
/** The aiming preview repeats the sortie this often. */
const LOOP_MS = ATTACK_DRONES_MS + 300;
const MAX_TILT = 0.3;

interface AttackDroneAnimationProps {
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
  /** Move playback: one sortie, done within ATTACK_DRONES_MS. Omitted (the aiming preview), it repeats. */
  once?: boolean;
}

/** The nine drones on the ship's art (their boxes in its 256-unit square), and the wave each leaves in. */
const DRONE_BOUNDS = [
  [33, 14, 70, 39],
  [123, 25, 155, 48],
  [216, 14, 244, 36],
  [11, 54, 41, 76],
  [192, 56, 223, 79],
  [164, 186, 196, 209],
  [19, 205, 50, 228],
  [88, 220, 119, 242],
  [210, 214, 241, 236],
] as const;
const WAVE_OF = [0, 1, 2, 0, 3, 1, 2, 3, 0];
const DRONE_BOXES: DroneBox[] = DRONE_BOUNDS.map(([x0, y0, x1, y1]) => {
  const w = Math.max(x1 - x0, y1 - y0) + 4;
  return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - w / 2, w] as const;
});
/** On each drone (fractions of its box; the art faces left): its head with the cutter, its eye, its tail. */
const HEAD = [0.14, 0.45] as const;
const EYE = [0.26, 0.42] as const;
const TAIL = [0.88, 0.5] as const;

const ORANGE = "255,122,26";
const CORE = "255,208,138";
const HOT = "255,244,214";
const RED = "200,40,10";

export type AttackLayout = CasterCell & { tx: number; ty: number; cellW: number };
export type AttackRun = { start: number; seed: number; once: boolean };
type AttackDrone = DroneState & { phase: "out" | "close" | "cut" | "home" };

export function attackLayout(grid: HTMLElement, ar: number, ac: number, tr: number, tc: number, facingRight: boolean, fromArt: boolean): AttackLayout {
  const a = cellLayoutBox(grid, ar, ac);
  const t = cellLayoutBox(grid, tr, tc);
  return { ax: a.x, ay: a.y, aw: a.width, ah: a.height, tx: t.x + t.width / 2, ty: t.y + t.height / 2, cellW: t.width, facingRight, fromArt };
}

export function newAttackRun(start: number, once: boolean): AttackRun {
  return { start, seed: Math.random() * 1000, once };
}

/** Whether these drones are the ones on the ship's art: a variant-2 ship with Attack Drones. */
function ownsAttackDroneArt(ship: ShipVisual | undefined): ship is ShipVisual {
  return !!ship && Number(ship.traits.variant) === 2 && Number(ship.equipment.special) === 2;
}

/** The ship's drone art (shiny tint and all); a ship with none gets the standard drones. */
export function attackDroneArtFor(ship: ShipVisual | undefined): string {
  const source = ownsAttackDroneArt(ship)
    ? ship
    : ({
        equipment: { mainWeapon: 0, armor: 0, shields: 0, special: 2 },
        traits: { colors: { h1: 0, s1: 0, l1: 0, h2: 0, s2: 0, l2: 0 }, variant: 2, accuracy: 0, hull: 0, speed: 0 },
        shipData: { shipsDestroyed: 0, shiny: false, constructed: true, timestampDestroyed: 0 },
      } as unknown as ShipVisual);
  return renderSpecial2V2(source);
}

const launchOf = (i: number) => WAVES_MS[WAVE_OF[i]] + (i % 3) * 25;
const flightSize = (i: number, L: AttackLayout) => (DRONE_BOXES[i][2] / 36) * L.cellW * 0.26;

/** Where drone i harries the target at time t: darting round it, each at its own speed, switching direction. */
function harry(L: AttackLayout, i: number, t: number, sd: number): Pt {
  const th =
    hash(sd + i) * Math.PI * 2 +
    (i * Math.PI * 2) / 9 +
    t * 0.0016 * (i % 2 ? 1 : -1) +
    0.9 * Math.sin(t * (0.004 + hash(sd + i * 3) * 0.003) + i);
  const r = 0.5 + 0.12 * Math.sin(t * 0.007 + i * 1.7);
  return [L.tx + Math.cos(th) * L.cellW * r, L.ty + Math.sin(th) * L.cellW * r * 0.78];
}

function control(from: Pt, to: Pt, i: number, home: boolean, cellW: number): Pt {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const d = Math.hypot(dx, dy) || 1;
  const bend = clamp(d * 0.3, cellW * 0.3, cellW) * (hash(i * 7 + (home ? 3 : 0)) - 0.5) * 2;
  return [from[0] + dx * 0.5 - (dy / d) * bend, from[1] + dy * 0.5 + (dx / d) * bend];
}

/** Drone i, u ms after its launch (at `launch`); null once it's home. */
function droneAt(i: number, u: number, L: AttackLayout, launch: number, sd: number): AttackDrone | null {
  const dock = dockAt(DRONE_BOXES[i], L);
  const O: Pt = [dock.x, dock.y];
  const big = flightSize(i, L);
  const dockFace = L.facingRight ? L.cellW : -L.cellW;
  if (u < OUT_MS) {
    const S1 = harry(L, i, launch + OUT_MS, sd);
    const C = control(O, S1, i, false, L.cellW);
    const p = ease(u / OUT_MS);
    const pos = bez(O, C, S1, p);
    const lift = easeOut(Math.min(1, u / LIFT_MS));
    return { pos, vel: bezD(O, C, S1, p), size: dock.size + (big - dock.size) * lift, face: dockFace * (1 - lift) + (L.tx - pos[0]) * lift, phase: "out" };
  }
  if (u < CUT_END_MS) {
    const p0 = harry(L, i, launch + u, sd);
    const p1 = harry(L, i, launch + u + 16, sd);
    return { pos: p0, vel: [(p1[0] - p0[0]) * 30, (p1[1] - p0[1]) * 30], size: big, face: L.tx - p0[0], phase: u < SAW_AT_MS ? "close" : "cut" };
  }
  const v = u - CUT_END_MS;
  const span = HOME_MS - CUT_END_MS;
  if (v >= span) return null;
  const S2 = harry(L, i, launch + CUT_END_MS, sd);
  const C = control(S2, O, i, true, L.cellW);
  const p = ease(v / span);
  const pos = bez(S2, C, O, p);
  const left = span - v;
  const settle = left < LIFT_MS ? easeOut(1 - left / LIFT_MS) : 0;
  return { pos, vel: bezD(S2, C, O, p), size: big + (dock.size - big) * settle, face: dockFace * settle + (O[0] - pos[0]) * (1 - settle), phase: "home" };
}

/** Where drone i's cutter is on the hull at time t: slashing back and forth across it. */
function cutAt(L: AttackLayout, i: number, t: number, sd: number): Pt {
  const sp = 0.0045 + hash(sd + i * 5) * 0.003;
  const q = Math.sin(t * sp + hash(sd + i) * 6);
  const a0 = hash(sd + i * 11) * Math.PI;
  return [
    L.tx + Math.cos(a0) * q * L.cellW * 0.28 + Math.sin(t * 0.0021 + i) * L.cellW * 0.05,
    L.ty + Math.sin(a0) * q * L.cellW * 0.18 + Math.cos(t * 0.0017 + i * 2) * L.cellW * 0.04,
  ];
}

/** Draws the sortie at `now`: drones on `solid` (drawn normally), light on `light` (added). Exported for tests. */
export function paintAttackDrones(
  solid: CanvasRenderingContext2D | null,
  light: CanvasRenderingContext2D,
  run: AttackRun,
  now: number,
  L: AttackLayout,
  images: ReadonlyArray<CanvasImageSource | null> | null,
  reduceMotion: boolean,
  /** The ship's art has left its drones out (droneArt.ts): draw them parked whenever they aren't flying. */
  docked = false,
) {
  const park = (i: number) => {
    const img = images?.[i];
    if (docked && solid && img) drawDocked(solid, img, DRONE_BOXES[i], L);
  };
  const parkAll = () => DRONE_BOXES.forEach((_, i) => park(i));
  const elapsed = now - run.start;
  if (elapsed < 0) return parkAll();
  if (run.once && elapsed >= ATTACK_DRONES_MS) return parkAll();
  const t = run.once ? elapsed : elapsed % LOOP_MS;
  if (t >= ATTACK_DRONES_MS) return parkAll();
  const cycle = run.once ? 0 : Math.floor(elapsed / LOOP_MS);
  const sd = run.seed * 17 + cycle * 3;
  const fx = fxCellSize(L.cellW);
  const unit = L.cellW / 50;
  const { tx, ty, cellW } = L;
  let cutting = 0;

  DRONE_BOXES.forEach((box, i) => {
    const launch = launchOf(i);
    const u = t - launch;
    if (u < 0) return park(i);
    const dock = dockAt(box, L);
    if (u < 200) {
      const q = u / 200;
      strokeRing(light, dock.x, dock.y, dock.size * (0.4 + 0.8 * easeOut(q)), (0.4 + 0.7 * (1 - q)) * unit, `rgba(${ORANGE},${0.75 * (1 - q)})`);
    }
    const d = droneAt(i, u, L, launch, sd);
    if (!d) return park(i);
    const head = pointOnDrone(d, HEAD, cellW, MAX_TILT);
    const eye = pointOnDrone(d, EYE, cellW, MAX_TILT);
    const tail = pointOnDrone(d, TAIL, cellW, MAX_TILT);

    // Thrust: a hot orange flicker off its tail while it flies.
    if (d.phase !== "cut" || Math.hypot(d.vel[0], d.vel[1]) > 20) {
      radialGlow(light, tail[0], tail[1], d.size * (0.2 + 0.1 * hash(sd + i + Math.floor(u / 40))), [
        [0, `rgba(${HOT},0.7)`],
        [0.4, `rgba(${ORANGE},0.5)`],
        [1, `rgba(${ORANGE},0)`],
      ]);
    }
    if (d.phase === "cut") {
      cutting++;
      // The cutter: a red-orange laser from its head, slashing across the hull, leaving a score that cools.
      const e = u - SAW_AT_MS;
      const ramp = Math.min(1, e / 60) * Math.min(1, (CUT_END_MS - u) / 80);
      const tip = cutAt(L, i, launch + u, sd);
      for (let k = 1; k <= 10; k++) {
        const back = k * 45;
        if (e - back < 0) break;
        const p0 = cutAt(L, i, launch + u - back + 45, sd);
        const p1 = cutAt(L, i, launch + u - back, sd);
        const age = back / 450;
        strokeSegment(light, p0[0], p0[1], p1[0], p1[1], fx * 0.012 * (1 - age * 0.5), `rgba(${age < 0.25 ? CORE : age < 0.6 ? ORANGE : RED},${0.75 * (1 - age)})`);
      }
      strokeSegment(light, head[0], head[1], tip[0], tip[1], fx * 0.022, `rgba(${ORANGE},${0.22 * ramp})`);
      strokeSegment(light, head[0], head[1], tip[0], tip[1], fx * 0.009, `rgba(${ORANGE},${0.85 * ramp})`);
      strokeSegment(light, head[0], head[1], tip[0], tip[1], Math.max(0.5, fx * 0.0035), `rgba(${HOT},${ramp})`);
      radialGlow(light, tip[0], tip[1], fx * 0.04, [
        [0, `rgba(255,255,255,${0.95 * ramp})`],
        [0.35, `rgba(${ORANGE},${0.65 * ramp})`],
        [1, `rgba(${ORANGE},0)`],
      ]);
      radialGlow(light, head[0], head[1], d.size * 0.16, [
        [0, `rgba(${HOT},${0.9 * ramp})`],
        [1, `rgba(${ORANGE},0)`],
      ]);
      // Sparks spraying off the cut.
      for (let te = Math.max(SAW_AT_MS, Math.floor((u - 200) / 40) * 40); te <= Math.min(u, CUT_END_MS - 40); te += 40) {
        const id = sd * 7 + i * 1000 + te;
        const age = u - te;
        const life = 120 + hash(id) * 80;
        if (age < 0 || age >= life) continue;
        if (reduceMotion && hash(id + 9) < 0.5) continue;
        const s0 = cutAt(L, i, launch + te, sd);
        const ang = Math.atan2(s0[1] - head[1], s0[0] - head[0]) + (hash(id + 1) - 0.5) * 2.2;
        const v = cellW * (0.006 + hash(id + 2) * 0.006);
        const q = age / life;
        const px = s0[0] + Math.cos(ang) * v * age;
        const py = s0[1] + Math.sin(ang) * v * age;
        strokeSegment(light, px, py, px - Math.cos(ang) * cellW * 0.05, py - Math.sin(ang) * cellW * 0.05, 0.7 * unit, `rgba(${q < 0.4 ? HOT : ORANGE},${1 - q})`);
      }
    }
    const img = images?.[i];
    if (solid && img) drawDrone(solid, img, d, cellW, MAX_TILT);
    // Its eye, red-hot while it hunts.
    radialGlow(light, eye[0], eye[1], d.size * 0.2, [
      [0, `rgba(${HOT},0.6)`],
      [0.35, "rgba(255,70,20,0.55)"],
      [1, "rgba(255,70,20,0)"],
    ]);
  });
  // The hull heats while it's cut.
  if (cutting) radialGlow(light, tx, ty, cellW * 0.45, [[0, `rgba(${ORANGE},${Math.min(0.2, 0.025 * cutting)})`], [1, `rgba(${ORANGE},0)`]]);
}

export const AttackDroneAnimation = React.memo(function AttackDroneAnimation({
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
}: AttackDroneAnimationProps) {
  const soundsMuted = useWeaponSoundsMuted();
  const soundOnceKeyRef = useRef(soundOnceKey);
  const soundsMutedRef = useRef(soundsMuted);
  soundOnceKeyRef.current = soundOnceKey;
  soundsMutedRef.current = soundsMuted;
  const onceRef = useRef(once);
  onceRef.current = once;
  const solidRef = useRef<HTMLCanvasElement | null>(null);
  const lightRef = useRef<HTMLCanvasElement | null>(null);
  const fromArt = ownsAttackDroneArt(ship);
  const aimRef = useRef({ attackerRow, attackerCol, targetRow, targetCol, facingRight, fromArt });
  aimRef.current = { attackerRow, attackerCol, targetRow, targetCol, facingRight, fromArt };
  /** A new sortie for a new caster or target. */
  const attackKey = `${attackerRow}-${attackerCol}-${targetRow}-${targetCol}-${facingRight ? 1 : 0}-${fromArt ? 1 : 0}`;
  const attackKeyRef = useRef(attackKey);
  attackKeyRef.current = attackKey;

  // The drones' images, cut out of the ship's art (only its colours and shine matter).
  const art = useMemo(() => attackDroneArtFor(ship), [ship]);
  const images = useDroneImages(art, DRONE_BOXES);
  const imagesRef = useRef(images);
  imagesRef.current = images;
  // With its images ready, take the drones off the ship's art at the launch cell; this draws them from then on.
  const paintNowRef = useRef<() => void>(() => {});
  const paintNow = useCallback(() => paintNowRef.current(), []);
  const docked = useHoldDroneArt(hideShipArt && fromArt && !!images, ship?.id, attackerRow, attackerCol, paintNow);
  const dockedRef = useRef(docked);
  dockedRef.current = docked;

  // Each wave's beep as it launches, then its buzzsaw as it cuts.
  useEffect(() => {
    const key = soundOnceKeyRef.current;
    if (soundsMutedRef.current || (key != null && !takeFirstPlay(DRONE_PLAYED_KEY, key))) return;
    const startedAt = Date.now();
    const playing: HTMLAudioElement[] = [];
    const play = (src: string) => {
      const audio = playSoundEffect(src, { pitchVariation: DRONE_PITCH_VARIATION });
      if (audio) playing.push(audio);
    };
    const timers = WAVES_MS.flatMap((delay) => [
      window.setTimeout(() => play(LAUNCH_SOUND), delay),
      window.setTimeout(() => play(SAW_SOUND), delay + SAW_AT_MS),
    ]);
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

    let layout: AttackLayout | null = null;
    let layoutKey = "";
    const ro = new ResizeObserver(() => {
      layout = null;
    });
    ro.observe(grid);
    let run: AttackRun | null = null;
    let runKey = "";

    const paint = (now: number) => {
      if (!layout || layoutKey !== attackKeyRef.current) {
        const a = aimRef.current;
        layout = attackLayout(grid, a.attackerRow, a.attackerCol, a.targetRow, a.targetCol, a.facingRight, a.fromArt);
        layoutKey = attackKeyRef.current;
      }
      if (!run || runKey !== attackKeyRef.current) {
        run = newAttackRun(now, onceRef.current);
        runKey = attackKeyRef.current;
      }
      const sctx = solid.begin();
      const lctx = light.begin();
      if (!lctx) return;
      paintAttackDrones(sctx, lctx, run, now, layout, imagesRef.current, reduceMotion, dockedRef.current);
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
