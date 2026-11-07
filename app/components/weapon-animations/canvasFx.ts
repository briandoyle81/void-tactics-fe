import type React from "react";
import { gridLayoutSize } from "./gridLayout";

// Shared pieces of the canvas weapon effects (the red laser, the railgun,
// missiles):
// one canvas over the grid, added onto the board (`FX_CANVAS_STYLE`), drawn
// in the grid's layout pixels at the resolution it's shown at, plus the
// drawing helpers the effects share. Effects draw only on this canvas: they
// never change the ship images or move the board, and they use no dark
// colours on the additive layer, which can't show them (solid bodies and
// smoke go on a second canvas drawn normally, FX_SOLID_CANVAS_STYLE).

/**
 * Effect sizes (beam widths, glows, sparks) are fractions of an "effect
 * cell" this many times the board's layout cell: they were tuned on
 * desktop's ~50 px cells as if on 120 px ones. A multiple, not a fixed
 * size, so they keep the same proportion to the ships on any board size
 * (phones lay the board out with ~23 px cells). Zoom needs nothing: it's a
 * CSS transform over the board and these canvases alike. Positions and
 * bodies are fractions of the real cell.
 */
export const FX_CELL_SCALE = 120 / 50;

/** The size an effect's sizes are fractions of, for a board cell this wide (layout px). */
export function fxCellSize(cellWidth: number) {
  return cellWidth * FX_CELL_SCALE;
}

/** The canvas's own style: over the grid, added onto the board. */
export const FX_CANVAS_STYLE: React.CSSProperties = {
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  mixBlendMode: "plus-lighter",
};

/**
 * A canvas drawn normally (solid shapes, smoke), for effects that need
 * more than light: put it under the FX_CANVAS_STYLE one and attach it with
 * `attachOverlayCanvas(grid, canvas, "normal")`.
 */
export const FX_SOLID_CANVAS_STYLE: React.CSSProperties = {
  left: 0,
  top: 0,
  width: 0,
  height: 0,
};

export type RGB = [number, number, number];

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** A standard normal sample. */
export function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** "r,g,b" between two colours, for an rgba() string. */
export function mixRgb(a: RGB, b: RGB, t: number) {
  const u = Math.max(0, Math.min(1, t));
  return `${Math.round(a[0] + (b[0] - a[0]) * u)},${Math.round(a[1] + (b[1] - a[1]) * u)},${Math.round(a[2] + (b[2] - a[2]) * u)}`;
}

export function radialGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stops: Array<[number, string]>,
) {
  if (!(r > 0)) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function strokeSegment(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  style: string,
) {
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

export function strokeRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  width: number,
  style: string,
) {
  if (!(r > 0)) return;
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** The aiming preview's hologram wrapper (GameGridOverlays): effects inside it draw in hologram green. */
export const WEAPON_HOLOGRAM_CLASS = "weapon-hologram";
/** A hologram canvas's resolution cap: a preview, and soft anyway. */
const HOLOGRAM_MAX_PIXEL_RATIO = 2;
/** Sprites (the drones) in a hologram: the look the preview's CSS filter used to give everything. */
const HOLOGRAM_SPRITE_FILTER = "grayscale(1) sepia(1) hue-rotate(72deg) saturate(7) brightness(1.25)";

const hologramColorCache = new Map<string, string>();

/**
 * A colour as the aiming preview's hologram shows it: phosphor green at the
 * colour's brightness, the brightest running to white, alpha kept. Accepts
 * rgb()/rgba() and hex; anything else (a named colour) is returned as is.
 */
export function hologramColor(css: string): string {
  const cached = hologramColorCache.get(css);
  if (cached) return cached;
  let r: number;
  let g: number;
  let b: number;
  let a = 1;
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(css);
  if (fn) {
    r = +fn[1];
    g = +fn[2];
    b = +fn[3];
    if (fn[4] != null) a = +fn[4];
  } else if (/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(css)) {
    const hex = css.length === 4 ? css.slice(1).replace(/./g, (c) => c + c) : css.slice(1);
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    if (hex.length === 8) a = parseInt(hex.slice(6, 8), 16) / 255;
  } else {
    return css;
  }
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const green = Math.min(1, lum * 1.6);
  const white = Math.max(0, (lum - 0.7) / 0.3);
  const out = `rgba(${Math.round(217 * white)},${Math.round(255 * green)},${Math.round(76 * green + 120 * white)},${a})`;
  if (hologramColorCache.size > 4096) hologramColorCache.clear();
  hologramColorCache.set(css, out);
  return out;
}

/**
 * A context that draws whatever an effect paints in hologram green: every
 * colour it sets (fill, stroke, shadow, gradient stops) goes through
 * hologramColor, and images get the hologram filter. The aiming preview used
 * to get this look from a CSS filter over its board-sized layer, which the
 * browser re-ran on every frame of a canvas effect (around 4x the frame time,
 * measured); recolouring at the source costs next to nothing.
 */
function hologramContext(real: CanvasRenderingContext2D): CanvasRenderingContext2D {
  const gradients = new WeakMap<object, CanvasGradient>();
  const wrapGradient = (gradient: CanvasGradient) => {
    const wrapper = { addColorStop: (offset: number, color: string) => gradient.addColorStop(offset, hologramColor(color)) };
    gradients.set(wrapper, gradient);
    return wrapper;
  };
  const methods = new Map<PropertyKey, unknown>();
  return new Proxy(real, {
    get(target, key) {
      const cached = methods.get(key);
      if (cached) return cached;
      let value: unknown;
      if (key === "createRadialGradient" || key === "createLinearGradient") {
        const create = target[key].bind(target) as (...args: number[]) => CanvasGradient;
        value = (...args: number[]) => wrapGradient(create(...args));
      } else if (key === "drawImage") {
        const draw = target.drawImage.bind(target) as (...args: unknown[]) => void;
        value = (...args: unknown[]) => {
          const before = target.filter;
          target.filter = HOLOGRAM_SPRITE_FILTER;
          draw(...args);
          target.filter = before;
        };
      } else {
        const own = Reflect.get(target, key, target);
        if (typeof own !== "function") return own;
        value = own.bind(target);
      }
      methods.set(key, value);
      return value;
    },
    set(target, key, value) {
      if (key === "fillStyle" || key === "strokeStyle" || key === "shadowColor") {
        value = typeof value === "string" ? hologramColor(value) : (gradients.get(value as object) ?? value);
      }
      return Reflect.set(target, key, value, target);
    },
  }) as CanvasRenderingContext2D;
}

/**
 * Sizes `canvas` to the grid's layout box (so it shares the grid's
 * coordinates, inside any pan/zoom transform) at the pixels it's actually
 * shown at, and keeps it sized. `begin()` clears it and returns the context
 * set up for layout pixels and additive drawing ("normal": ordinary drawing),
 * or null before it has a size. Inside the aiming preview's hologram wrapper
 * the context draws in hologram green (hologramContext), at most 2x resolution.
 */
export function attachOverlayCanvas(
  grid: HTMLElement,
  canvas: HTMLCanvasElement,
  mode: "add" | "normal" = "add",
) {
  const ctx = canvas.getContext("2d");
  const hologram = !!canvas.closest(`.${WEAPON_HOLOGRAM_CLASS}`);
  const drawCtx = ctx && hologram ? hologramContext(ctx) : ctx;
  let layoutW = 0;
  let layoutH = 0;
  let pixelRatio = 1;
  let checkedAt = 0;
  const ratioNow = (width: number) => {
    const scale = grid.getBoundingClientRect().width / Math.max(width, 1);
    return Math.min(hologram ? HOLOGRAM_MAX_PIXEL_RATIO : 3, (window.devicePixelRatio || 1) * Math.max(1, scale));
  };
  const resize = () => {
    const { width, height } = gridLayoutSize(grid);
    layoutW = width;
    layoutH = height;
    pixelRatio = ratioNow(width);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(grid);
  return {
    begin(): CanvasRenderingContext2D | null {
      if (!ctx || !drawCtx) return null;
      // Zoom is a transform, which a ResizeObserver doesn't see: re-check the
      // shown scale a few times a second and re-size when it has changed, so
      // the effect stays sharp after zooming in.
      const now = performance.now();
      if (now - checkedAt > 250) {
        checkedAt = now;
        if (layoutW && Math.abs(ratioNow(layoutW) - pixelRatio) / pixelRatio > 0.1) resize();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!layoutW || !layoutH) return null;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.globalCompositeOperation = mode === "add" ? "lighter" : "source-over";
      return drawCtx;
    },
    dispose() {
      ro.disconnect();
    },
  };
}
