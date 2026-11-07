import { describe, expect, it } from "vitest";
import { LASER_TRACE_PERIOD_MS } from "../../../constants/animationTiming";
import { newMiningLaserRun, paintMiningLaser, type MiningLaserLayout } from "../LaserShootingAnimation";

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

const facingRight: MiningLaserLayout = { ox: 41.5, oy: 65.5, cx: 175, cy: 25, cellW: 50, cellH: 50 };
const facingLeft: MiningLaserLayout = { ox: 208.5, oy: 65.5, cx: 75, cy: 125, cellW: 50, cellH: 50 };

describe("Mining Laser paint", () => {
  for (const [side, layout] of [["facing right", facingRight], ["facing left", facingLeft]] as const) {
    it(`playback, ${side}: draws every frame without NaN, and nothing once the burn has cooled`, () => {
      const run = newMiningLaserRun(0, true);
      for (let t = 0; t < LASER_TRACE_PERIOD_MS; t += 8) {
        const { ctx, numbers } = recordingContext();
        expect(() => paintMiningLaser(ctx, run, t, layout, false)).not.toThrow();
        expect(numbers.every(Number.isFinite)).toBe(true);
      }
      const after = recordingContext();
      paintMiningLaser(after.ctx, run, LASER_TRACE_PERIOD_MS, layout, false);
      expect(after.numbers.length).toBe(0);
    });
  }

  it("aiming preview: keeps burning across several wander paths", () => {
    const run = newMiningLaserRun(0, false);
    for (let t = 50; t <= 4 * LASER_TRACE_PERIOD_MS; t += 50) {
      const { ctx, numbers } = recordingContext();
      paintMiningLaser(ctx, run, t, facingRight, false);
      expect(numbers.length).toBeGreaterThan(0);
      expect(numbers.every(Number.isFinite)).toBe(true);
    }
  });
});
