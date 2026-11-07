import { describe, expect, it } from "vitest";
import { ATTACK_DRONES_MS } from "../../../constants/animationTiming";
import { attackDroneArtFor, newAttackRun, paintAttackDrones, type AttackLayout } from "../AttackDroneAnimation";
import { DroneArtStore } from "../droneArt";

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
const near: AttackLayout = { ...base, tx: 125, ty: 25 };
const adjacent: AttackLayout = { ...base, tx: 75, ty: 75, facingRight: false, fromArt: false };
const image = {} as CanvasImageSource;
const nine = Array.from({ length: 9 }, () => image);

describe("Attack Drones paint", () => {
  it("cuts the drones out of the ship's art, and gives a ship without any the standard ones", () => {
    expect(attackDroneArtFor(undefined)).toContain("<path");
  });

  for (const [name, layout] of [["2 across, 1 up", near], ["adjacent, from the ship's centre, facing left", adjacent]] as const) {
    it(`playback, ${name}: draws every frame without NaN, and only parked drones from the end of the sortie`, () => {
      const run = newAttackRun(0, true);
      for (let t = 0; t < ATTACK_DRONES_MS; t += 8) {
        const solid = recordingContext();
        const light = recordingContext();
        expect(() => paintAttackDrones(solid.ctx, light.ctx, run, t, layout, nine, false, true)).not.toThrow();
        expect(solid.numbers.every(Number.isFinite)).toBe(true);
        expect(light.numbers.every(Number.isFinite)).toBe(true);
      }
      const solid = recordingContext();
      const light = recordingContext();
      paintAttackDrones(solid.ctx, light.ctx, run, ATTACK_DRONES_MS, layout, nine, false, false);
      expect(solid.numbers.length + light.numbers.length).toBe(0);
      paintAttackDrones(solid.ctx, light.ctx, run, ATTACK_DRONES_MS, layout, nine, false, true);
      expect(solid.numbers.length).toBeGreaterThan(0);
      expect(light.numbers.length).toBe(0);
    });
  }

  it("aiming preview: repeats the sortie", () => {
    const { ctx, numbers } = recordingContext();
    paintAttackDrones(null, ctx, newAttackRun(0, false), (ATTACK_DRONES_MS + 300) * 2 + 1500, near, null, false);
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.every(Number.isFinite)).toBe(true);
  });
});

describe("DroneArtStore", () => {
  it("hides a cell's drones while any sortie holds it", () => {
    const store = new DroneArtStore();
    let calls = 0;
    store.subscribe(() => calls++);
    const a = store.hold("7:1:0");
    const b = store.hold("7:1:0");
    expect(store.has("7:1:0")).toBe(true);
    a();
    a();
    expect(store.has("7:1:0")).toBe(true);
    b();
    expect(store.has("7:1:0")).toBe(false);
    expect(calls).toBe(4);
  });
});
