"use client";

import { useEffect, useRef, useState } from "react";
import { useSinglePlayerMatch } from "./useSinglePlayerMatch";
import { refetchUntilChanged } from "../utils/refetchUntilChanged";
import { aiMovesFromTurns, dispatchGameMoves } from "../utils/gameMoveLogs";
import { trackAITurnFailed } from "../utils/analytics/gameEvents";
import { viewGame } from "../near/rpc";

// Defensive cap on consecutive take_ai_turns calls for a single AI turn,
// comfortably above the largest AI fleet.
const MAX_ITERATIONS = 20;

// Deliberate pause before each AI call so the player sees the previous move
// before the board changes again.
const MOVE_PACING_MS = 1800;

// A failed AI call (often a rate-limited RPC read) is retried this many
// times, after refetching the board, before the loop gives up and asks for
// a refresh.
const MAX_FAILURE_RETRIES = 3;
const RETRY_DELAY_MS = 2500;

interface UseAITurnLoopParams {
  gameId: bigint;
  isAITurn: boolean;
  isGameOver: boolean;
  /** Changes whenever fresh state lands for this game (e.g. a move timestamp). */
  lastMoveSignal: string;
  refetchGame: () => void;
  /** AI moves to send in one take_ai_turns call (tail case); see app/utils/aiTurnBatch.ts. */
  batchMoves?: number;
  /** For analytics. */
  gameMode?: "campaign" | "roguelike";
}

/**
 * Drives the contract's AI (take_ai_turns, the same call for single-player
 * and roguelike games) while it's the AI's turn: the player's session key
 * sends each call with no prompt. Each call's AI moves play back on the
 * board in order (gameMoveLogs.ts: the `ai_turns` event plus the board
 * before and after), then this re-fires after a pacing delay until the turn
 * returns to the player or the game ends.
 */
export function useAITurnLoop({
  gameId,
  isAITurn,
  isGameOver,
  lastMoveSignal,
  refetchGame,
  batchMoves = 1,
  gameMode = "campaign",
}: UseAITurnLoopParams) {
  const { takeAITurns } = useSinglePlayerMatch();
  const [moveCount, setMoveCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isWaitingToAct, setIsWaitingToAct] = useState(false);
  const inFlightRef = useRef(false);
  const iterationRef = useRef(0);
  const failuresRef = useRef(0);
  const [retryTick, setRetryTick] = useState(0);
  const lastMoveSignalRef = useRef(lastMoveSignal);
  lastMoveSignalRef.current = lastMoveSignal;

  useEffect(() => {
    if (!isAITurn || isGameOver) {
      iterationRef.current = 0;
      failuresRef.current = 0;
      setMoveCount((c) => (c === 0 ? c : 0));
      setError((e) => (e == null ? e : null));
      setIsWaitingToAct((w) => (w ? false : w));
      return;
    }
    if (inFlightRef.current || error) return;
    if (iterationRef.current >= MAX_ITERATIONS) {
      setError("AI turn did not resolve — please refresh.");
      trackAITurnFailed({ appMode: "web3", gameMode, gameId, reason: "stalled" });
      return;
    }

    inFlightRef.current = true;
    setIsWaitingToAct(true);
    // Whether the scheduled call fired: a cleanup before it fires (an
    // effect re-run, Strict Mode's double-invoke) must reset the in-flight
    // flag, or every later run bails on "already in flight" forever.
    let didFire = false;
    const pacingTimeout = setTimeout(() => {
      didFire = true;
      iterationRef.current += 1;
      const signalAtSend = lastMoveSignalRef.current;
      void (async () => {
        const id = gameId.toString();
        const before = await viewGame("get_game", { game_id: id });
        const receipt = await takeAITurns(gameId, batchMoves);
        const after = await viewGame("get_game", { game_id: id });
        dispatchGameMoves(aiMovesFromTurns(receipt.hash, receipt.events, before, after));
      })()
        .then(() => {
          failuresRef.current = 0;
          setMoveCount((c) => c + 1);
          void refetchUntilChanged({
            refetch: refetchGame,
            hasChanged: () => lastMoveSignalRef.current !== signalAtSend,
          });
        })
        .catch((err) => {
          console.error("take_ai_turns failed:", err);
          if (failuresRef.current < MAX_FAILURE_RETRIES) {
            // Transient (usually a rate-limited read): refetch the board (the
            // AI may have moved after all) and try again shortly.
            failuresRef.current += 1;
            iterationRef.current = Math.max(0, iterationRef.current - 1);
            refetchGame();
            setTimeout(() => setRetryTick((t) => t + 1), RETRY_DELAY_MS * failuresRef.current);
            return;
          }
          setError("AI turn failed — please refresh.");
          trackAITurnFailed({ appMode: "web3", gameMode, gameId, reason: "failed" });
        })
        .finally(() => {
          inFlightRef.current = false;
          setIsWaitingToAct(false);
        });
    }, MOVE_PACING_MS);

    return () => {
      clearTimeout(pacingTimeout);
      if (!didFire) {
        inFlightRef.current = false;
        setIsWaitingToAct(false);
      }
    };
    // lastMoveSignal re-runs this once fresh state confirms the previous AI
    // move landed, so the next call never fires against stale data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAITurn, isGameOver, gameId, lastMoveSignal, retryTick]);

  return {
    isAIThinking: isAITurn && !isGameOver && !error,
    isWaitingToAct,
    moveCount,
    error,
  };
}
