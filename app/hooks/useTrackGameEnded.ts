"use client";

import { useEffect, useRef } from "react";
import {
  markGameEndedTracked,
  shouldTrackGameEnded,
  trackGameEnded,
  wasGameEndedTracked,
  type AppMode,
  type GameMode,
  type GameResult,
} from "../utils/analytics/gameEvents";

/**
 * Sends game_ended once when a match the player is watching finishes.
 * Shared by GameDisplay (web3) and GameDisplayWeb2. `result` is null while
 * the game is in progress. Read-only views (replays) pass enabled: false.
 */
export function useTrackGameEnded({
  appMode,
  gameMode,
  gameId,
  result,
  retreated,
  round,
  enabled = true,
}: {
  appMode: AppMode;
  gameMode: GameMode;
  gameId: bigint | number | string;
  result: GameResult | null;
  retreated: boolean;
  round?: number;
  enabled?: boolean;
}) {
  const key = String(gameId);
  const sawInProgressRef = useRef<{ key: string; value: boolean }>({ key, value: false });
  const sentRef = useRef<string | null>(null);
  if (sawInProgressRef.current.key !== key) sawInProgressRef.current = { key, value: false };

  useEffect(() => {
    if (!enabled) return;
    if (result === null) {
      sawInProgressRef.current.value = true;
      return;
    }
    if (sentRef.current === key) return;
    if (
      !shouldTrackGameEnded({
        sawInProgress: sawInProgressRef.current.value,
        isOver: true,
        alreadyTracked: wasGameEndedTracked(key),
      })
    ) {
      return;
    }
    sentRef.current = key;
    markGameEndedTracked(key);
    trackGameEnded({ appMode, gameMode, gameId: key, result, retreated, round });
  }, [enabled, key, result, appMode, gameMode, retreated, round]);
}
