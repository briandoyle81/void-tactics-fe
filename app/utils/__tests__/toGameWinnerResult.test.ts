import { describe, expect, it } from "vitest";
import { toGameWinnerResult } from "../toGameDisplayData";

describe("toGameWinnerResult", () => {
  const me = "a".repeat(64);

  it("reads a NEAR game with no winner yet (\"\") as still being played", () => {
    expect(toGameWinnerResult("", me)).toBeNull();
  });

  it("still accepts the EVM zero address as no winner", () => {
    expect(toGameWinnerResult("0x0000000000000000000000000000000000000000", me)).toBeNull();
  });

  it("tells a win from a loss", () => {
    expect(toGameWinnerResult(me, me)).toBe("me");
    expect(toGameWinnerResult("game.void-tactics.testnet", me)).toBe("opponent");
  });
});
