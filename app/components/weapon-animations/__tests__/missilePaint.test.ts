import { describe, expect, it } from "vitest";
import { MISSILE_IMPACT_DURATION_MS, TORPEDO_IMPACT_DURATION_MS } from "../../../constants/animationTiming";
import { newVolley, paintVolley, type MissileLayout } from "../MissileShootingAnimation";

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

const facingRight: MissileLayout = { ox: 21, oy: 67, tcx: 225, tcy: 125, cellW: 50, cellH: 50 };
const facingLeft: MissileLayout = { ox: 229, oy: 67, tcx: 25, tcy: 125, cellW: 50, cellH: 50 };

describe("missile paint", () => {
  for (const [name, torpedo, impactMs] of [["Missile Launcher", false, MISSILE_IMPACT_DURATION_MS], ["Torpedo Launcher", true, TORPEDO_IMPACT_DURATION_MS]] as const) {
    for (const [side, layout] of [["facing right", facingRight], ["facing left", facingLeft]] as const) {
      it(`${name}, ${side}: draws every frame without NaN, and nothing after the last impact`, () => {
        const volley = newVolley(0, layout, torpedo, false, false);
        expect(volley).toHaveLength(torpedo ? 1 : 2);
        const end = Math.max(...volley.map((m) => m.hit)) + impactMs;
        for (let t = 0; t < end; t += 8) {
          const solid = recordingContext();
          const light = recordingContext();
          expect(() => paintVolley(solid.ctx, light.ctx, volley, t, layout.cellW, torpedo)).not.toThrow();
          expect([...solid.numbers, ...light.numbers].every(Number.isFinite)).toBe(true);
        }
        const solid = recordingContext();
        const light = recordingContext();
        paintVolley(solid.ctx, light.ctx, volley, end + 1, layout.cellW, torpedo);
        expect(solid.numbers.length + light.numbers.length).toBe(0);
      });
    }
  }

  it("ejects up the screen whichever way the ship faces", () => {
    for (const layout of [facingRight, facingLeft]) {
      const [m] = newVolley(0, layout, false, false, false);
      expect(Math.sin(m.driftDir)).toBeLessThan(0);
    }
  });
});
