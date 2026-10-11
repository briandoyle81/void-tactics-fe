// Token balances for display, at a fixed number of decimals: ETH (native)
// to 3, UTC to 2. Rounded down, so a balance never reads higher than it is
// (0.0009 ETH shows 0.000, not 0.001).

export const ETH_DISPLAY_DECIMALS = 3;
export const UTC_DISPLAY_DECIMALS = 2;

export function formatBalance(value: number, decimals: number): string {
  if (!Number.isFinite(value)) value = 0;
  const factor = 10 ** decimals;
  const floored = Math.floor(value * factor + 1e-9) / factor;
  return floored.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
