// Token balances for display, at a fixed number of decimals: ETH (native)
// to 4, UTC to 2. Rounded down, so a balance never reads higher than it is
// (0.00009 ETH shows 0.0000, not 0.0001).

export const ETH_DISPLAY_DECIMALS = 4;
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

/**
 * A short balance for tight spaces (the HUD on phones): 1,234.56 → "1.2k",
 * 2,500,000 → "2.5m", 12.34 → "12.3", 456.7 → "456". Rounded down like
 * formatBalance, so it never reads higher than the balance.
 */
export function formatBalanceCompact(value: number): string {
  if (!Number.isFinite(value) || value < 0) value = 0;
  const floorTo = (n: number, step: number) => Math.floor(n / step + 1e-9) * step;
  const trim = (n: number) => String(Number(n.toFixed(1)));
  if (value >= 1_000_000) return `${trim(floorTo(value / 1_000_000, 0.1))}m`;
  if (value >= 1_000) return `${trim(floorTo(value / 1_000, 0.1))}k`;
  if (value >= 100) return String(Math.floor(value));
  return trim(floorTo(value, 0.1));
}
