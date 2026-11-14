"use client";

import { useNearView } from "../near/useNearView";
import type { PriceTier } from "../near/generated/voidTactics";

export const PRICE_TIERS_STALE_MS = 5 * 60_000;

/**
 * Ship pack prices (get_price_tiers): one table, tier by tier, with each
 * pack's size, its NEAR price, its UTC price, and the NEAR price of buying
 * that much UTC. NEAR prices are yoctoNEAR (24 decimals); UTC has 18.
 */
export function usePriceTiers() {
  return useNearView("get_price_tiers", {}, { staleTime: PRICE_TIERS_STALE_MS });
}

export function tierFields(tiers: PriceTier[] | undefined) {
  const list = tiers ?? [];
  return {
    tierCount: list.length,
    tiers: list.map((_, i) => i),
    shipsPerTier: list.map((t) => t.ships),
  };
}
