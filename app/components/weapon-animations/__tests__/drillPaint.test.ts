import { describe, expect, it } from "vitest";
import { MINING_DRILL_MS } from "../../../constants/animationTiming";
import { newDrillRun, paintDrill, type DrillLayout } from "../MiningDrillAnimation";

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

const facingRight: DrillLayout = { ox: 36, oy: 65.5, ex: 175, ey: 25, cellW: 50, cellH: 50 };
const facingLeft: DrillLayout = { ox: 214, oy: 65.5, ex: 75, ey: 125, cellW: 50, cellH: 50 };

describe("Mining Drill paint", () => {
  for (const [side, layout] of [["facing right", facingRight], ["facing left", facingLeft]] as const) {
    it(`playback, ${side}: draws every frame without NaN, and nothing from the end of the burst`, () => {
      const run = newDrillRun(0, true);
      for (let t = 0; t < MINING_DRILL_MS; t += 8) {
        const { ctx, numbers } = recordingContext();
        expect(() => paintDrill(ctx, run, t, layout, false)).not.toThrow();
        expect(numbers.every(Number.isFinite)).toBe(true);
      }
      const after = recordingContext();
      paintDrill(after.ctx, run, MINING_DRILL_MS, layout, false);
      expect(after.numbers.length).toBe(0);
    });
  }

  it("aiming preview: keeps grinding", () => {
    const { ctx, numbers } = recordingContext();
    paintDrill(ctx, newDrillRun(0, false), 5000, facingRight, false);
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.every(Number.isFinite)).toBe(true);
  });
});
