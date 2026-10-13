// What a board tile's hover tooltip says (GameGridTileTooltip). Pure and
// shared by every game view through GameGridCell. Terrain names follow the
// tutorial's: line-of-sight blockers are nebulae.

export type TileTooltipTone = "gold" | "crystal" | "hazard" | "nebula" | "move" | "range" | "target";

export interface TileTooltip {
  title: string;
  /** Short lines under the title. */
  details: string[];
  tone: TileTooltipTone;
  /** "Move here", when the selected ship can move to this tile. */
  action?: string;
}

export interface TileTooltipInput {
  isMovementTile: boolean;
  isImpassable: boolean;
  scoringPoints: number;
  onlyOnce: boolean;
  blocksLineOfSight: boolean;
  isShootingTile: boolean;
  isAssistableTarget: boolean;
  isValidTarget: boolean;
}

/** The tooltip for an empty tile, or null when there's nothing worth saying. */
export function describeTile(t: TileTooltipInput): TileTooltip | null {
  const action = t.isMovementTile ? "Move here" : undefined;
  const terrain: string[] = [];
  if (t.isImpassable) terrain.push("Impassable: ships can't enter");
  if (t.blocksLineOfSight) terrain.push("Blocks line of sight");

  if (t.scoringPoints > 0) {
    return {
      title: t.onlyOnce ? "Crystal Deposit" : "Gold Deposit",
      details: [`${t.scoringPoints} points${t.onlyOnce ? ", pays out once" : ""}`, ...terrain],
      tone: t.onlyOnce ? "crystal" : "gold",
      action,
    };
  }
  if (t.isImpassable) {
    return { title: "Hazard", details: terrain, tone: "hazard", action };
  }
  if (t.blocksLineOfSight) {
    return { title: "Nebula", details: terrain, tone: "nebula", action };
  }
  if (action) return { title: "Open Space", details: [], tone: "move", action };
  if (t.isShootingTile) return { title: "Weapons Range", details: ["Within the selected ship's reach"], tone: "range" };
  if (t.isAssistableTarget) return { title: "Assist", details: ["Click to assist this ship"], tone: "target" };
  if (t.isValidTarget) return { title: "Target", details: ["Click to target this ship"], tone: "target" };
  return null;
}

/** The same text as one line, for screen readers (the cell's aria-label). */
export function tileTooltipLabel(tip: TileTooltip): string {
  return [tip.action, tip.title, ...tip.details].filter(Boolean).join(". ");
}
