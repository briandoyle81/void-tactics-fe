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

/**
 * Sizes `canvas` to the grid's layout box (so it shares the grid's
 * coordinates, inside any pan/zoom transform) at the pixels it's actually
 * shown at, and keeps it sized. `begin()` clears it and returns the context
 * set up for layout pixels and additive drawing ("normal": ordinary drawing),
 * or null before it has a size.
 */
export function attachOverlayCanvas(
  grid: HTMLElement,
  canvas: HTMLCanvasElement,
  mode: "add" | "normal" = "add",
) {
  const ctx = canvas.getContext("2d");
  let layoutW = 0;
  let layoutH = 0;
  let pixelRatio = 1;
  let checkedAt = 0;
  const ratioNow = (width: number) => {
    const shown = grid.getBoundingClientRect().width / Math.max(width, 1);
    return Math.min(3, (window.devicePixelRatio || 1) * Math.max(1, shown));
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
      if (!ctx) return null;
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
      return ctx;
    },
    dispose() {
      ro.disconnect();
    },
  };
}
