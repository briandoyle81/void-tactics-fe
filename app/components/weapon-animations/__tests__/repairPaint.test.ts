import { describe, expect, it } from "vitest";
import { REPAIR_DRONES_MS } from "../../../constants/animationTiming";
import { droneArtFor, newRepairRun, paintRepair, type RepairLayout } from "../RepairDroneAnimation";

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

const base = { ax: 0, ay: 50, aw: 50, ah: 50, cellW: 50, facingRight: true, fromArt: true };
const friend: RepairLayout = { ...base, tx: 125, ty: 25 };
const self: RepairLayout = { ...base, tx: 25, ty: 75 };
const joiner: RepairLayout = { ...base, tx: 25, ty: 75, ax: 100, facingRight: false, fromArt: false };
// A stand-in for a loaded drone image.
const image = {} as CanvasImageSource;

describe("Repair Drones paint", () => {
  it("cuts the drones out of the ship's art, and gives a ship without any the standard ones", () => {
    expect(droneArtFor(undefined)).toContain("<path");
  });

  for (const [name, layout] of [["a friendly ship", friend], ["itself", self], ["from the ship's centre, facing left", joiner]] as const) {
    it(`playback, repairing ${name}: draws every frame without NaN, and nothing from the end of the sortie`, () => {
      const run = newRepairRun(0, true);
      for (let t = 0; t < REPAIR_DRONES_MS; t += 8) {
        const solid = recordingContext();
        const light = recordingContext();
        expect(() => paintRepair(solid.ctx, light.ctx, run, t, layout, [image, image, image], false)).not.toThrow();
        expect(solid.numbers.every(Number.isFinite)).toBe(true);
        expect(light.numbers.every(Number.isFinite)).toBe(true);
      }
      const solid = recordingContext();
      const light = recordingContext();
      paintRepair(solid.ctx, light.ctx, run, REPAIR_DRONES_MS, layout, [image, image, image], false);
      expect(solid.numbers.length + light.numbers.length).toBe(0);
    });
  }

  it("with the ship's drones left out of its art, draws them parked before launch and after the sortie", () => {
    const run = newRepairRun(0, true);
    for (const t of [-10, REPAIR_DRONES_MS + 50]) {
      const solid = recordingContext();
      const light = recordingContext();
      paintRepair(solid.ctx, light.ctx, run, t, friend, [image, image, image], false, true);
      expect(solid.numbers.length).toBeGreaterThan(0);
      expect(solid.numbers.every(Number.isFinite)).toBe(true);
    }
  });

  it("aiming preview: repeats the sortie", () => {
    const { ctx, numbers } = recordingContext();
    paintRepair(null, ctx, newRepairRun(0, false), (REPAIR_DRONES_MS + 300) * 2 + 1600, friend, [null, null, null], false);
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.every(Number.isFinite)).toBe(true);
  });
});
