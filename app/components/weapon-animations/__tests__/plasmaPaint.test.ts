import { describe, expect, it } from "vitest";
import { PLASMA_BURST_MS } from "../../../constants/animationTiming";
import { newPlasmaStream, paintPlasma, type PlasmaLayout } from "../PlasmaShootingAnimation";

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

const facingRight: PlasmaLayout = { ox: 29.5, oy: 67, cx: 175, cy: 25, cellW: 50, cellH: 50 };
const facingLeft: PlasmaLayout = { ox: 220.5, oy: 67, cx: 75, cy: 125, cellW: 50, cellH: 50 };

describe("plasma paint", () => {
  for (const [side, layout] of [["facing right", facingRight], ["facing left", facingLeft]] as const) {
    it(`playback, ${side}: draws every frame without NaN, and nothing from the end of the burst`, () => {
      const stream = newPlasmaStream(0, true);
      for (let t = 0; t < PLASMA_BURST_MS; t += 8) {
        const { ctx, numbers } = recordingContext();
        expect(() => paintPlasma(ctx, stream, t, layout, false)).not.toThrow();
        expect(numbers.every(Number.isFinite)).toBe(true);
      }
      // The last plasma has landed and cooled just before the slot ends.
      const nearEnd = recordingContext();
      paintPlasma(nearEnd.ctx, stream, PLASMA_BURST_MS - 1, layout, false);
      expect(nearEnd.numbers.length).toBe(0);
    });
  }

  it("aiming preview: keeps streaming", () => {
    const stream = newPlasmaStream(0, false);
    const { ctx, numbers } = recordingContext();
    paintPlasma(ctx, stream, 6000, facingRight, false);
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.every(Number.isFinite)).toBe(true);
  });
});
