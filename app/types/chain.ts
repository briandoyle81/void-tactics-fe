/**
 * A NEAR account id (e.g. a 64-hex implicit account, or "game.void-tactics.testnet").
 * Replaces viem's `Address` across the shared types. The empty string stands
 * for "no account" where the EVM code used the zero address.
 */
export type Address = string;

/** "No account" (was address(0)). */
export const NO_ACCOUNT: Address = "";

export function isNoAccount(a: string | null | undefined): boolean {
  return !a || a === NO_ACCOUNT || /^0x0{40}$/i.test(a);
}

export function sameAccount(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}
