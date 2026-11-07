"use client";

import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { ShipVisual } from "../../types/shipVisual";

// What the drone specials (Repair Drones, Attack Drones) share. Their drones
// are the ones drawn on the casting ship's art, cut out one by one. While a
// sortie is on, the ship's image at the launch cell is drawn without its
// drone layer (DroneArtStore: the effect holds the cell, GameGridCell and
// the combat cinematic's panel read it), and the effect draws each drone
// itself: parked on its spot until it launches and once it's back,
// flying in between. So no drone is ever drawn twice, or missing.

export type Pt = [number, number];
/** A drone's box in the ship art's 256-unit square: [x, y, size]. */
export type DroneBox = readonly [number, number, number];

/** A drone in flight (or holding station). */
export type DroneState = {
  pos: Pt;
  vel: Pt;
  size: number;
  /** Positive: it should face right; the drone art faces left. */
  face: number;
};

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
export function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
export const bez = (a: Pt, c: Pt, b: Pt, p: number): Pt => [
  (1 - p) * (1 - p) * a[0] + 2 * (1 - p) * p * c[0] + p * p * b[0],
  (1 - p) * (1 - p) * a[1] + 2 * (1 - p) * p * c[1] + p * p * b[1],
];
export const bezD = (a: Pt, c: Pt, b: Pt, p: number): Pt => [
  2 * (1 - p) * (c[0] - a[0]) + 2 * p * (b[0] - c[0]),
  2 * (1 - p) * (c[1] - a[1]) + 2 * p * (b[1] - c[1]),
];

/** The caster's cell (layout px) and how its art is drawn there. */
export type CasterCell = { ax: number; ay: number; aw: number; ah: number; facingRight: boolean; fromArt: boolean };

/** A drone's parked spot on the ship's art, and its size there; without art, the ship's centre. */
export function dockOf(box: DroneBox, c: CasterCell) {
  const [x, y, w] = box;
  const size = w * (c.aw / 256);
  if (!c.fromArt) return { x: c.ax + c.aw / 2, y: c.ay + c.ah / 2, size };
  const cx = x + w / 2;
  const cy = y + w / 2;
  // A ship facing right (the creator's side) has its art mirrored.
  return { x: c.ax + (c.facingRight ? 256 - cx : cx) * (c.aw / 256), y: c.ay + cy * (c.ah / 256), size };
}

/** Its horizontal scale: mirrored to look right, turning through a squash, never a snap. */
export function faceScale(d: DroneState, cellW: number) {
  return -clamp(d.face / (cellW * 0.15), -1, 1) || -1;
}
export const tiltOf = (d: DroneState, sx: number, max: number) => clamp(d.vel[1] * 0.004, -max, max) * Math.sign(sx);

/** A point on the drone (fractions of its art box, the art facing left). */
export function onDrone(d: DroneState, rel: readonly [number, number], cellW: number, maxTilt: number): Pt {
  const sx = faceScale(d, cellW);
  const tilt = tiltOf(d, sx, maxTilt);
  const lx = (rel[0] - 0.5) * d.size * sx;
  const ly = (rel[1] - 0.5) * d.size;
  return [d.pos[0] + lx * Math.cos(tilt) - ly * Math.sin(tilt), d.pos[1] + lx * Math.sin(tilt) + ly * Math.cos(tilt)];
}

/** The drone's own art, mirrored to its facing and tipped with its climb. */
export function drawDrone(ctx: CanvasRenderingContext2D, img: CanvasImageSource, d: DroneState, cellW: number, maxTilt: number) {
  const sx = faceScale(d, cellW);
  ctx.save();
  ctx.translate(d.pos[0], d.pos[1]);
  ctx.rotate(tiltOf(d, sx, maxTilt));
  ctx.scale(sx, 1);
  ctx.drawImage(img, -d.size / 2, -d.size / 2, d.size, d.size);
  ctx.restore();
}

/** A drone parked on its spot, exactly where the ship's art draws it. */
export function drawDocked(ctx: CanvasRenderingContext2D, img: CanvasImageSource, box: DroneBox, c: CasterCell) {
  const dock = dockOf(box, c);
  ctx.save();
  ctx.translate(dock.x, dock.y);
  ctx.scale(c.facingRight ? -1 : 1, 1);
  ctx.drawImage(img, -dock.size / 2, -dock.size / 2, dock.size, dock.size);
  ctx.restore();
}

/** Whether the ship's art has drones on it: Repair Drones (variant 1) or Attack Drones (variant 2), both special 2. */
export function hasDroneArt(ship: ShipVisual | undefined | null): boolean {
  return !!ship && Number(ship.equipment.special) === 2;
}

/** The ship drawn without its special's art (the drones). */
export function withoutSpecialArt<T extends ShipVisual>(ship: T): T {
  return { ...ship, equipment: { ...ship.equipment, special: 0 } };
}

// Each drone cut out of the art as its own image, cached by art and box.
const droneImageCache = new Map<string, { img: HTMLImageElement; ready: boolean; waiters: Array<() => void> }>();

function droneImage(art: string, box: DroneBox) {
  const key = `${box.join(",")}|${art}`;
  let entry = droneImageCache.get(key);
  if (!entry) {
    const img = new Image();
    const e = { img, ready: false, waiters: [] as Array<() => void> };
    img.onload = () => {
      e.ready = true;
      e.waiters.splice(0).forEach((w) => w());
    };
    const [x, y, w] = box;
    img.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${w}" width="96" height="96">${art}</svg>`)}`;
    if (droneImageCache.size > 64) droneImageCache.delete(droneImageCache.keys().next().value as string);
    droneImageCache.set(key, e);
    entry = e;
  }
  return entry;
}

/** Starts cutting the drones out early (the ship's on the board), so they're ready when a sortie starts. */
export function preloadDroneImages(art: string, boxes: readonly DroneBox[]) {
  boxes.forEach((b) => droneImage(art, b));
}

/** The drone images for `art`, once all have loaded (null until then). */
export function useDroneImages(art: string, boxes: readonly DroneBox[]): HTMLImageElement[] | null {
  const [, bump] = useState(0);
  const entries = boxes.map((b) => droneImage(art, b));
  const ready = entries.every((e) => e.ready);
  useLayoutEffect(() => {
    if (ready) return;
    let live = true;
    const done = () => {
      if (live && entries.every((e) => e.ready)) bump((n) => n + 1);
    };
    entries.forEach((e) => (e.ready ? null : e.waiters.push(done)));
    return () => {
      live = false;
    };
  });
  return ready ? entries.map((e) => e.img) : null;
}

/** The ship cells whose drones are out (`shipId:row:col`), on one board. */
export class DroneArtStore {
  private counts = new Map<string, number>();
  private listeners = new Set<() => void>();
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  has(key: string) {
    return (this.counts.get(key) ?? 0) > 0;
  }
  hold(key: string) {
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    this.listeners.forEach((l) => l());
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const n = (this.counts.get(key) ?? 1) - 1;
      if (n > 0) this.counts.set(key, n);
      else this.counts.delete(key);
      this.listeners.forEach((l) => l());
    };
  }
}

/** One per board (GameGrid, each cinematic panel). None: drones never hide the art. */
export const DroneArtContext = createContext<DroneArtStore | null>(null);

export const droneCellKey = (shipId: number, row: number, col: number) => `${shipId}:${row}:${col}`;

const NO_SUBSCRIBE = () => () => {};

/** Whether the ship drawn at this cell should leave out its drones (they're out flying). */
export function useDroneArtHidden(shipId: number | null | undefined, row: number, col: number): boolean {
  return useDroneArtHiddenIn(useContext(DroneArtContext), shipId, row, col);
}

/** The same, for the component that provides the board's store. */
export function useDroneArtHiddenIn(store: DroneArtStore | null, shipId: number | null | undefined, row: number, col: number): boolean {
  const key = shipId == null ? "" : droneCellKey(shipId, row, col);
  return useSyncExternalStore(
    store?.subscribe ?? NO_SUBSCRIBE,
    () => (store && key ? store.has(key) : false),
    () => false,
  );
}

/**
 * Takes the drones off the ship drawn at this cell while `enabled` (the
 * effect draws them instead). Returns whether it did: false with no board
 * store, so the effect leaves parked drones to the art. `onHeld` runs right
 * after, before the browser paints, so the effect can draw them in the same frame.
 */
export function useHoldDroneArt(
  enabled: boolean,
  shipId: number | null | undefined,
  row: number,
  col: number,
  onHeld?: () => void,
): boolean {
  const store = useContext(DroneArtContext);
  const active = enabled && !!store && shipId != null;
  useLayoutEffect(() => {
    if (!active || !store || shipId == null) return;
    const release = store.hold(droneCellKey(shipId, row, col));
    onHeld?.();
    return release;
    // onHeld is a fresh closure each render; only the cell matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, store, shipId, row, col]);
  return active;
}
