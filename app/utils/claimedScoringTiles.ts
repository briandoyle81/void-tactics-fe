// Web2's one-time scoring tiles (crystals). Game.sol scores a tile with a ship
// on it at round end and, if the tile is one-time, empties it for the rest of
// the game (Maps.getScoreAndZeroOut drops it from the game's scoring set). Web2
// reads the static map, so each game's state remembers the one-time tiles it
// has paid out (Web2GameDataView.claimedScoringTiles) and every reader of the
// map (the engine's round-end scoring, the AI, the board) leaves them out.

import type { ScoringPosition } from "../types/types";

type Tile = { row: number; col: number };

const sameTile = (a: Tile, b: Tile) => a.row === b.row && a.col === b.col;

/** The map's scoring tiles this game can still score: claimed one-time tiles removed. */
export function unclaimedScoringPositions<T extends ScoringPosition>(
  positions: readonly T[],
  claimed: readonly Tile[] | undefined,
): T[] {
  if (!claimed || claimed.length === 0) return [...positions];
  return positions.filter((p) => !(p.onlyOnce && claimed.some((c) => sameTile(c, p))));
}

/** A board grid with the claimed tiles set to `empty` (0 points, not one-time): what web3's map state shows. */
export function withoutClaimedTiles<V>(grid: V[][], claimed: readonly Tile[] | undefined, empty: V): V[][] {
  if (!claimed || claimed.length === 0) return grid;
  const next = grid.map((row) => [...row]);
  for (const c of claimed) if (next[c.row]?.[c.col] !== undefined) next[c.row][c.col] = empty;
  return next;
}
