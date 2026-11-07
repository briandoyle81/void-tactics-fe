import { describe, expect, it } from "vitest";
import { LIGHTNING_FIELD_MS } from "../../../constants/animationTiming";
import { fieldLayoutFrom, newFieldRun, paintLightningField } from "../LightningFieldAnimation";

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

const box = (row: number, col: number) => ({ x: col * 50, y: row * 50, width: 50, height: 50 });
const withShips = fieldLayoutFrom(box, 5, 8, 2, [{ row: 5, col: 10 }, { row: 4, col: 9 }]);
const noShips = fieldLayoutFrom(box, 0, 0, 2, []);

describe("Lightning Field paint", () => {
  it("covers every cell in range, clipped to the board", () => {
    expect(withShips.cells.length).toBe(13);
    expect(noShips.cells.length).toBe(6);
    expect(noShips.edge.every((c) => c.d === 2)).toBe(true);
  });

  for (const [name, layout] of [["with ships in the field", withShips], ["in a corner, no ships", noShips]] as const) {
    it(`playback, ${name}: draws every frame without NaN, and nothing from the end of the storm`, () => {
      const run = newFieldRun(0, true);
      for (let t = 0; t < LIGHTNING_FIELD_MS; t += 8) {
        const { ctx, numbers } = recordingContext();
        expect(() => paintLightningField(ctx, run, t, layout, false)).not.toThrow();
        expect(numbers.every(Number.isFinite)).toBe(true);
      }
      const after = recordingContext();
      paintLightningField(after.ctx, run, LIGHTNING_FIELD_MS, layout, false);
      expect(after.numbers.length).toBe(0);
    });
  }

  it("aiming preview: repeats the storm", () => {
    const { ctx, numbers } = recordingContext();
    paintLightningField(ctx, newFieldRun(0, false), LIGHTNING_FIELD_MS * 2 + 600, withShips, false);
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.every(Number.isFinite)).toBe(true);
  });
});
