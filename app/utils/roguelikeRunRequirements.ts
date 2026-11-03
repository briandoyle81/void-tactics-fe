// Frontend-only gates for a roguelike roster (the contracts enforce
// neither): starting a run (RoguelikeRunStart / Web2) needs both, and every
// later fleet selection at a resupply station (RoguelikeResupplyPanel /
// Web2) the minimum cost. Number-native:
// callers convert bigint values before passing them in.

/** Constructed, non-destroyed ships of the run's faction a player must own. */
export const MIN_CONSTRUCTED_SHIPS_FOR_RUN = 10;

/** The roster must use at least this share of the run's cost cap. */
export const MIN_ROSTER_COST_FRACTION = 0.85;

/** The least a roster may cost under `costLimit` (0 when there's no cap). */
export function minRosterCostFor(costLimit: number): number {
  return costLimit > 0 ? Math.ceil(costLimit * MIN_ROSTER_COST_FRACTION) : 0;
}

export interface RoguelikeRunRequirements {
  constructedCount: number;
  hasEnoughConstructed: boolean;
  /** 0 when the campaign has no cost cap (then there's no minimum). */
  minRosterCost: number;
  meetsMinRosterCost: boolean;
}

export function getRoguelikeRunRequirements({
  constructedCount,
  rosterCost,
  costLimit,
}: {
  constructedCount: number;
  rosterCost: number;
  costLimit: number;
}): RoguelikeRunRequirements {
  const minRosterCost = minRosterCostFor(costLimit);
  return {
    constructedCount,
    hasEnoughConstructed: constructedCount >= MIN_CONSTRUCTED_SHIPS_FOR_RUN,
    minRosterCost,
    meetsMinRosterCost: rosterCost >= minRosterCost,
  };
}

/** Ships that count toward MIN_CONSTRUCTED_SHIPS_FOR_RUN. */
export function isRunEligibleConstructedShip(
  ship: { constructed: boolean; destroyed: boolean; variant: number },
  requiredVariant: number,
): boolean {
  return (
    ship.constructed && !ship.destroyed && (requiredVariant === 0 || ship.variant === requiredVariant)
  );
}
