import { describe, expect, it } from "vitest";
import { unclaimedScoringPositions, withoutClaimedTiles } from "../claimedScoringTiles";

const tiles = [
  { row: 1, col: 1, points: 10, onlyOnce: true },
  { row: 2, col: 2, points: 5, onlyOnce: false },
];

describe("unclaimedScoringPositions", () => {
  it("drops one-time tiles this game has claimed", () => {
    expect(unclaimedScoringPositions(tiles, [{ row: 1, col: 1 }])).toEqual([tiles[1]]);
  });

  it("keeps reusable tiles even if listed, and everything when nothing is claimed", () => {
    expect(unclaimedScoringPositions(tiles, [{ row: 2, col: 2 }])).toEqual(tiles);
    expect(unclaimedScoringPositions(tiles, undefined)).toEqual(tiles);
  });
});

describe("withoutClaimedTiles", () => {
  it("empties the claimed tiles in a copy of the grid", () => {
    const grid = [
      [0, 0],
      [0, 10],
    ];
    expect(withoutClaimedTiles(grid, [{ row: 1, col: 1 }], 0)).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(grid[1][1]).toBe(10);
  });
});
