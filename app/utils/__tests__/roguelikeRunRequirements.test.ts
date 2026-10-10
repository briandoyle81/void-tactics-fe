import { describe, expect, it } from "vitest";
import {
  getRoguelikeRunRequirements,
  isRunEligibleConstructedShip,
} from "../roguelikeRunRequirements";

describe("getRoguelikeRunRequirements", () => {
  it("needs 10 constructed ships", () => {
    expect(getRoguelikeRunRequirements({ constructedCount: 9, rosterCost: 0, costLimit: 0 }).hasEnoughConstructed).toBe(false);
    expect(getRoguelikeRunRequirements({ constructedCount: 10, rosterCost: 0, costLimit: 0 }).hasEnoughConstructed).toBe(true);
  });

  it("needs a roster costing at least 80% of the cap, rounded up", () => {
    const below = getRoguelikeRunRequirements({ constructedCount: 10, rosterCost: 799, costLimit: 1000 });
    expect(below.minRosterCost).toBe(800);
    expect(below.meetsMinRosterCost).toBe(false);
    expect(getRoguelikeRunRequirements({ constructedCount: 10, rosterCost: 800, costLimit: 1000 }).meetsMinRosterCost).toBe(true);
    expect(getRoguelikeRunRequirements({ constructedCount: 10, rosterCost: 0, costLimit: 999 }).minRosterCost).toBe(800);
  });

  it("has no minimum cost when the campaign has no cap", () => {
    const r = getRoguelikeRunRequirements({ constructedCount: 10, rosterCost: 0, costLimit: 0 });
    expect(r.minRosterCost).toBe(0);
    expect(r.meetsMinRosterCost).toBe(true);
  });
});

describe("isRunEligibleConstructedShip", () => {
  const ship = { constructed: true, destroyed: false, variant: 2 };
  it("counts constructed, intact ships of the required faction", () => {
    expect(isRunEligibleConstructedShip(ship, 0)).toBe(true);
    expect(isRunEligibleConstructedShip(ship, 2)).toBe(true);
    expect(isRunEligibleConstructedShip(ship, 1)).toBe(false);
    expect(isRunEligibleConstructedShip({ ...ship, constructed: false }, 0)).toBe(false);
    expect(isRunEligibleConstructedShip({ ...ship, destroyed: true }, 0)).toBe(false);
  });
});
