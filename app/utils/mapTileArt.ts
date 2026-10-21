// Map-specific tile art (app/data/content/mapTileArt.ts): one image drawn
// over a whole-tile rectangle in place of the nebula / hazard art. Each
// covered cell draws its own slice of the image, at the terrain layer, so
// highlights, ships and tile tooltips stay on top exactly as on any tile.
// Shared by the battle board (GameGridCell), fleet placement
// (MapDisplayView) and the map cards' problems (mapProblems.ts).
// Number-native, pure.

import type React from "react";
import { MAP_TILE_ART } from "../data/content/mapTileArt";
import { GRID_DIMENSIONS } from "../types/types";

export interface MapTileArt {
  /** Image under public/, e.g. "/img/space-dock-tile.png". */
  src: string;
  alt: string;
  /** Top-left tile. */
  row: number;
  col: number;
  /** Size in tiles. */
  rows: number;
  cols: number;
  /** What every tile under the art must be; otherwise the art isn't drawn. */
  blocked: boolean;
  impassable: boolean;
}

export interface MapTileArtContent {
  /** Map id -> its tile art. */
  maps: Record<number, readonly MapTileArt[]>;
  /** Node id -> the id of the map it's fought on (only nodes whose map has art). */
  campaignNodes: Record<number, number>;
  roguelikeNodes: Record<number, number>;
}

/** One cell's part of a piece of tile art. */
export interface TileArtSlice {
  alt: string;
  style: React.CSSProperties;
}

export type TileArtGrid = readonly (readonly (TileArtSlice | null)[])[];

type Pos = { row: number | bigint; col: number | bigint };

const NO_ART: readonly MapTileArt[] = [];

/** The tile art for a map (none for an unknown or missing id). */
export function mapTileArtFor(mapId: number | bigint | null | undefined): readonly MapTileArt[] {
  if (mapId == null) return NO_ART;
  return MAP_TILE_ART.maps[Number(mapId)] ?? NO_ART;
}

/** The tile art for a mission node's map, from the content file (no chain read). */
export function nodeTileArtFor(
  graph: "CAMPAIGN" | "ROGUELIKE",
  nodeId: number | bigint | null | undefined,
): readonly MapTileArt[] {
  if (nodeId == null || Number(nodeId) <= 0) return NO_ART;
  const byNode = graph === "CAMPAIGN" ? MAP_TILE_ART.campaignNodes : MAP_TILE_ART.roguelikeNodes;
  return mapTileArtFor(byNode[Number(nodeId)]);
}

const describe = (a: MapTileArt) =>
  `rows ${a.row}–${a.row + a.rows - 1}, cols ${a.col}–${a.col + a.cols - 1}`;

function coveredTiles(a: MapTileArt): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (let r = a.row; r < a.row + a.rows; r++) {
    for (let c = a.col; c < a.col + a.cols; c++) out.push({ row: r, col: c });
  }
  return out;
}

/**
 * Why a piece can't be drawn on this terrain, or null when it fits: it runs
 * off the board, or a tile under it isn't blocked / impassable as the piece says.
 */
export function tileArtProblem(
  art: MapTileArt,
  isBlocked: (row: number, col: number) => boolean,
  isImpassable: (row: number, col: number) => boolean,
): string | null {
  if (
    art.rows < 1 ||
    art.cols < 1 ||
    art.row < 0 ||
    art.col < 0 ||
    art.row + art.rows > GRID_DIMENSIONS.HEIGHT ||
    art.col + art.cols > GRID_DIMENSIONS.WIDTH
  ) {
    return `${art.alt} art (${describe(art)}) runs off the board`;
  }
  const wrong = coveredTiles(art).filter(
    ({ row, col }) => isBlocked(row, col) !== art.blocked || isImpassable(row, col) !== art.impassable,
  );
  if (wrong.length === 0) return null;
  const want = [art.blocked ? "blocked" : "not blocked", art.impassable ? "impassable" : "not impassable"].join(
    " and ",
  );
  return `${art.alt} art (${describe(art)}) needs ${want} tiles, ${wrong.length} differ`;
}

/** Problems with a map's tile art, from its position lists (for the admin cards). */
export function mapTileArtProblems(
  mapId: number,
  blockedPositions: readonly Pos[],
  impassablePositions: readonly Pos[],
): string[] {
  const set = (ps: readonly Pos[]) => new Set(ps.map((p) => `${Number(p.row)},${Number(p.col)}`));
  const blocked = set(blockedPositions);
  const impassable = set(impassablePositions);
  return mapTileArtFor(mapId)
    .map((a) =>
      tileArtProblem(
        a,
        (r, c) => blocked.has(`${r},${c}`),
        (r, c) => impassable.has(`${r},${c}`),
      ),
    )
    .filter((p): p is string => p !== null);
}

/**
 * Each cell's slice of the art that fits this terrain (null where none).
 * Null overall when no piece is drawn, so callers can skip the work.
 */
export function buildTileArtGrid(
  art: readonly MapTileArt[],
  blockedGrid: readonly (readonly boolean[])[],
  impassableGrid: readonly (readonly boolean[])[] | undefined,
): TileArtGrid | null {
  const fits = art.filter(
    (a) =>
      tileArtProblem(
        a,
        (r, c) => !!blockedGrid[r]?.[c],
        (r, c) => !!impassableGrid?.[r]?.[c],
      ) === null,
  );
  if (fits.length === 0) return null;
  const grid: (TileArtSlice | null)[][] = Array.from({ length: GRID_DIMENSIONS.HEIGHT }, () =>
    Array<TileArtSlice | null>(GRID_DIMENSIONS.WIDTH).fill(null),
  );
  for (const a of fits) {
    for (const { row, col } of coveredTiles(a)) {
      const dr = row - a.row;
      const dc = col - a.col;
      grid[row][col] = {
        alt: a.alt,
        style: {
          backgroundImage: `url("${a.src}")`,
          backgroundSize: `${a.cols * 100}% ${a.rows * 100}%`,
          backgroundPosition: `${a.cols > 1 ? (dc / (a.cols - 1)) * 100 : 0}% ${
            a.rows > 1 ? (dr / (a.rows - 1)) * 100 : 0
          }%`,
          backgroundRepeat: "no-repeat",
        },
      };
    }
  }
  return grid;
}
