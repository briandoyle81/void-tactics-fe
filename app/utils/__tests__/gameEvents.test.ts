import { beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn();
vi.mock("posthog-js", () => ({ default: { capture: (...args: unknown[]) => capture(...args) } }));

import {
  gameModeOf,
  gameResultOf,
  shouldTrackGameEnded,
  takeRunResult,
  trackGameEnded,
  trackRunRetreated,
  trackRunStarted,
} from "../analytics/gameEvents";

beforeEach(() => {
  capture.mockClear();
  takeRunResult(); // clear run state between tests
});

describe("shouldTrackGameEnded", () => {
  it("fires when a watched game finishes", () => {
    expect(shouldTrackGameEnded({ sawInProgress: true, isOver: true, alreadyTracked: false })).toBe(true);
  });
  it("doesn't fire for a game first seen already over (opened later, or a replay)", () => {
    expect(shouldTrackGameEnded({ sawInProgress: false, isOver: true, alreadyTracked: false })).toBe(false);
  });
  it("fires only once per game", () => {
    expect(shouldTrackGameEnded({ sawInProgress: true, isOver: true, alreadyTracked: true })).toBe(false);
  });
  it("doesn't fire while the game is in progress", () => {
    expect(shouldTrackGameEnded({ sawInProgress: true, isOver: false, alreadyTracked: false })).toBe(false);
  });
});

describe("gameModeOf", () => {
  it("prefers roguelike, then campaign, then other vs-AI, else PvP", () => {
    expect(gameModeOf({ isRoguelikeGame: true, isSinglePlayerGame: false, isVsAIGame: true })).toBe("roguelike");
    expect(gameModeOf({ isRoguelikeGame: false, isSinglePlayerGame: true, isVsAIGame: true })).toBe("campaign");
    expect(gameModeOf({ isRoguelikeGame: false, isSinglePlayerGame: false, isVsAIGame: true })).toBe("vs_ai");
    expect(gameModeOf({ isRoguelikeGame: false, isSinglePlayerGame: false, isVsAIGame: false })).toBe("pvp");
  });
});

describe("gameResultOf", () => {
  it("maps the view's winner to a result", () => {
    expect(gameResultOf(null)).toBeNull();
    expect(gameResultOf("me")).toBe("won");
    expect(gameResultOf("opponent")).toBe("lost");
    expect(gameResultOf("tie")).toBe("tie");
  });
});

describe("takeRunResult", () => {
  const ended = (result: "won" | "lost", retreated = false) =>
    trackGameEnded({ appMode: "web3", gameMode: "roguelike", gameId: 1, result, retreated });

  it("is lost after a lost mission", () => {
    trackRunStarted({ appMode: "web3", campaignId: 1, fleetSize: 3 });
    ended("won");
    ended("lost");
    expect(takeRunResult()).toBe("lost");
  });
  it("is won when the last mission was won", () => {
    trackRunStarted({ appMode: "web2", campaignId: 1, fleetSize: 3 });
    ended("won");
    expect(takeRunResult()).toBe("won");
  });
  it("is retreated after a retreat from the map", () => {
    trackRunStarted({ appMode: "web3", campaignId: 1, fleetSize: 3 });
    ended("won");
    trackRunRetreated({ appMode: "web3", midCombat: false });
    expect(takeRunResult()).toBe("retreated");
  });
  it("is retreated after fleeing an Operations match", () => {
    trackRunStarted({ appMode: "web3", campaignId: 1, fleetSize: 3 });
    ended("lost", true);
    expect(takeRunResult()).toBe("retreated");
  });
  it("ignores PvP and campaign results", () => {
    trackRunStarted({ appMode: "web3", campaignId: 1, fleetSize: 3 });
    ended("won");
    trackGameEnded({ appMode: "web3", gameMode: "pvp", gameId: 2, result: "lost", retreated: true });
    expect(takeRunResult()).toBe("won");
  });
  it("resets after reading", () => {
    trackRunStarted({ appMode: "web3", campaignId: 1, fleetSize: 3 });
    ended("won");
    takeRunResult();
    expect(takeRunResult()).toBe("lost");
  });
});

describe("event payloads", () => {
  it("sends ids as strings and the mode", () => {
    trackGameEnded({ appMode: "web2", gameMode: "campaign", gameId: 12n, result: "won", retreated: false, round: 3 });
    expect(capture).toHaveBeenCalledWith("game_ended", {
      app_mode: "web2",
      game_mode: "campaign",
      game_id: "12",
      result: "won",
      retreated: false,
      round: 3,
    });
  });
});
