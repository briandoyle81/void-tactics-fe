// The route a move is drawn along: the move arrow and the ship sliding to its
// new tile. Legality is not decided here (hasMovementPath in
// gameGridRanges.ts mirrors Maps.sol and stays the rule); this only finds a
// tile-by-tile route from From to To that goes around impassable tiles and
// enemy ships, so the arrow and the ship never cross an asteroid or a ship
// they couldn't pass. Allies and disabled ships can be passed through, the
// same as buildEnemyOccupiedGrid.

import { buildEnemyOccupiedGrid } from "./gameGridRanges";

export type PathTile = { row: number; col: number };

export interface MovePathGrids {
  /** Asteroids: can't be entered. */
  impassableGrid?: boolean[][];
  /** Active enemy ships (buildEnemyOccupiedGrid): can't be passed. */
  enemyOccupiedGrid?: boolean[][];
  width: number;
  height: number;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

/** A cost that keeps the route as short as possible first, then with the fewest turns. */
const STEP_COST = 1000;
const TURN_COST = 1;

/** Today's L shape (along the row first, then the column): the fallback with no route. */
export function lShapedPath(from: PathTile, to: PathTile): PathTile[] {
  const tiles: PathTile[] = [{ ...from }];
  const colStep = Math.sign(to.col - from.col);
  const rowStep = Math.sign(to.row - from.row);
  let { row, col } = from;
  while (col !== to.col) {
    col += colStep;
    tiles.push({ row, col });
  }
  while (row !== to.row) {
    row += rowStep;
    tiles.push({ row, col });
  }
  return tiles;
}

/**
 * Tiles from `from` to `to` inclusive, moving one tile up, down, left or right
 * at a time: the shortest route around blocked tiles, and among equally short
 * routes the one with the fewest turns. The destination is always allowed (a
 * Ram ends on its victim). Falls back to an L shape if nothing gets there.
 */
export function findMovePath(from: PathTile, to: PathTile, grids: MovePathGrids): PathTile[] {
  if (from.row === to.row && from.col === to.col) return [{ ...from }];
  const { width, height, impassableGrid, enemyOccupiedGrid } = grids;
  const blocked = (row: number, col: number) =>
    !(row === to.row && col === to.col) &&
    (impassableGrid?.[row]?.[col] === true || enemyOccupiedGrid?.[row]?.[col] === true);

  // Dijkstra over (tile, heading): small grid (17x11x4), so a plain array
  // queue is plenty.
  const stateCount = width * height * 4;
  const cost = new Array<number>(stateCount).fill(Infinity);
  const prev = new Array<number>(stateCount).fill(-1);
  const index = (row: number, col: number, dir: number) => (row * width + col) * 4 + dir;
  const open: number[] = [];

  for (let dir = 0; dir < 4; dir++) {
    const row = from.row + DIRS[dir][0];
    const col = from.col + DIRS[dir][1];
    if (row < 0 || col < 0 || row >= height || col >= width || blocked(row, col)) continue;
    const s = index(row, col, dir);
    cost[s] = STEP_COST;
    open.push(s);
  }

  let end = -1;
  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (cost[open[i]] < cost[open[best]]) best = i;
    const s = open[best];
    open.splice(best, 1);
    const dir = s % 4;
    const tile = Math.floor(s / 4);
    const row = Math.floor(tile / width);
    const col = tile % width;
    if (row === to.row && col === to.col) {
      end = s;
      break;
    }
    for (let next = 0; next < 4; next++) {
      const nr = row + DIRS[next][0];
      const nc = col + DIRS[next][1];
      if (nr < 0 || nc < 0 || nr >= height || nc >= width || blocked(nr, nc)) continue;
      if (nr === from.row && nc === from.col) continue;
      const ns = index(nr, nc, next);
      const c = cost[s] + STEP_COST + (next === dir ? 0 : TURN_COST);
      if (c < cost[ns]) {
        if (cost[ns] === Infinity) open.push(ns);
        cost[ns] = c;
        prev[ns] = s;
      }
    }
  }

  if (end < 0) return lShapedPath(from, to);
  const tiles: PathTile[] = [];
  for (let s = end; s >= 0; s = prev[s]) {
    const tile = Math.floor(s / 4);
    tiles.push({ row: Math.floor(tile / width), col: tile % width });
  }
  tiles.push({ ...from });
  return tiles.reverse();
}

/** The path's corners: From, every tile where it turns, and To (what an arrow is drawn through). */
export function pathCorners(path: PathTile[]): PathTile[] {
  if (path.length <= 2) return path;
  const corners: PathTile[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1];
    const b = path[i];
    const c = path[i + 1];
    if (b.row - a.row !== c.row - b.row || b.col - a.col !== c.col - b.col) corners.push(b);
  }
  corners.push(path[path.length - 1]);
  return corners;
}

/**
 * A ship's route from `from` to `to` on the board as it stands: around
 * asteroids and active enemy ships (buildEnemyOccupiedGrid), passing allies
 * and disabled ships.
 */
export function routeForShip(params: {
  shipId: number;
  from: PathTile;
  to: PathTile;
  shipPositions: readonly { shipId: number; position: PathTile; isCreator: boolean }[];
  impassableGrid?: boolean[][];
  isDisabled?: (shipId: number) => boolean;
  width?: number;
  height?: number;
}): PathTile[] {
  const width = params.width ?? 17;
  const height = params.height ?? 11;
  const mover = params.shipPositions.find((p) => p.shipId === params.shipId);
  const enemyOccupiedGrid = mover
    ? buildEnemyOccupiedGrid(
        width,
        height,
        params.shipPositions,
        params.shipId,
        mover.isCreator,
        params.isDisabled ? (id) => params.isDisabled!(Number(id)) : undefined,
      )
    : undefined;
  return findMovePath(params.from, params.to, {
    width,
    height,
    impassableGrid: params.impassableGrid,
    enemyOccupiedGrid,
  });
}
