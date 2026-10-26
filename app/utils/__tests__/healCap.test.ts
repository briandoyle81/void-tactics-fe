import { describe, expect, it } from "vitest";
import { canBeRepaired, healCapHull, hullAfterRepair, repairAmount } from "../healCap";

describe("heal cap", () => {
  it("caps at 80% of max hull, rounded down", () => {
    expect(healCapHull(100)).toBe(80);
    expect(healCapHull(115)).toBe(92);
  });

  it("a ship at or above the cap can't be repaired", () => {
    expect(canBeRepaired({ hullPoints: 79, maxHullPoints: 100 })).toBe(true);
    expect(canBeRepaired({ hullPoints: 80, maxHullPoints: 100 })).toBe(false);
    expect(canBeRepaired({ hullPoints: 95, maxHullPoints: 100 })).toBe(false);
    expect(canBeRepaired({ hullPoints: 0, maxHullPoints: 100 })).toBe(true);
  });

  it("repairs up to the cap, not max hull", () => {
    expect(repairAmount({ hullPoints: 60, maxHullPoints: 100 }, 50)).toBe(20);
    expect(repairAmount({ hullPoints: 10, maxHullPoints: 100 }, 50)).toBe(50);
    expect(repairAmount({ hullPoints: 90, maxHullPoints: 100 }, 50)).toBe(0);
    expect(hullAfterRepair({ hullPoints: 90, maxHullPoints: 100 }, 50)).toBe(90);
  });
});
