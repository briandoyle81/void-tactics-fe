import { describe, expect, it } from "vitest";
import { mapProblems } from "../mapProblems";
import { MapMode } from "../../types/types";

const map = (id: number, mode: MapMode, blocked: [number, number][]) => ({
  id,
  mode,
  blockedPositions: blocked.map(([row, col]) => ({ row, col })),
  impassablePositions: [],
  scoringPositions: [],
});

describe("mapProblems", () => {
  // Ids with no tile art in app/data/content/mapTileArt.ts.
  it("flags duplicate terrain, missing fleets and unused PvE maps", () => {
    const maps = [
      map(166, MapMode.PvP, [[0, 0]]),
      map(167, MapMode.PvE, [[1, 1], [2, 2]]),
      map(168, MapMode.PvE, [[2, 2], [1, 1]]),
      map(169, MapMode.PvP, [[5, 5]]),
    ];
    const usage = {
      fleetSizeByMapId: new Map([[168, 5]]),
      missionCountByMapId: new Map([[168, 1], [169, 2]]),
    };
    const problems = mapProblems(maps, usage);
    expect(problems.get(166)).toBeUndefined();
    expect(problems.get(167)).toEqual(["Same terrain as map #168", "No enemy fleet", "No mission uses it"]);
    expect(problems.get(168)).toEqual(["Same terrain as map #167"]);
    expect(problems.get(169)).toEqual(["2 missions fought here, but no enemy fleet"]);
  });

  it("flags tile art that doesn't fit the map's tiles", () => {
    // Map 68's space dock needs rows 4–6, cols 12–14 blocked and impassable.
    expect(mapProblems([map(68, MapMode.PvE, [])]).get(68)).toEqual([
      "Space dock art (rows 4–6, cols 12–14) needs blocked and impassable tiles, 9 differ",
    ]);
  });

  it("only checks terrain without usage data", () => {
    expect(mapProblems([map(1, MapMode.PvE, [])]).size).toBe(0);
  });
});
