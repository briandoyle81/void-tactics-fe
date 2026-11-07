import { describe, expect, it } from "vitest";
import { RETREAT_MS } from "../../../constants/animationTiming";
import { RETREAT_END_MS, RETREAT_JUMP_MS, RETREAT_TURN_MS, afterimageAt, paintRetreat, retreatPose, type RetreatLayout } from "../RetreatAnimation";

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

const creator: RetreatLayout = { x: 175, y: 75, cell: 50, creator: true, tilt: (15 * Math.PI) / 180, bob: 0 };
// Mid-sway, as the board might have it.
const joiner: RetreatLayout = { x: 125, y: 125, cell: 23, creator: false, tilt: (14.6 * Math.PI) / 180, bob: -0.004 };

describe("Retreat", () => {
  it("is over within the retreat's slot", () => {
    expect(RETREAT_END_MS).toBeLessThanOrEqual(RETREAT_MS);
  });

  for (const [name, L] of [["creator", creator], ["joiner, phone-sized cells", joiner]] as const) {
    for (const reduced of [false, true]) {
      it(`${name}${reduced ? ", reduced motion" : ""}: draws every frame without NaN, and nothing once it's over`, () => {
        for (let t = 0; t < RETREAT_END_MS; t += 8) {
          const { ctx, numbers } = recordingContext();
          expect(() => paintRetreat(ctx, t, L, 5, reduced)).not.toThrow();
          expect(numbers.every(Number.isFinite)).toBe(true);
          const P = retreatPose(t, L, reduced);
          expect([P.x, P.y, P.sx, P.sy, P.rot, P.alpha].every(Number.isFinite)).toBe(true);
        }
        const after = recordingContext();
        paintRetreat(after.ctx, RETREAT_END_MS, L, 5, reduced);
        expect(after.numbers.length).toBe(0);
      });
    }

    it(`${name}: starts as the board draws it disabled, turns, levels out and jumps to its own side`, () => {
      const start = retreatPose(0, L, false);
      expect(start).toMatchObject({ x: L.x, y: L.y + L.bob * L.cell, rot: L.tilt, alpha: 1 });
      expect(start.sx).toBe(L.creator ? -1 : 1);
      expect(Math.sign(retreatPose(RETREAT_TURN_MS, L, false).sx)).toBe(L.creator ? 1 : -1);
      expect(retreatPose(1400, L, false).rot).toBeCloseTo(0, 5);
      const gone = retreatPose(RETREAT_JUMP_MS + 180, L, false);
      expect(gone.alpha).toBe(0);
      expect(Math.sign(gone.x - L.x)).toBe(L.creator ? -1 : 1);
      expect(afterimageAt(RETREAT_JUMP_MS + 100, 0, false)).not.toBeNull();
      expect(afterimageAt(RETREAT_JUMP_MS + 100, 0, true)).toBeNull();
    });
  }
});
