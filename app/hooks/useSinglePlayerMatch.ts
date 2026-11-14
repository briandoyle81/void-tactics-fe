"use client";
import { useCallback, useMemo } from "react";
import { useNearSession } from "../near/session";
import { useNearView } from "../near/useNearView";
import { GAS_DEFAULT, GAS_HEAVY } from "../near/config";
import { toBig } from "../near/codec";

/** The game contract plays the AI; take_ai_turns serves single-player and roguelike games alike. */
export const AI_TURNS_PER_CALL_MAX = 8;

export function useSinglePlayerMatch() {
  const { send } = useNearSession();

  /** Builds the player's fleet and starts the node's game in one call. Resolves with the game id. */
  const startNodeMatch = useCallback(
    async (nodeId: bigint, shipIds: bigint[], positions: { row: number; col: number }[]) => {
      const receipt = await send({
        method: "start_node_match",
        args: { node_id: nodeId.toString(), ship_ids: shipIds.map(String), positions },
        gas: GAS_HEAVY,
      });
      const gameId = toBig(receipt.returnValue as string);
      return gameId;
    },
    [send],
  );

  /**
   * Advances the AI by up to `maxMoves` moves (permissionless: anyone may
   * call it). Resolves with the transaction (its `ai_turns` event lists the
   * moves).
   */
  const takeAITurns = useCallback(
    (gameId: bigint, maxMoves = 1) =>
      send({
        method: "take_ai_turns",
        args: { game_id: gameId.toString(), max_moves: Math.max(1, Math.min(AI_TURNS_PER_CALL_MAX, maxMoves)) },
        gas: GAS_HEAVY,
      }),
    [send],
  );

  const takeAITurn = useCallback((gameId: bigint) => takeAITurns(gameId, 1), [takeAITurns]);

  const forfeit = useCallback(
    (gameId: bigint) => send({ method: "forfeit", args: { game_id: gameId.toString() }, gas: GAS_DEFAULT }),
    [send],
  );

  return { startNodeMatch, takeAITurn, takeAITurns, forfeit };
}

/** The campaign node a single-player game was launched from (0 when it isn't one). */
export function useGameIdToNodeId(gameId: bigint | undefined) {
  const args = useMemo(() => (gameId != null ? { game_id: gameId.toString() } : null), [gameId]);
  const result = useNearView("get_sp_match", args, { staleTime: Infinity });
  return { ...result, data: result.data ? toBig(result.data.node_id) : gameId != null ? BigInt(0) : undefined };
}
