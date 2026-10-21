import { describe, expect, it } from "vitest";
import { buildTerrainArtGrid, terrainFullArt } from "../terrainEdges";
import { buildTileArtGrid, type MapTileArt } from "../mapTileArt";

const tiles = (cells: [number, number][]) => {
  const g = Array.from({ length: 11 }, () => Array<boolean>(17).fill(false));
  cells.forEach(([r, c]) => (g[r][c] = true));
  return g;
};
const names = (pieces: readonly string[]) => pieces.map((p) => p.split("/").pop());

describe("buildTerrainArtGrid", () => {
  it("draws full art on the terrain and edge pieces on the tiles around it", () => {
    const g = buildTerrainArtGrid("nebula", tiles([[5, 8]]));
    expect(g[5][8]).toEqual([terrainFullArt("nebula")]);
    expect(names(g[5][9])).toEqual(["left.png"]);
    expect(names(g[5][7])).toEqual(["right.png"]);
    expect(names(g[6][8])).toEqual(["top.png"]);
    expect(names(g[4][8])).toEqual(["bottom.png"]);
    expect(names(g[6][9])).toEqual(["top-left.png"]);
    expect(names(g[4][7])).toEqual(["bottom-right.png"]);
    expect(g[5][10]).toEqual([]);
  });

  it("overlays edges, and skips a corner the edges already cover", () => {
    const g = buildTerrainArtGrid("nebula", tiles([[4, 8], [5, 7], [4, 7]]));
    expect(names(g[5][8])).toEqual(["left.png", "top.png"]);
  });

  it("stops at the board's edge", () => {
    const g = buildTerrainArtGrid("nebula", tiles([[0, 0]]));
    expect(names(g[0][1])).toEqual(["left.png"]);
    expect(names(g[1][1])).toEqual(["top-left.png"]);
  });

  it("uses each set's own folder", () => {
    const g = buildTerrainArtGrid("asteroids", tiles([[5, 8]]));
    expect(g[5][8]).toEqual(["/img/asteroids/full.png"]);
    expect(g[5][9]).toEqual(["/img/asteroids/left.png"]);
    expect(buildTerrainArtGrid("asteroids", undefined)).toEqual([]);
  });

  it("treats tiles under map tile art as no terrain, but edges terrain onto them", () => {
    const art: MapTileArt = { src: "/x.png", alt: "X", row: 5, col: 8, rows: 1, cols: 1, blocked: true, impassable: false };
    const b = tiles([[5, 8], [5, 7]]);
    const g = buildTerrainArtGrid("nebula", b, buildTileArtGrid([art], b, undefined));
    expect(names(g[5][8])).toEqual(["left.png"]);
    expect(g[5][9]).toEqual([]);
  });
});
