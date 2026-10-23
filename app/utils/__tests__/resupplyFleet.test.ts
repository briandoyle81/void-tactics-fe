import { describe, expect, it } from "vitest";
import {
  isResupplyCandidate,
  markRosterAvailableForSelect,
  resupplyCostLimit,
  rosterModifyDiff,
} from "../resupplyFleet";

describe("resupplyCostLimit", () => {
  it("uses the override when the node raised the cap", () => {
    expect(resupplyCostLimit(400, 700)).toBe(700);
  });

  it("keeps the run cap when the node has no override", () => {
    expect(resupplyCostLimit(400, 0)).toBe(400);
  });
});

describe("rosterModifyDiff", () => {
  it("adds newly selected ships and drops deselected ones", () => {
    expect(rosterModifyDiff([1, 2, 3], [2, 4])).toEqual({ add: [4], remove: [1, 3] });
  });

  it("is empty when the selection matches the roster", () => {
    expect(rosterModifyDiff([1n, 2n], [1n, 2n])).toEqual({ add: [], remove: [] });
  });
});

describe("isResupplyCandidate", () => {
  const roster = new Set(["10"]);

  it("keeps current roster ships even when they are reserved", () => {
    expect(
      isResupplyCandidate(
        { id: "10", constructed: true, destroyed: false, inFleet: true, variant: 1 },
        roster,
        1,
      ),
    ).toBe(true);
  });

  it("hides other reserved ships and wrecks", () => {
    expect(
      isResupplyCandidate(
        { id: "11", constructed: true, destroyed: false, inFleet: true, variant: 1 },
        roster,
        1,
      ),
    ).toBe(false);
    expect(
      isResupplyCandidate(
        { id: "12", constructed: true, destroyed: true, inFleet: false, variant: 1 },
        roster,
        1,
      ),
    ).toBe(false);
  });
});

describe("markRosterAvailableForSelect", () => {
  it("clears inFleet on roster ships only", () => {
    const ships = markRosterAvailableForSelect(
      [
        { id: 10, shipData: { inFleet: true } },
        { id: 11, shipData: { inFleet: true } },
      ],
      new Set(["10"]),
    );
    expect(ships[0].shipData.inFleet).toBe(false);
    expect(ships[1].shipData.inFleet).toBe(true);
  });
});
