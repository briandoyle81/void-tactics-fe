import { describe, expect, it, vi } from "vitest";
import type { Log } from "viem";
import { toGameMoveLogs } from "../gameMoveLogs";
import { ActionType } from "../../types/types";

// The deployed artifacts' "#" paths don't load under vitest; only the Move event is needed.
vi.mock("../../config/contracts", () => ({
  CONTRACT_ABIS: {
    GAME: [
      {
        type: "event",
        name: "Move",
        anonymous: false,
        inputs: [
          { indexed: true, name: "gameId", type: "uint256" },
          { indexed: false, name: "shipId", type: "uint256" },
          { indexed: false, name: "oldRow", type: "int16" },
          { indexed: false, name: "oldCol", type: "int16" },
          { indexed: false, name: "newRow", type: "int16" },
          { indexed: false, name: "newCol", type: "int16" },
          { indexed: false, name: "actionType", type: "uint8" },
          { indexed: false, name: "targetShipId", type: "uint256" },
        ],
      },
    ],
  },
}));

const log = (actionType: number) =>
  ({
    transactionHash: "0xabc",
    logIndex: 8,
    blockNumber: 1n,
    args: { gameId: 5n, shipId: 9n, oldRow: 9, oldCol: 11, newRow: 9, newCol: 10, actionType, targetShipId: 3n },
  }) as unknown as Log & { args?: unknown };

describe("toGameMoveLogs", () => {
  it("reads a faction ability (5 on chain) as the app's ActionType.FactionAbility, as lastMove is", () => {
    expect(toGameMoveLogs([log(5)])[0].actionType).toBe(ActionType.FactionAbility);
  });
  it("keeps the other action types", () => {
    expect(toGameMoveLogs([log(1), log(4)]).map((m) => m.actionType)).toEqual([1, 4]);
  });
});
