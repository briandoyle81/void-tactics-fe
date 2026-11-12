// Pure/client-safe defaults for the direct "buy UTC with USD" tier list —
// independent from ship-pack pricing (see purchaseTiers.ts). The DB-backed
// live tier list (admin-editable) lives in getUtcPurchaseTiers.ts.

export interface UtcPurchaseTier {
  tier: number;
  utcAmount: number;
  priceUsdCents: number;
}

// utcAmount is in credits (0.01 UTC) and equals the matching ship pack's
// priceUtc (purchaseTiers.ts), as ShipPurchaser.purchaseUTCWithFlow mints
// tierPrices onchain: buying UTC and then ships costs the same as buying the
// ships.
export const UTC_PURCHASE_TIERS: UtcPurchaseTier[] = [
  { tier: 0, utcAmount: 499, priceUsdCents: 499 },
  { tier: 1, utcAmount: 999, priceUsdCents: 999 },
  { tier: 2, utcAmount: 1999, priceUsdCents: 1999 },
  { tier: 3, utcAmount: 3499, priceUsdCents: 3499 },
  { tier: 4, utcAmount: 4999, priceUsdCents: 4999 },
];
