import { describe, expect, it } from "vitest";
import { RAILGUN_IMPACT_DURATION_MS } from "../../../constants/animationTiming";
import { newShot, paintShot, type Layout } from "../RailgunShootingAnimation";

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

const rightLayout: Layout = { ox: 40, oy: 70, tcx: 300, tcy: 120, cellW: 50, cellH: 50, face: 1 };
const facingLeft: Layout = { ox: 210, oy: 70, tcx: -50, tcy: 120, cellW: 50, cellH: 50, face: -1 };

describe("railgun paint", () => {
  for (const [name, la, layout] of [["Railgun", false, rightLayout], ["Linear Accelerator", true, rightLayout], ["Linear Accelerator facing left", true, facingLeft]] as const) {
    it(`${name}: draws every frame without NaN, and nothing after the impact`, () => {
      const shot = newShot(0, layout, la, false, false);
      expect(shot.hit).toBeGreaterThan(shot.launch);
      for (let t = 0; t <= shot.hit + RAILGUN_IMPACT_DURATION_MS; t += 8) {
        const { ctx, numbers } = recordingContext();
        expect(() => paintShot(ctx, shot, t, layout, la)).not.toThrow();
        expect(numbers.every(Number.isFinite)).toBe(true);
      }
      const { ctx, numbers } = recordingContext();
      paintShot(ctx, shot, shot.hit + RAILGUN_IMPACT_DURATION_MS + 1, layout, la);
      expect(numbers).toHaveLength(0);
    });
  }
});
