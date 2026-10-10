import { describe, it, expect } from "vitest";
import {
  keepUnchangedGameSnapshot,
  keepUnchangedGamesList,
  shareUnchangedGameData,
  toOnChainActionType,
  isOlderGameState,
} from "../normalizeGameDataView";
import { ActionType } from "../../types/types";

function boardSnapshot(score = 0) {
  return {
    metadata: { winner: "0x0" },
    turnState: {
      currentTurn: "0x1",
      currentRound: 1,
      turnStartTime: 100,
    },
    creatorScore: score,
    joinerScore: 0,
    lastMove: {
      timestamp: 1,
      shipId: 9,
      targetShipId: 0,
      oldRow: 1,
      oldCol: 1,
      newRow: 1,
      newCol: 2,
      actionType: ActionType.Pass,
    },
    shipPositions: [
      { shipId: 9, position: { row: 1, col: 2 }, status: 0 },
    ],
    shipAttributes: [{ hullPoints: 10, reactorCriticalTimer: 0 }],
    creatorMovedShipIds: [9],
    joinerMovedShipIds: [],
  };
}

// Regression coverage for the "Ram/Repair submitted as ActionType.Pass"
// bug (docs/eth-global-remote/frontend-handoff-attributes-costs-and-ai-2026-09-21.md
// §9): the shared ActionType enum numbers FactionAbility as 7 to avoid
// colliding with web2-only ClaimPoints(5), but the real on-chain
// enum only goes 0-5 and reverts on anything else — so every real
// `moveShip` call must translate 7 back down to 5 first.
describe("toOnChainActionType", () => {
  it("maps the shared enum's FactionAbility (7) to the real on-chain value (5)", () => {
    expect(ActionType.FactionAbility).toBe(7);
    expect(toOnChainActionType(ActionType.FactionAbility)).toBe(5);
  });

  it("leaves every value that matches on-chain 1:1 unchanged", () => {
    expect(toOnChainActionType(ActionType.Pass)).toBe(ActionType.Pass);
    expect(toOnChainActionType(ActionType.Shoot)).toBe(ActionType.Shoot);
    expect(toOnChainActionType(ActionType.Retreat)).toBe(ActionType.Retreat);
    expect(toOnChainActionType(ActionType.Assist)).toBe(ActionType.Assist);
    expect(toOnChainActionType(ActionType.Special)).toBe(ActionType.Special);
  });
});

describe("keepUnchangedGameSnapshot", () => {
  it("returns the previous object when the board fingerprint matches", () => {
    const previous = boardSnapshot(0);
    const next = boardSnapshot(0);
    expect(keepUnchangedGameSnapshot(previous, next)).toBe(previous);
  });

  it("returns the new object when scores (or other board fields) change", () => {
    const previous = boardSnapshot(0);
    const next = boardSnapshot(1);
    expect(keepUnchangedGameSnapshot(previous, next)).toBe(next);
  });
});

describe("keepUnchangedGamesList", () => {
  it("returns the previous array when every match fingerprint matches", () => {
    const previous = [{ ...boardSnapshot(0), metadata: { winner: "0x0", gameId: 3 } }];
    const next = [{ ...boardSnapshot(0), metadata: { winner: "0x0", gameId: 3 } }];
    expect(keepUnchangedGamesList(previous, next)).toBe(previous);
  });

  it("returns the new array when a match in the list changed", () => {
    const previous = [{ ...boardSnapshot(0), metadata: { winner: "0x0", gameId: 3 } }];
    const next = [{ ...boardSnapshot(1), metadata: { winner: "0x0", gameId: 3 } }];
    expect(keepUnchangedGamesList(previous, next)).toBe(next);
  });
});

describe("shareUnchangedGameData", () => {
  it("reuses the previous query result for an idle poll with the same board", () => {
    const previous = boardSnapshot(0);
    const next = boardSnapshot(0);
    expect(shareUnchangedGameData(previous, next)).toBe(previous);
  });

  it("passes through non-objects", () => {
    expect(shareUnchangedGameData(undefined, boardSnapshot(0))).toEqual(
      boardSnapshot(0),
    );
  });
});

describe("isOlderGameState", () => {
  const snap = (over: { winner?: string; round?: number; ts?: number; moved?: number[] } = {}) => ({
    metadata: { winner: over.winner ?? "0x0000000000000000000000000000000000000000" },
    turnState: { currentTurn: "0xa", currentRound: over.round ?? 1, turnStartTime: 0 },
    creatorScore: 0,
    joinerScore: 0,
    lastMove: { timestamp: over.ts ?? 100, shipId: 1, targetShipId: 0, oldRow: 0, oldCol: 0, newRow: 0, newCol: 1, actionType: 0 },
    shipPositions: [],
    shipAttributes: [],
    creatorMovedShipIds: over.moved ?? [],
    joinerMovedShipIds: [],
  });

  it("rejects a read from before the current one", () => {
    expect(isOlderGameState(snap({ ts: 100 }), snap({ ts: 200 }))).toBe(true);
    expect(isOlderGameState(snap({ round: 1, ts: 300 }), snap({ round: 2, ts: 200 }))).toBe(true);
    expect(isOlderGameState(snap({ ts: 100, moved: [] }), snap({ ts: 100, moved: [1] }))).toBe(true);
    expect(isOlderGameState(snap(), snap({ winner: "0xabc" }))).toBe(true);
  });

  it("accepts equal or newer reads (web2's empty winner counts as none)", () => {
    expect(isOlderGameState(snap({ ts: 200 }), snap({ ts: 100 }))).toBe(false);
    expect(isOlderGameState(snap(), snap())).toBe(false);
    expect(isOlderGameState(snap({ winner: "" }), snap())).toBe(false);
    expect(isOlderGameState(snap({ winner: "user-1" }), snap({ winner: "" }))).toBe(false);
  });
});
