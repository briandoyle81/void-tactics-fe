import { describe, expect, it } from "vitest";
import { EMP_MS } from "../../../constants/animationTiming";
import { newEmpRun, paintEmp, type EmpLayout } from "../EmpWaveAnimation";

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

const across: EmpLayout = { ax: 25, ay: 75, tx: 175, ty: 25, cellW: 50, cellH: 50 };
const adjacent: EmpLayout = { ax: 125, ay: 75, tx: 75, ty: 75, cellW: 50, cellH: 50 };

describe("EMP paint", () => {
  for (const [name, layout] of [["3 across, 1 up", across], ["adjacent", adjacent]] as const) {
    it(`playback, ${name}: draws every frame without NaN, and nothing from the end of the pulse`, () => {
      const run = newEmpRun(0, true);
      for (let t = 0; t < EMP_MS; t += 8) {
        const { ctx, numbers } = recordingContext();
        expect(() => paintEmp(ctx, run, t, layout, false)).not.toThrow();
        expect(numbers.every(Number.isFinite)).toBe(true);
      }
      const after = recordingContext();
      paintEmp(after.ctx, run, EMP_MS, layout, false);
      expect(after.numbers.length).toBe(0);
    });
  }

  it("aiming preview: repeats the pulse", () => {
    const { ctx, numbers } = recordingContext();
    paintEmp(ctx, newEmpRun(0, false), 1500 * 3 + 600, across, false);
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.every(Number.isFinite)).toBe(true);
  });
});
