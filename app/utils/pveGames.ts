import type { GameDataView } from "../types/types";
import { SINGLE_PLAYER_MATCH_ADDRESS } from "../hooks/useSinglePlayerMatch";
import { ROGUELIKE_MATCH_ADDRESS } from "../hooks/useRoguelikeMatch";

// PvE = a campaign or roguelike mission, i.e. a game orchestrated by
// SinglePlayerMatch or RoguelikeMatch (same test as GameDisplay.tsx).
export function isPveGame(game: GameDataView): boolean {
  const orchestrator = game.metadata.orchestrator?.toLowerCase();
  return (
    orchestrator === SINGLE_PLAYER_MATCH_ADDRESS.toLowerCase() ||
    orchestrator === ROGUELIKE_MATCH_ADDRESS.toLowerCase()
  );
}
