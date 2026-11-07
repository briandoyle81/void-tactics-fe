import { describe, expect, it } from "vitest";
import { RAM_HIT_MS, RAM_MS } from "../../../constants/animationTiming";
import { BOARD_RAM_TIMING, paintRamLight, rammerAt, victimAt, type RamLayout } from "../RamAnimation";

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

const TILT = (15 * Math.PI) / 180;
const ahead: RamLayout = { from: { x: 75, y: 75 }, to: { x: 125, y: 75 }, cell: 50, facingRight: true, victimTilt: TILT, victimBob: 0 };
const up: RamLayout = { from: { x: 125, y: 125 }, to: { x: 125, y: 75 }, cell: 50, facingRight: true, victimTilt: TILT, victimBob: 0 };
const left: RamLayout = { from: { x: 125, y: 75 }, to: { x: 75, y: 75 }, cell: 50, facingRight: false, victimTilt: TILT, victimBob: 0 };

describe("Ram", () => {
  it("hits at RAM_HIT_MS and is over by RAM_MS", () => {
    expect(BOARD_RAM_TIMING.windupMs + BOARD_RAM_TIMING.chargeMs).toBe(RAM_HIT_MS);
    expect(RAM_HIT_MS + BOARD_RAM_TIMING.followMs).toBeLessThanOrEqual(RAM_MS);
  });

  for (const [name, L] of [["ahead", ahead], ["upward", up], ["leftward", left]] as const) {
    it(`${name}: draws every frame without NaN, and nothing once it's over`, () => {
      for (let f = 0; f < RAM_MS; f += 8) {
        for (const withVictim of [true, false]) {
          const { ctx, numbers } = recordingContext();
          expect(() => paintRamLight(ctx, f, L, BOARD_RAM_TIMING, 3, false, withVictim)).not.toThrow();
          expect(numbers.every(Number.isFinite)).toBe(true);
        }
      }
      const after = recordingContext();
      paintRamLight(after.ctx, RAM_MS, L, BOARD_RAM_TIMING, 3, false, true);
      expect(after.numbers.length).toBe(0);
    });

    it(`${name}: the rammer backs off, meets the victim on the hit and ends on its tile; the victim is gone`, () => {
      const dir = { x: Math.sign(L.to.x - L.from.x), y: Math.sign(L.to.y - L.from.y) };
      const along = (p: { x: number; y: number }) => (p.x - L.from.x) * dir.x + (p.y - L.from.y) * dir.y;
      expect(along(rammerAt(BOARD_RAM_TIMING.windupMs, L, BOARD_RAM_TIMING, false))).toBeLessThan(0);
      expect(along(rammerAt(RAM_HIT_MS, L, BOARD_RAM_TIMING, false))).toBeGreaterThan(0);
      expect(rammerAt(RAM_MS, L, BOARD_RAM_TIMING, false)).toEqual(L.to);
      expect(victimAt(0, L, BOARD_RAM_TIMING, false)).toMatchObject({ x: L.to.x, y: L.to.y, alpha: 1 });
      expect(victimAt(RAM_MS, L, BOARD_RAM_TIMING, false)).toBeNull();
    });
  }

  it("reduced motion: no back-off", () => {
    expect(rammerAt(100, ahead, BOARD_RAM_TIMING, true).x).toBeGreaterThanOrEqual(ahead.from.x);
  });
});
