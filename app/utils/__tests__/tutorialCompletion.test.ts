import { describe, expect, it } from "vitest";
import { signedOutLanding } from "../tutorialCompletion";

describe("signedOutLanding", () => {
  const fresh = { knownPlayer: false, hasDeepLink: false, wantsSignIn: false };

  it("shows a new player the map, First Contact first", () => {
    expect(signedOutLanding(fresh)).toBe("map");
  });

  it("shows sign-in to a returning player", () => {
    expect(signedOutLanding({ ...fresh, knownPlayer: true })).toBe("signIn");
  });

  it("shows sign-in for a link to a particular screen", () => {
    expect(signedOutLanding({ ...fresh, hasDeepLink: true })).toBe("signIn");
  });

  it("shows sign-in when they asked for it (Sign Up/Login, Skip Tutorial)", () => {
    expect(signedOutLanding({ ...fresh, wantsSignIn: true })).toBe("signIn");
  });
});
