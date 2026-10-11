import { describe, expect, it } from "vitest";
import { ActionType } from "../../types/types";
import { lastMoveEndPosition } from "../ramLastMove";

const positions = [
  { shipId: 1n, position: { row: 3, col: 5 }, status: 0 },
  { shipId: 2n, position: { row: 7, col: 7 }, status: 1 },
];

describe("lastMoveEndPosition", () => {
  it("uses the rammer's current tile (the victim's) for a variant-1 ram", () => {
    const lastMove = { shipId: 1n, newRow: 3, newCol: 4, actionType: ActionType.FactionAbility };
    expect(lastMoveEndPosition({ lastMove, moverVariant: 1, shipPositions: positions })).toEqual({ row: 3, col: 5 });
  });

  it("keeps the recorded tile for Repair, other actions, and a rammer its ram destroyed", () => {
    const repair = { shipId: 1n, newRow: 3, newCol: 4, actionType: ActionType.FactionAbility };
    expect(lastMoveEndPosition({ lastMove: repair, moverVariant: 2, shipPositions: positions })).toEqual({ row: 3, col: 4 });
    const shot = { shipId: 1n, newRow: 3, newCol: 4, actionType: ActionType.Shoot };
    expect(lastMoveEndPosition({ lastMove: shot, moverVariant: 1, shipPositions: positions })).toEqual({ row: 3, col: 4 });
    const selfDestruct = { shipId: 2n, newRow: 7, newCol: 6, actionType: ActionType.FactionAbility };
    expect(lastMoveEndPosition({ lastMove: selfDestruct, moverVariant: 1, shipPositions: positions })).toEqual({ row: 7, col: 6 });
  });
});
