import { useCallback, useEffect, useRef, useState } from "react";
import { buildPendingMove, type PendingMove } from "../utils/pendingMove";

// Owns the one in-flight submitted move for a game view (see
// app/utils/pendingMove.ts). Shared by GameDisplay.tsx (web3) and
// GameDisplayWeb2.tsx; each caller decides when a submission is sent or
// failed, this decides when it has landed.
//
// Lifecycle:
// - capture(): at click, before the wallet prompt / POST. Snapshots the
//   move from the state the player actually submitted, so later refetches
//   (which clear selection/targets) can't change what gets displayed.
// - markSent(): the tx was broadcast (web3) or the POST went out (web2).
//   From here the board shows the predicted result.
// - fail(): the wallet rejected, the tx reverted, or the POST errored. The
//   board goes back to fresh data.
// - Resolves itself once fresh data's lastMove differs from the one at
//   submit time, i.e. the move (or anything after it) is in the data.
export function usePendingMove({
  chainLastMoveKey,
  isGameOver,
  onResolved,
}: {
  /** lastMoveKey(fresh data's lastMove), not the patched game's. */
  chainLastMoveKey: string;
  isGameOver: boolean;
  /** Called once when a sent move lands in fresh data. */
  onResolved?: (move: PendingMove) => void;
}) {
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const keyRef = useRef(0);
  const pendingRef = useRef<PendingMove | null>(null);
  pendingRef.current = pendingMove;
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  const capture = useCallback(
    (params: Omit<Parameters<typeof buildPendingMove>[0], "key" | "phase">) => {
      keyRef.current += 1;
      const move = buildPendingMove({ ...params, key: keyRef.current, phase: "signing" });
      setPendingMove(move);
      return move.key;
    },
    [],
  );

  /** Pass `key` to only act on that capture (ignored if superseded). */
  const markSent = useCallback((key?: number) => {
    setPendingMove((prev) =>
      prev && (key == null || prev.key === key) && prev.phase !== "sent" ? { ...prev, phase: "sent" } : prev,
    );
  }, []);

  /** Returns whether there was a matching pending move to drop. */
  const fail = useCallback((key?: number): boolean => {
    const current = pendingRef.current;
    if (!current || (key != null && current.key !== key)) return false;
    pendingRef.current = null;
    setPendingMove(null);
    return true;
  }, []);

  useEffect(() => {
    if (!pendingMove) return;
    if (isGameOver) {
      setPendingMove(null);
      return;
    }
    if (pendingMove.phase !== "sent") return;
    if (chainLastMoveKey === pendingMove.baselineLastMoveKey) return;
    setPendingMove(null);
    onResolvedRef.current?.(pendingMove);
  }, [pendingMove, chainLastMoveKey, isGameOver]);

  return {
    /** The captured move (any phase). */
    pendingMove,
    /** Ref mirror of pendingMove for async handlers. */
    pendingRef,
    /** True while a sent move is waiting to land. */
    isAwaitingSync: pendingMove?.phase === "sent",
    capture,
    markSent,
    fail,
  };
}
