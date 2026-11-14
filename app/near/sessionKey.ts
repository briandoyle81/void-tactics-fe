/**
 * The session key: a function-call access key, limited to the game
 * contract, that lives in this browser and signs every deposit-free call
 * (moves, fleets, lobbies, claims, AI turns) with no wallet prompt. Its
 * allowance only pays gas; it can't move NEAR, ships or tokens (those need
 * a deposit, so they go through the Dynamic wallet).
 *
 * Stored in localStorage per network, account and contract. Losing it is
 * harmless: onboarding adds a new one.
 */
import { KeyPair, type KeyPairString } from "near-api-js";
import { GAME_CONTRACT, NEAR_NETWORK } from "./config";

const PREFIX = "vt-near-session-key:v1";

function storageKey(accountId: string): string {
  return `${PREFIX}:${NEAR_NETWORK}:${accountId}:${GAME_CONTRACT}`;
}

export function loadSessionKey(accountId: string): KeyPair | null {
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    return raw ? KeyPair.fromString(raw as KeyPairString) : null;
  } catch {
    return null;
  }
}

/** The stored key, or a new one (stored, but not on chain until onboarding adds it). */
export function loadOrCreateSessionKey(accountId: string): KeyPair {
  const existing = loadSessionKey(accountId);
  if (existing) return existing;
  const kp = KeyPair.fromRandom("ed25519");
  try {
    localStorage.setItem(storageKey(accountId), kp.toString());
  } catch {
    // Storage unavailable: the key lives for this page only.
  }
  return kp;
}

export function clearSessionKey(accountId: string): void {
  try {
    localStorage.removeItem(storageKey(accountId));
  } catch {
    // ignore
  }
}
