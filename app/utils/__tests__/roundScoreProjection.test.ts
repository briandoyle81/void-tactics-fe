import { describe, expect, it } from "vitest";
import { formatScore, projectRoundPoints } from "../roundScoreProjection";

const scoringGrid = [
  [0, 5, 0],
  [10, 0, 3],
];
const hull: Record<number, number> = { 1: 50, 2: 0, 3: 40, 4: 30 };

describe("projectRoundPoints", () => {
  const positions = [
    { shipId: 1, position: { row: 0, col: 1 }, isCreator: true }, // 5
    { shipId: 2, position: { row: 1, col: 0 }, isCreator: true }, // disabled on 10
    { shipId: 3, position: { row: 1, col: 2 }, isCreator: false }, // 3
    { shipId: 4, position: { row: 0, col: 0 }, isCreator: false }, // no points
  ];

  it("adds each side's ships on scoring tiles, skipping disabled ships", () => {
    expect(projectRoundPoints({ shipPositions: positions, scoringGrid, hullPointsOf: (id) => hull[id] })).toEqual({
      creator: 5,
      joiner: 3,
    });
  });

  it("skips ships off the board and previews", () => {
    const off = [
      { ...positions[0], status: 1 },
      { ...positions[2], isPreview: true },
    ];
    expect(projectRoundPoints({ shipPositions: off, scoringGrid, hullPointsOf: (id) => hull[id] })).toEqual({
      creator: 0,
      joiner: 0,
    });
  });
});

describe("formatScore", () => {
  it("shows round points in brackets only when there are some", () => {
    expect(formatScore(32, 10)).toBe("32(+10)");
    expect(formatScore(32, 0)).toBe("32");
    expect(formatScore(32)).toBe("32");
  });
});
