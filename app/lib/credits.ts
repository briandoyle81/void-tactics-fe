// Web2 keeps UTC as whole-number credits (User.creditBalance and every
// credit amount in Postgres and the economy configs are Int): one credit is
// 0.01 UTC. That gives web2 the same prices as the chain, which counts UTC in
// 18 decimals: a 5-ship pack is 499 credits = 4.99 UTC, recycling a ship pays
// 10 credits = 0.1 UTC, a repair is 1 credit = 0.01 UTC per HP. Amounts stay
// in credits through the API; screens show them as UTC with these helpers.
// Client-safe (no server imports).

export const CREDITS_PER_UTC = 100;

/** Credits as a plain number of UTC (499 -> 4.99). */
export function creditsToUtc(credits: number): number {
  return (Number.isFinite(credits) ? credits : 0) / CREDITS_PER_UTC;
}

/** A UTC amount typed by a player or admin, as whole credits (4.99 -> 499). */
export function utcToCredits(utc: number): number {
  return Math.round((Number.isFinite(utc) ? utc : 0) * CREDITS_PER_UTC);
}

/** Credits for display as UTC, with no trailing zeros (499 -> "4.99", 10 -> "0.1", 100 -> "1"). */
export function formatCreditsUtc(credits: number): string {
  return String(Number(creditsToUtc(credits).toFixed(2)));
}
