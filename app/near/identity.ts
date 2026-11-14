/**
 * Player identity on NEAR. Dynamic supports NEAR as a "Tier 2" chain: the
 * Solana embedded wallet's Ed25519 key is the player's NEAR key, and their
 * account is the NEAR *implicit account* for it (the 64-char hex of the
 * public key). It exists on chain once something sends it NEAR (the faucet,
 * app/api/faucet/near).
 */
import { baseDecode, baseEncode } from "near-api-js";

/** Solana address (base58 Ed25519 public key) -> raw 32-byte public key. */
export function solanaAddressToPublicKeyBytes(solanaAddress: string): Uint8Array {
  const bytes = baseDecode(solanaAddress);
  if (bytes.length !== 32) throw new Error(`Not an Ed25519 public key: ${solanaAddress}`);
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** The NEAR implicit account for a Solana (Ed25519) address. */
export function implicitAccountFromSolanaAddress(solanaAddress: string): string {
  return bytesToHex(solanaAddressToPublicKeyBytes(solanaAddress));
}

/** NEAR's "ed25519:<base58>" public key string for a Solana address. */
export function nearPublicKeyFromSolanaAddress(solanaAddress: string): string {
  return `ed25519:${baseEncode(solanaAddressToPublicKeyBytes(solanaAddress))}`;
}

/** 64 lowercase hex chars: a NEAR implicit account. */
export function isImplicitAccount(accountId: string): boolean {
  return /^[0-9a-f]{64}$/.test(accountId);
}

/** Short display form: implicit accounts as "a1b2c3…d4e5", named accounts as-is. */
export function shortAccount(accountId: string | null | undefined): string {
  if (!accountId) return "";
  return isImplicitAccount(accountId) ? `${accountId.slice(0, 6)}…${accountId.slice(-4)}` : accountId;
}
