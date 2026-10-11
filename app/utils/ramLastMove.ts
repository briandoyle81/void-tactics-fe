import { ActionType } from "../types/types";

// Where the last mover actually ended up, for the last-move arrow, ghost and
// labels. A Ram's lastMove (Move event / LastMove on chain, and the web2
// engine's mirror of it) records the tile the rammer moved to *before*
// ramming; RamResolver then puts it on the victim's tile. So for a ram whose
// rammer is still on the board, its current position is the real end tile.
// Everything else (and a rammer its own ram destroyed) keeps the recorded
// tile. Variant 2's FactionAbility is Repair, which doesn't move the ship.
// Shared by GameDisplay, GameDisplayWeb2 and SimulatedGameDisplay.

type AnyId = number | bigint | string;

export function lastMoveEndPosition(params: {
  lastMove: { shipId: AnyId; newRow: number; newCol: number; actionType: number | ActionType };
  moverVariant: number | null | undefined;
  shipPositions: readonly { shipId: AnyId; position: { row: number; col: number }; status?: number }[];
}): { row: number; col: number } {
  const { lastMove, moverVariant, shipPositions } = params;
  const recorded = { row: lastMove.newRow, col: lastMove.newCol };
  const isRam = Number(lastMove.actionType) === ActionType.FactionAbility && Number(moverVariant) !== 2;
  if (!isRam) return recorded;
  const mover = shipPositions.find(
    (p) => String(p.shipId) === String(lastMove.shipId) && (p.status ?? 0) === 0,
  );
  return mover ? { row: mover.position.row, col: mover.position.col } : recorded;
}
