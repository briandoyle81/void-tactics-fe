import type { GameDataView } from "../types/types";
import { GAME_MODE } from "../near/adapters/game";

// PvE = a campaign or roguelike mission: a game the contract's AI plays
// (GameMetadata.orchestrator is the mode that started it).
export function isPveGame(game: GameDataView): boolean {
  const mode = game.metadata.orchestrator;
  return mode === GAME_MODE.SINGLE || mode === GAME_MODE.ROGUELIKE;
}
