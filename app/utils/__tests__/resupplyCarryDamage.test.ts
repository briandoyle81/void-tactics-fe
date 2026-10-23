import { describe, expect, it } from "vitest";
import { carryRosterDamage, parseDroppedShipDamage } from "../resupplyFleet";

describe("carryRosterDamage", () => {
  it("remembers a dropped ship's damage", () => {
    const { dropped, addedDamage } = carryRosterDamage({}, [{ shipId: 4, hp: 22 }], []);
    expect(dropped).toEqual({ "4": 22 });
    expect(addedDamage.size).toBe(0);
  });

  it("brings the damage back when the ship is re-added", () => {
    const { dropped, addedDamage } = carryRosterDamage({ "4": 22 }, [], [4, 9]);
    expect(addedDamage.get(4)).toBe(22);
    expect(addedDamage.get(9)).toBe(0);
    expect(dropped).toEqual({});
  });

  it("doesn't record an undamaged ship", () => {
    expect(carryRosterDamage({}, [{ shipId: 2, hp: 0 }], []).dropped).toEqual({});
  });
});

describe("parseDroppedShipDamage", () => {
  it("keeps positive numbers only", () => {
    expect(parseDroppedShipDamage({ "4": 22, "5": 0, "6": "x" })).toEqual({ "4": 22 });
    expect(parseDroppedShipDamage(null)).toEqual({});
    expect(parseDroppedShipDamage([1])).toEqual({});
  });
});
