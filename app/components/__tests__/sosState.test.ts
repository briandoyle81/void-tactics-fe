import { describe, expect, it } from "vitest";
import { SOS_DRIFT_PERIOD_MS, sosDriftAt, sosDriftDelay, sosFailingLayout } from "../sosState";

const deg = (rad: number) => (rad * 180) / Math.PI;

describe("SOS drift", () => {
  it("sways 14.2 to 15.8 degrees and back over one period, as .sos-drift does", () => {
    expect(deg(sosDriftAt(0).rot)).toBeCloseTo(14.2, 5);
    expect(sosDriftAt(0).dy).toBeCloseTo(-0.006, 6);
    expect(deg(sosDriftAt(SOS_DRIFT_PERIOD_MS / 2).rot)).toBeCloseTo(15.8, 5);
    expect(sosDriftAt(SOS_DRIFT_PERIOD_MS / 2).dy).toBeCloseTo(0.006, 6);
    expect(deg(sosDriftAt(SOS_DRIFT_PERIOD_MS / 4).rot)).toBeCloseTo(15, 3);
    expect(deg(sosDriftAt(SOS_DRIFT_PERIOD_MS).rot)).toBeCloseTo(14.2, 5);
  });

  it("starts each ship's drift on the shared clock", () => {
    expect(sosDriftDelay(SOS_DRIFT_PERIOD_MS * 3 + 1234)).toBe("-1234ms");
  });
});

describe("SOS failing systems", () => {
  it("puts a ship's strobe and shorting points in the same places every time, on its hull", () => {
    const a = sosFailingLayout(42);
    expect(sosFailingLayout(42)).toEqual(a);
    expect(sosFailingLayout(43)).not.toEqual(a);
    expect(a.zaps).toHaveLength(2);
    for (const z of a.zaps) {
      expect(z.left).toBeGreaterThanOrEqual(18);
      expect(z.left).toBeLessThanOrEqual(82);
      expect(z.sparks).toHaveLength(3);
    }
  });
});
