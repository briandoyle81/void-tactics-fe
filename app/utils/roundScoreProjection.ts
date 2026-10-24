// The points each side will score at the end of this round if the ships
// stayed where they are: shown next to the scores as 32(+10)/80 (formatScore).
// Mirrors Game.sol's _handleEndOfRound: each scoring tile with a ship on it
// scores its points for that ship's side, unless the ship is disabled (0
// hull). A one-time tile's points are already gone from the board's
// scoringGrid once claimed (web3 reads them from the game's map state; web2
// from the game's claimedScoringTiles, app/utils/claimedScoringTiles.ts).

export interface RoundPoints {
  creator: number;
  joiner: number;
}

export function projectRoundPoints({
  shipPositions,
  scoringGrid,
  hullPointsOf,
}: {
  shipPositions: readonly {
    shipId: number | bigint | string;
    position: { row: number; col: number };
    isCreator: boolean;
    status?: number;
    isPreview?: boolean;
  }[];
  scoringGrid: readonly (readonly number[])[];
  /** Undefined when the ship has no attributes (it doesn't score). */
  hullPointsOf: (shipId: number) => number | undefined;
}): RoundPoints {
  const points: RoundPoints = { creator: 0, joiner: 0 };
  for (const p of shipPositions) {
    if ((p.status ?? 0) !== 0 || p.isPreview) continue;
    const tilePoints = scoringGrid[Number(p.position.row)]?.[Number(p.position.col)] ?? 0;
    if (tilePoints <= 0) continue;
    const hull = hullPointsOf(Number(p.shipId));
    if (hull === undefined || hull <= 0) continue;
    if (p.isCreator) points.creator += tilePoints;
    else points.joiner += tilePoints;
  }
  return points;
}

/** A score with the points it gains at round end: "32(+10)", or "32" with none. */
export function formatScore(score: number | bigint | string, roundPoints?: number): string {
  return roundPoints && roundPoints > 0 ? `${score}(+${roundPoints})` : `${score}`;
}
