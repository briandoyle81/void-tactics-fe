import { describe, expect, it } from "vitest";
import { aiMovesFromTurns } from "../gameMoveLogs";
import { ActionType } from "../../types/types";
import type { NearEvent } from "../../near/codec";
import type { GameState, ShipBoard } from "../../near/generated/voidTactics";

const board = (row: number, col: number): ShipBoard =>
  ({ row, col, is_creator: false, status: 0, placed: true } as unknown as ShipBoard);

const state = (rows: Record<string, ShipBoard>): GameState => ({ board: rows } as unknown as GameState);

const aiTurns = (turns: unknown[]): NearEvent => ({
  standard: "void_tactics",
  version: "1.0.0",
  event: "ai_turns",
  data: { game_id: "5", turns },
});

describe("aiMovesFromTurns", () => {
  it("takes each ship's from/to tiles from the boards around the transaction", () => {
    const moves = aiMovesFromTurns(
      "hash",
      [aiTurns([{ ship_id: "9", action: "Shoot", target: "3" }])],
      state({ "9": board(9, 11) }),
      state({ "9": board(9, 10) }),
    );
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({
      gameId: 5,
      shipId: 9,
      oldRow: 9,
      oldCol: 11,
      newRow: 9,
      newCol: 10,
      actionType: ActionType.Shoot,
      targetShipId: 3,
    });
  });

  it("reads FactionAbility as the app's ActionType.FactionAbility (7)", () => {
    const moves = aiMovesFromTurns(
      "hash",
      [aiTurns([{ ship_id: "9", action: "FactionAbility", target: "3" }])],
      state({ "9": board(1, 1) }),
      state({ "9": board(1, 2) }),
    );
    expect(moves[0].actionType).toBe(ActionType.FactionAbility);
  });

  it("skips failed decisions and other events", () => {
    const moves = aiMovesFromTurns(
      "hash",
      [aiTurns([{ decision_failed: "9" }]), { ...aiTurns([]), event: "move" }],
      state({ "9": board(1, 1) }),
      state({ "9": board(1, 1) }),
    );
    expect(moves).toEqual([]);
  });
});
