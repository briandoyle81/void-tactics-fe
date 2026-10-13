import { describe, expect, it } from "vitest";
import { signedOutLanding } from "../tutorialCompletion";

describe("signedOutLanding", () => {
  const fresh = { knownPlayer: false, hasDeepLink: false, leftBattleThisVisit: false };

  it("sends a new player straight into the battle", () => {
    expect(signedOutLanding(fresh)).toBe("battle");
  });

  it("shows sign-in to a returning player", () => {
    expect(signedOutLanding({ ...fresh, knownPlayer: true })).toBe("signIn");
  });

  it("shows sign-in for a link to a particular screen", () => {
    expect(signedOutLanding({ ...fresh, hasDeepLink: true })).toBe("signIn");
  });

  it("doesn't reopen the battle after the player left it", () => {
    expect(signedOutLanding({ ...fresh, leftBattleThisVisit: true })).toBe("signIn");
  });
});
