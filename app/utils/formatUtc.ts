// UTC amounts for players, always to UTC_DECIMALS places (e.g. "0.0150").

const UTC_DECIMALS = 4;
const WEI_PER_STEP = 10n ** BigInt(18 - UTC_DECIMALS);

/** A web3 amount in wei (18 decimals), rounded to the nearest 0.0001 with exact integer maths. */
export function formatUtcWei(wei: bigint): string {
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const steps = (abs + WEI_PER_STEP / 2n) / WEI_PER_STEP;
  const whole = steps / 10n ** BigInt(UTC_DECIMALS);
  const frac = (steps % 10n ** BigInt(UTC_DECIMALS)).toString().padStart(UTC_DECIMALS, "0");
  return `${negative && steps > 0n ? "-" : ""}${whole}.${frac}`;
}

/** A web2 amount (a plain number of UTC). */
export function formatUtc(amount: number): string {
  return (Number.isFinite(amount) ? amount : 0).toFixed(UTC_DECIMALS);
}
