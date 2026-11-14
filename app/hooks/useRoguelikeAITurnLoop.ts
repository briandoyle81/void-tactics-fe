"use client";

import { useAITurnLoop } from "./useAITurnLoop";

// Roguelike combat uses the same contract call as single-player
// (take_ai_turns), so this is the shared loop with roguelike analytics.
export function useRoguelikeAITurnLoop(params: Omit<Parameters<typeof useAITurnLoop>[0], "gameMode">) {
  return useAITurnLoop({ ...params, gameMode: "roguelike" });
}
