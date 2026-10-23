import type { BoardMove } from "../hooks/useMovePlayback";

// The held board while moves play back (useHeldBoard): each move that has
// reached its tile puts its ship there; a finished move also takes its
// casualties off (a retreat, a rammed ship knocked off, a destroyed target).
// The active move's target stays on the board while it's being fired at.
// Hull points and everything else stay as they were until the queue is done
// and the live board takes over. Mode-neutral: ids compare as numbers.

const ACTION_RETREAT = 2;
const ACTION_FACTION_ABILITY = 7;

export function landShipPositions<
  P extends { shipId: number | bigint | string; position: { row: number; col: number }; status?: 0 | 1 | 2 },
>(positions: readonly P[], landed: readonly BoardMove[], activeKey: string | null): P[] {
  if (landed.length === 0) return positions as P[];
  const next = positions.map((p) => ({ ...p }));
  const find = (id: number) => next.find((p) => Number(p.shipId) === id);
  for (const move of landed) {
    const finished = move.key !== activeKey;
    const mover = find(move.shipId);
    if (mover) {
      if (move.actionType === ACTION_RETREAT) mover.status = 2;
      else mover.position = { row: move.to.row, col: move.to.col };
    }
    if (!finished || !move.targetShipId) continue;
    const target = find(move.targetShipId);
    if (!target) continue;
    if (move.killsTarget) target.status = 1;
    // A Ram (variant 1's faction ability, ending on the victim's tile) knocks the victim off.
    else if (move.actionType === ACTION_FACTION_ABILITY && move.to.row === target.position.row && move.to.col === target.position.col)
      target.status = 2;
  }
  return next;
}

/** A raw move record (Move event, lastMove, replay turn), number-native. */
export interface RawMove {
  shipId: number;
  oldRow: number;
  oldCol: number;
  newRow: number;
  newCol: number;
  actionType: number;
  targetShipId: number;
}

/** Identity of a move by what it did (matches the same move from a Move event and from lastMove). */
export function moveContentKey(m: RawMove): string {
  return `${m.shipId}:${m.actionType}:${m.targetShipId}:${m.oldRow},${m.oldCol}:${m.newRow},${m.newCol}`;
}

/**
 * A raw move as a playback move. A Ram (variant 1's faction ability) records
 * the tile before the ram, but the rammer ends on its victim's tile, so it
 * slides there (`targetPosition`: the victim's tile on the board before the move).
 */
export function boardMoveFromRaw(
  key: string,
  m: RawMove,
  ctx: { moverVariant: number | null | undefined; targetPosition: { row: number; col: number } | null; killsTarget?: boolean },
): BoardMove {
  const isRam = m.actionType === ACTION_FACTION_ABILITY && Number(ctx.moverVariant) !== 2;
  const retreat = m.actionType === ACTION_RETREAT;
  return {
    key,
    shipId: m.shipId,
    from: { row: m.oldRow, col: m.oldCol },
    to:
      retreat || m.newRow < 0 || m.newCol < 0
        ? { row: m.oldRow, col: m.oldCol }
        : isRam && ctx.targetPosition
          ? ctx.targetPosition
          : { row: m.newRow, col: m.newCol },
    actionType: m.actionType,
    targetShipId: m.targetShipId,
    killsTarget: ctx.killsTarget,
  };
}
