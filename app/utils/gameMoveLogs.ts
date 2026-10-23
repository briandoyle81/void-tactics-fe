import { parseEventLogs, type Abi, type Log } from "viem";
import { CONTRACT_ABIS } from "../config/contracts";
import { eventAbi } from "../hooks/useCombinedEventWatch";

// Game's Move event, one per action: the moves an AI batch (takeAITurns)
// or an opponent made, each in order, which the game read's single lastMove
// can't give. Read by the app-wide event watch (ContractEventsHost, routed
// per game with registerGameMoves) and from the AI loop's own receipts, and
// played back on the board (useMovePlayback). Number-native.

export const MOVE_EVENT = eventAbi(CONTRACT_ABIS.GAME as Abi, "Move");

export interface GameMoveLog {
  /** Unique per log: transaction hash and log index. */
  key: string;
  gameId: number;
  shipId: number;
  oldRow: number;
  oldCol: number;
  newRow: number;
  newCol: number;
  actionType: number;
  targetShipId: number;
  /** For ordering across transactions. */
  blockNumber: bigint;
  logIndex: number;
}

type MoveArgs = {
  gameId?: bigint;
  shipId?: bigint;
  oldRow?: number | bigint;
  oldCol?: number | bigint;
  newRow?: number | bigint;
  newCol?: number | bigint;
  actionType?: number | bigint;
  targetShipId?: bigint;
};

/** Decoded Move logs (from the watcher, already decoded) in chain order. */
export function toGameMoveLogs(logs: readonly (Log & { args?: unknown })[]): GameMoveLog[] {
  const moves: GameMoveLog[] = [];
  for (const log of logs) {
    const args = log.args as MoveArgs | undefined;
    if (!args || args.gameId == null || args.shipId == null) continue;
    moves.push({
      key: `${log.transactionHash}:${log.logIndex}`,
      gameId: Number(args.gameId),
      shipId: Number(args.shipId),
      oldRow: Number(args.oldRow),
      oldCol: Number(args.oldCol),
      newRow: Number(args.newRow),
      newCol: Number(args.newCol),
      actionType: Number(args.actionType),
      targetShipId: Number(args.targetShipId ?? 0n),
      blockNumber: log.blockNumber ?? 0n,
      logIndex: log.logIndex ?? 0,
    });
  }
  return moves.sort((a, b) =>
    a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1,
  );
}

/** Move logs out of a transaction receipt (raw logs). */
export function moveLogsFromReceipt(receiptLogs: readonly Log[]): GameMoveLog[] {
  const decoded = parseEventLogs({ abi: [MOVE_EVENT], logs: receiptLogs as Log[], strict: false });
  return toGameMoveLogs(decoded as unknown as (Log & { args?: unknown })[]);
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

/** Hands decoded moves to each game's listeners (games nobody watches are dropped). */
export function dispatchGameMoves(moves: GameMoveLog[]) {
  const byGame = new Map<number, GameMoveLog[]>();
  for (const m of moves) {
    if (!moveListeners.has(m.gameId)) continue;
    (byGame.get(m.gameId) ?? byGame.set(m.gameId, []).get(m.gameId)!).push(m);
  }
  byGame.forEach((list, gameId) => moveListeners.get(gameId)?.forEach((fn) => fn(list)));
}
