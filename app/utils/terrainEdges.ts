// Terrain art with edges: nebula (blocked line of sight, public/img/nebula/)
// and asteroids (impassable, public/img/asteroids/), both at full opacity.
// Each set is full.png plus edge and corner pieces that tile together.
// A terrain tile draws full.png. A tile without that terrain draws the
// edge pieces for the terrain next to it, overlaid: left.png when the tile
// to its left has it, and so on, so a tile with the terrain above and to
// its left draws top.png and left.png. A corner piece (top-left.png, ...)
// is drawn only when the terrain touches it at that diagonal alone; the
// edge pieces already cover that corner otherwise.
// Tiles under map tile art (mapTileArt.ts) count as no terrain: they draw
// no full art and give their neighbours no edges, but terrain next to them
// still draws its edge pieces over the art (callers draw pieces after the art).
// Shared by GameGridCell and MapDisplayView. Pure.

import type { TileArtGrid } from "./mapTileArt";

export type TerrainArtSet = "nebula" | "asteroids";

const dir = (set: TerrainArtSet) => `/img/${set}`;

/** The set's whole-tile image (also the key's swatch). */
export const terrainFullArt = (set: TerrainArtSet) => `${dir(set)}/full.png`;

const EDGES = [
  { dr: 0, dc: -1, name: "left" },
  { dr: 0, dc: 1, name: "right" },
  { dr: -1, dc: 0, name: "top" },
  { dr: 1, dc: 0, name: "bottom" },
] as const;

const CORNERS = [
  { dr: -1, dc: -1, name: "top-left" },
  { dr: -1, dc: 1, name: "top-right" },
  { dr: 1, dc: -1, name: "bottom-left" },
  { dr: 1, dc: 1, name: "bottom-right" },
] as const;

const NONE: readonly string[] = [];

export type TerrainArtGrid = readonly (readonly (readonly string[])[])[];

/** The images of one terrain set each tile draws, in order (empty array: none). */
export function buildTerrainArtGrid(
  set: TerrainArtSet,
  terrainGrid: readonly (readonly boolean[])[] | undefined,
  tileArtGrid?: TileArtGrid | null,
): TerrainArtGrid {
  if (!terrainGrid) return [];
  const has = (r: number, c: number) => !!terrainGrid[r]?.[c] && !tileArtGrid?.[r]?.[c];
  const full: readonly string[] = [terrainFullArt(set)];
  return terrainGrid.map((row, r) =>
    row.map((_, c) => {
      if (has(r, c)) return full;
      const pieces: string[] = EDGES.filter((e) => has(r + e.dr, c + e.dc)).map((e) => `${dir(set)}/${e.name}.png`);
      for (const k of CORNERS) {
        if (has(r + k.dr, c + k.dc) && !has(r + k.dr, c) && !has(r, c + k.dc)) {
          pieces.push(`${dir(set)}/${k.name}.png`);
        }
      }
      return pieces.length > 0 ? pieces : NONE;
    }),
  );
}
