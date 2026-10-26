import { describe, expect, it } from "vitest";
import { fleetBriefingStep } from "../FleetBriefing";
import { getRoguelikeRunRequirements } from "../../utils/roguelikeRunRequirements";

const req = (constructedCount: number) => getRoguelikeRunRequirements({ constructedCount, rosterCost: 0, costLimit: 100 });

describe("fleetBriefingStep", () => {
  it("claims with an empty hangar", () => {
    expect(fleetBriefingStep({ shipCount: 0, unconstructedCount: 0, requirements: req(0), rosterValid: false, canClaim: false })).toBe("claim");
  });

  it("claims with fewer than 10 ships (e.g. only the tutorial's)", () => {
    expect(fleetBriefingStep({ shipCount: 3, unconstructedCount: 0, requirements: req(3), rosterValid: false, canClaim: true })).toBe("claim");
    expect(fleetBriefingStep({ shipCount: 3, unconstructedCount: 2, requirements: req(1), rosterValid: false, canClaim: true })).toBe("claim");
  });

  it("builds what's there first when the claim isn't available", () => {
    expect(fleetBriefingStep({ shipCount: 3, unconstructedCount: 2, requirements: req(1), rosterValid: false, canClaim: false })).toBe("construct");
    expect(fleetBriefingStep({ shipCount: 3, unconstructedCount: 0, requirements: req(3), rosterValid: false, canClaim: false })).toBe("claim");
  });

  it("moves on at 10 or more ships", () => {
    expect(fleetBriefingStep({ shipCount: 12, unconstructedCount: 12, requirements: req(0), rosterValid: false, canClaim: true })).toBe("construct");
    expect(fleetBriefingStep({ shipCount: 12, unconstructedCount: 0, requirements: req(12), rosterValid: false, canClaim: true })).toBe("pick");
  });
});
