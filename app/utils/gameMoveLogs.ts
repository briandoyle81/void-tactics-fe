import type { NearEvent } from "../near/codec";
import type { GameState, ActionType as NearActionType } from "../near/generated/voidTactics";
import { fromNearAction } from "../near/adapters/game";

// A game's moves, one per action, played back on the board in order
// (useMovePlayback). The game read's single lastMove can't show an AI batch
// (take_ai_turns), so the AI loop builds each move here from the
// transaction's `ai_turns` event and the board before and after it, and
// hands them to the open game (registerGameMoves). Number-native.

export interface GameMoveLog {
  /** Unique per move: transaction hash and index. */
  key: string;
  gameId: number;
  shipId: number;
  oldRow: number;
  oldCol: number;
  newRow: number;
  newCol: number;
  actionType: number;
  targetShipId: number;
  /** For ordering across transactions (a sequence number). */
  blockNumber: bigint;
  logIndex: number;
}

let sequence = BigInt(0);

interface AiTurnsEventData {
  game_id?: string;
  turns?: Array<{ ship_id?: string; action?: NearActionType; target?: string; decision_failed?: string }>;
}

/**
 * The AI moves in a take_ai_turns transaction. The event names each ship,
 * action and target; where each ship moved comes from the boards before and
 * after (an AI ship acts once per round, so one transaction moves each ship
 * at most once).
 */
export function aiMovesFromTurns(
  txHash: string,
  events: readonly NearEvent[],
  before: GameState | null,
  after: GameState | null,
): GameMoveLog[] {
  const moves: GameMoveLog[] = [];
  const order = ++sequence;
  for (const ev of events) {
    if (ev.event !== "ai_turns") continue;
    const data = ev.data as AiTurnsEventData;
    const gameId = Number(data.game_id ?? 0);
    (data.turns ?? []).forEach((turn, i) => {
      if (turn.decision_failed != null || turn.ship_id == null) return;
      const id = String(turn.ship_id);
      const from = before?.board[id];
      const to = after?.board[id] ?? from;
      if (!from || !to) return;
      moves.push({
        key: `${txHash}:${i}`,
        gameId,
        shipId: Number(id),
        oldRow: from.row,
        oldCol: from.col,
        newRow: to.row,
        newCol: to.col,
        actionType: fromNearAction(turn.action ?? "Pass"),
        targetShipId: Number(turn.target ?? 0),
        blockNumber: order,
        logIndex: i,
      });
    });
  }
  return moves;
}

// Per-game listeners: the open GameDisplay subscribes to its own game's moves.
const moveListeners = new Map<number, Set<(moves: GameMoveLog[]) => void>>();

export function registerGameMoves(gameId: number, listener: (moves: GameMoveLog[]) => void): () => void {
  let set = moveListeners.get(gameId);
  if (!set) {
    set = new Set();
    moveListeners.set(gameId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) moveListeners.delete(gameId);
  };
}

/** Hands moves to each game's listeners (games nobody watches are dropped). */
export function dispatchGameMoves(moves: GameMoveLog[]) {
  const byGame = new Map<number, GameMoveLog[]>();
  for (const m of moves) {
    if (!moveListeners.has(m.gameId)) continue;
    (byGame.get(m.gameId) ?? byGame.set(m.gameId, []).get(m.gameId)!).push(m);
  }
  byGame.forEach((list, gameId) => moveListeners.get(gameId)?.forEach((fn) => fn(list)));
}
