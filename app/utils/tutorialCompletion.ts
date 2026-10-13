import { TUTORIAL_COMPLETED_STEPS_KEY } from "../types/onboarding";

// Whether a player has done the tutorial ("first battle"), from what this
// device knows. Players who haven't get it as the first mission on the
// Operations map (tutorialPrelude.ts); useTutorialCompleted /
// useTutorialCompletedWeb2 add the on-chain claim and the web2 account flag.

// Fired when any of these records change, so screens that stay mounted
// (the Operations map is kept alive) re-read them.
export const TUTORIAL_COMPLETION_CHANGED_EVENT = "vt-tutorial-completion-changed";

export function notifyTutorialCompletionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TUTORIAL_COMPLETION_CHANGED_EVENT));
}

// Set when the player reaches a completion step. The tutorial only records a
// step in TUTORIAL_COMPLETED_STEPS_KEY on leaving it, which the last step
// never is, and Replay clears that list.
const FINISHED_KEY = "vt-tutorial-finished-v1";

/** Finished the tutorial on this device (reached either completion step). */
export function hasCompletedFirstBattle(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(FINISHED_KEY) === "1") return true;
    const ids: string[] = JSON.parse(localStorage.getItem(TUTORIAL_COMPLETED_STEPS_KEY) ?? "[]");
    return ids.includes("completion-retreat") || ids.includes("completion-sniper");
  } catch {
    return false;
  }
}

export function isTutorialCompletionStep(stepId: string | undefined): boolean {
  return stepId === "completion-retreat" || stepId === "completion-sniper";
}

export function persistFirstBattleFinished(): void {
  if (typeof window === "undefined") return;
  markKnownPlayer();
  try {
    if (localStorage.getItem(FINISHED_KEY) === "1") return;
    localStorage.setItem(FINISHED_KEY, "1");
  } catch {
    return;
  }
  notifyTutorialCompletionChanged();
}

// A player this browser has seen before: they've signed in here, finished
// the battle, or chose "Sign in" from it. Signed out, a known player gets
// the sign-in screen at /play; anyone else goes straight into the battle
// (see signedOutLanding).
const KNOWN_PLAYER_KEY = "vt-known-player-v1";

export function isKnownPlayer(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KNOWN_PLAYER_KEY) === "1";
  } catch {
    return false;
  }
}

export function markKnownPlayer(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KNOWN_PLAYER_KEY, "1");
  } catch {
    // Storage unavailable: they're offered the battle again next visit.
  }
}

/**
 * What a signed-out visitor sees at /play: a new player lands on the
 * Operations map with First Contact as their first mission (no account
 * needed to play it). The sign-in screen instead for a returning player, a
 * link to a particular screen or `?signin=1`, or when they asked to sign in
 * (Sign Up/Login, Skip Tutorial, or leaving the battle via Sign in).
 */
export function signedOutLanding(params: {
  knownPlayer: boolean;
  hasDeepLink: boolean;
  wantsSignIn: boolean;
}): "map" | "signIn" {
  return params.knownPlayer || params.hasDeepLink || params.wantsSignIn ? "signIn" : "map";
}

// Where to go when the tutorial closes. Kept in storage, like the
// tutorial's own step, so a refresh mid-battle still returns there.
const RETURN_TO_KEY = "vt-tutorial-return-to-v1";
export const START_TUTORIAL_EVENT = "void-tactics-start-tutorial";
export type TutorialReturnTo = "mission";

/** Opens the tutorial from the Operations map; closing it returns there. */
export function startTutorialFromOperations(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(START_TUTORIAL_EVENT, { detail: { returnTo: "mission" } }));
}

export function getTutorialReturnTo(): TutorialReturnTo | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(RETURN_TO_KEY) === "mission" ? "mission" : null;
  } catch {
    return null;
  }
}

export function setTutorialReturnTo(returnTo: TutorialReturnTo | null): void {
  if (typeof window === "undefined") return;
  try {
    if (returnTo) localStorage.setItem(RETURN_TO_KEY, returnTo);
    else localStorage.removeItem(RETURN_TO_KEY);
  } catch {
    // Storage unavailable: closing returns to the Command Deck.
  }
}

// Skipped from the Operations map, per player (web3 address or web2 user id).
const SKIPPED_KEY = "vt-tutorial-skipped-v1";

function readFlags(storageKey: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

// Skipped before signing in (Skip Tutorial on the signed-out map): counts
// for whoever signs in on this device.
const SIGNED_OUT_SKIP = "*";

export function hasSkippedTutorial(playerKey: string): boolean {
  if (typeof window === "undefined") return false;
  const flags = readFlags(SKIPPED_KEY);
  return flags[playerKey.toLowerCase()] === true || flags[SIGNED_OUT_SKIP] === true;
}

/**
 * Skip Tutorial while signed out (it then asks them to sign in). Also marks
 * the browser as a player's, so /play keeps showing sign-in, not the map.
 */
export function persistTutorialSkippedSignedOut(): void {
  persistTutorialSkipped(SIGNED_OUT_SKIP);
  markKnownPlayer();
}

export function persistTutorialSkipped(playerKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const flags = readFlags(SKIPPED_KEY);
    flags[playerKey.toLowerCase()] = true;
    localStorage.setItem(SKIPPED_KEY, JSON.stringify(flags));
  } catch {
    // Storage unavailable: the prelude shows again next visit.
  }
  notifyTutorialCompletionChanged();
}

/** Once true per chain+wallet, tutorial claim never reverts; cache indefinitely. */
const TUTORIAL_CLAIM_COMPLETED_CACHE_KEY = "void-tactics-tutorial-claim-completed";

export function isTutorialClaimCompletedCached(chainId: number, walletAddress: string): boolean {
  if (typeof window === "undefined") return false;
  return readFlags(TUTORIAL_CLAIM_COMPLETED_CACHE_KEY)[`${chainId}:${walletAddress.toLowerCase()}`] === true;
}

export function persistTutorialClaimCompleted(chainId: number, walletAddress: string): void {
  if (typeof window === "undefined") return;
  try {
    const flags = readFlags(TUTORIAL_CLAIM_COMPLETED_CACHE_KEY);
    flags[`${chainId}:${walletAddress.toLowerCase()}`] = true;
    window.localStorage.setItem(TUTORIAL_CLAIM_COMPLETED_CACHE_KEY, JSON.stringify(flags));
  } catch {
    // Quota or disabled storage
  }
  notifyTutorialCompletionChanged();
}

/** Dev: clear local "already claimed" cache when tutorial reward contract or rewards change. */
export function clearTutorialClaimCompletedCacheEntry(chainId: number, walletAddress: string): void {
  if (typeof window === "undefined") return;
  try {
    const flags = readFlags(TUTORIAL_CLAIM_COMPLETED_CACHE_KEY);
    delete flags[`${chainId}:${walletAddress.toLowerCase()}`];
    if (Object.keys(flags).length === 0) {
      window.localStorage.removeItem(TUTORIAL_CLAIM_COMPLETED_CACHE_KEY);
    } else {
      window.localStorage.setItem(TUTORIAL_CLAIM_COMPLETED_CACHE_KEY, JSON.stringify(flags));
    }
  } catch {
    // Corrupt or disabled storage
  }
}
