import { describe, expect, it } from "vitest";
import { findRamStagingTile } from "../gameGridRangesWeb2";

const current = { row: 5, col: 5 };
const target = { row: 5, col: 8 };

describe("findRamStagingTile", () => {
  it("stays put when the target is already in range", () => {
    expect(
      findRamStagingTile({ current, moveTiles: [{ row: 5, col: 6 }], target: { row: 5, col: 6 }, range: 1 }),
    ).toEqual(current);
  });

  it("takes the shortest legal move that ends within range, never the target's own tile", () => {
    const moveTiles = [
      { row: 5, col: 6 },
      { row: 5, col: 7 }, // adjacent to target, 2 away
      { row: 4, col: 8 }, // adjacent to target, 4 away
    ];
    expect(findRamStagingTile({ current, moveTiles, target, range: 1 })).toEqual({ row: 5, col: 7 });
  });

  it("keeps an already-proposed move that works", () => {
    const moveTiles = [
      { row: 5, col: 7 },
      { row: 4, col: 8 },
    ];
    expect(findRamStagingTile({ current, moveTiles, target, range: 1, preferred: { row: 4, col: 8 } })).toEqual({
      row: 4,
      col: 8,
    });
  });

  it("ignores a proposed move that isn't a legal destination (e.g. the target's tile)", () => {
    expect(
      findRamStagingTile({ current, moveTiles: [{ row: 5, col: 7 }], target, range: 1, preferred: target }),
    ).toEqual({ row: 5, col: 7 });
  });

  it("returns null when no legal tile is within range", () => {
    expect(findRamStagingTile({ current, moveTiles: [{ row: 5, col: 6 }], target, range: 1 })).toBeNull();
  });
});
