import { describe, expect, it } from "vitest";
import {
  buildTileArtGrid,
  mapTileArtFor,
  mapTileArtProblems,
  nodeTileArtFor,
  tileArtProblem,
  type MapTileArt,
} from "../mapTileArt";

const DOCK: MapTileArt = {
  src: "/img/dock.png",
  alt: "Dock",
  row: 4,
  col: 12,
  rows: 3,
  cols: 3,
  blocked: true,
  impassable: true,
};

const grid = (cells: [number, number][]) => {
  const g = Array.from({ length: 11 }, () => Array<boolean>(17).fill(false));
  cells.forEach(([r, c]) => (g[r][c] = true));
  return g;
};
const square: [number, number][] = [4, 5, 6].flatMap((r) => [12, 13, 14].map((c) => [r, c] as [number, number]));

describe("map tile art", () => {
  it("slices the image across the covered tiles", () => {
    const g = buildTileArtGrid([DOCK], grid(square), grid(square))!;
    expect(g[4][12]?.style.backgroundPosition).toBe("0% 0%");
    expect(g[5][13]?.style.backgroundPosition).toBe("50% 50%");
    expect(g[6][14]?.style.backgroundPosition).toBe("100% 100%");
    expect(g[4][12]?.style.backgroundSize).toBe("300% 300%");
    expect(g[3][12]).toBeNull();
    expect(g[4][11]).toBeNull();
  });

  it("isn't drawn when the tiles under it don't match", () => {
    const notImpassable = square.filter(([r, c]) => !(r === 5 && c === 13));
    expect(buildTileArtGrid([DOCK], grid(square), grid(notImpassable))).toBeNull();
    expect(tileArtProblem(DOCK, () => true, (r, c) => !(r === 5 && c === 13))).toBe(
      "Dock art (rows 4–6, cols 12–14) needs blocked and impassable tiles, 1 differ",
    );
  });

  it("flags art that runs off the board", () => {
    expect(tileArtProblem({ ...DOCK, col: 15 }, () => true, () => true)).toMatch(/runs off the board/);
  });

  it("has the space dock on map 68 (node 16) and the repair station on map 67 (node 31)", () => {
    expect(mapTileArtFor(68).map((a) => a.src)).toEqual(["/img/space-dock-tile.png"]);
    expect(mapTileArtFor(67).map((a) => a.src)).toEqual(["/img/repair-station-tile.png"]);
    expect(nodeTileArtFor("ROGUELIKE", 16)).toBe(mapTileArtFor(68));
    expect(nodeTileArtFor("ROGUELIKE", 31)).toBe(mapTileArtFor(67));
    expect(nodeTileArtFor("CAMPAIGN", 31)).toEqual([]);
    expect(mapTileArtFor(undefined)).toEqual([]);
  });

  it("reports map 68's art fitting its live tiles", () => {
    const pos = square.map(([row, col]) => ({ row, col }));
    expect(mapTileArtProblems(68, pos, pos)).toEqual([]);
    expect(mapTileArtProblems(68, pos, pos.slice(1))).toHaveLength(1);
  });
});
