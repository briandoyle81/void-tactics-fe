import { describe, expect, it } from "vitest";
import { describeTile, tileTooltipLabel, type TileTooltipInput } from "../tileTooltip";

const empty: TileTooltipInput = {
  isMovementTile: false,
  isImpassable: false,
  scoringPoints: 0,
  onlyOnce: false,
  blocksLineOfSight: false,
  isShootingTile: false,
  isAssistableTarget: false,
  isValidTarget: false,
};

describe("describeTile", () => {
  it("says nothing about plain empty space", () => {
    expect(describeTile(empty)).toBeNull();
  });

  it("names deposits with their points", () => {
    expect(describeTile({ ...empty, scoringPoints: 5 })).toMatchObject({ title: "Gold Deposit", details: ["5 points"], tone: "gold" });
    expect(describeTile({ ...empty, scoringPoints: 10, onlyOnce: true })).toMatchObject({
      title: "Crystal Deposit",
      details: ["10 points, pays out once"],
      tone: "crystal",
    });
  });

  it("adds terrain effects under a deposit", () => {
    expect(describeTile({ ...empty, scoringPoints: 5, isImpassable: true })?.details).toEqual([
      "5 points",
      "Impassable: ships can't enter",
    ]);
  });

  it("names nebulae and hazards", () => {
    expect(describeTile({ ...empty, blocksLineOfSight: true })).toMatchObject({ title: "Nebula", tone: "nebula" });
    expect(describeTile({ ...empty, isImpassable: true })).toMatchObject({ title: "Hazard", tone: "hazard" });
  });

  it("leads with Move here on a reachable tile", () => {
    expect(describeTile({ ...empty, isMovementTile: true })).toMatchObject({ title: "Open Space", action: "Move here" });
    expect(describeTile({ ...empty, isMovementTile: true, blocksLineOfSight: true })).toMatchObject({
      title: "Nebula",
      action: "Move here",
    });
  });

  it("reads as one line for screen readers", () => {
    const tip = describeTile({ ...empty, isMovementTile: true, scoringPoints: 5 })!;
    expect(tileTooltipLabel(tip)).toBe("Move here. Gold Deposit. 5 points");
  });
});
