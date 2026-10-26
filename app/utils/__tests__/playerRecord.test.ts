import { describe, expect, it } from "vitest";
import { countWinLoss, splitPlayerRecord } from "../playerRecord";

describe("splitPlayerRecord", () => {
  it("puts the tutorial's result (beyond the PvP games) under PvE", () => {
    const split = splitPlayerRecord({
      stored: { wins: 4, losses: 2 },
      pvpGames: { wins: 3, losses: 2 },
      pveGames: { wins: 5, losses: 1 },
    });
    expect(split.pvp).toEqual({ wins: 3, losses: 2 });
    expect(split.pve).toEqual({ wins: 6, losses: 1 });
    expect(split.total).toEqual({ wins: 9, losses: 3 });
  });

  it("never goes negative when the stored record lags the games", () => {
    const split = splitPlayerRecord({ stored: { wins: 0, losses: 0 }, pvpGames: { wins: 1, losses: 0 }, pveGames: { wins: 0, losses: 0 } });
    expect(split.pve).toEqual({ wins: 0, losses: 0 });
  });
});

describe("countWinLoss", () => {
  it("counts wins and losses, skipping draws and unfinished games", () => {
    expect(countWinLoss(["win", "loss", "draw", null, "win"] as const, (o) => o)).toEqual({ wins: 2, losses: 1 });
  });
});
