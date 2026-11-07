import { describe, expect, it } from "vitest";
import { FLAK_MS } from "../../../constants/animationTiming";
import { flakArrayFor, paintFlak, planFlak, type FlakLayout } from "../FlakExplosionAnimation";

// A canvas context that records every numeric argument it's drawn with.
function recordingContext() {
  const numbers: number[] = [];
  const record = (...args: unknown[]) => {
    for (const a of args) if (typeof a === "number") numbers.push(a);
  };
  const gradient = { addColorStop: record };
  const ctx = new Proxy(
    {},
    {
      get: (_t, key) =>
        key === "createRadialGradient" || key === "createLinearGradient"
          ? (...args: unknown[]) => (record(...args), gradient)
          : (...args: unknown[]) => record(...args),
      set: (_t, key, value) => {
        if (key === "lineWidth") record(value);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, numbers };
}

const attacker = { row: 5, col: 8 };
function diamond(range: number) {
  const cells: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < 11; r++) for (let c = 0; c < 17; c++) {
    const d = Math.abs(r - attacker.row) + Math.abs(c - attacker.col);
    if (d > 0 && d <= range) cells.push({ row: r, col: c });
  }
  return cells;
}

describe("flak paint", () => {
  for (const facingRight of [true, false]) {
    it(`playback, facing ${facingRight ? "right" : "left"}: draws every frame without NaN, and nothing from ${FLAK_MS} ms`, () => {
      const layout: FlakLayout = { cellW: 50, cellH: 50, ax: 425, ay: 275, face: facingRight ? 1 : -1 };
      const shells = planFlak(0, diamond(2), attacker, facingRight, 50, 50, false);
      expect(shells.length).toBeGreaterThan(0);
      for (let t = 0; t < FLAK_MS; t += 10) {
        const solid = recordingContext();
        const light = recordingContext();
        expect(() => paintFlak(solid.ctx, light.ctx, shells, t, layout, FLAK_MS)).not.toThrow();
        expect([...solid.numbers, ...light.numbers].every(Number.isFinite)).toBe(true);
      }
      const solid = recordingContext();
      const light = recordingContext();
      paintFlak(solid.ctx, light.ctx, shells, FLAK_MS, layout, FLAK_MS);
      expect(solid.numbers.length + light.numbers.length).toBe(0);
    });

    it(`the four arrays share the range evenly, facing ${facingRight ? "right" : "left"}`, () => {
      for (const [range, expected] of [[1, [1, 1, 1, 1]], [2, [3, 3, 3, 3]]] as const) {
        const counts = [0, 0, 0, 0];
        for (const cell of diamond(range)) counts[flakArrayFor(attacker, cell, facingRight)]++;
        expect(counts).toEqual(expected);
      }
    });
  }

  it("the front array covers the tiles ahead of the ship, whichever way it faces", () => {
    expect(flakArrayFor(attacker, { row: 5, col: 10 }, true)).toBe(3);
    expect(flakArrayFor(attacker, { row: 5, col: 6 }, false)).toBe(3);
    expect(flakArrayFor(attacker, { row: 5, col: 6 }, true)).toBe(0);
  });
});
