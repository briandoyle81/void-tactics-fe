"use client";

import React from "react";
import { usePriceTiers, tierFields } from "./usePriceTiers";
import type { PurchaseInfoNormalized } from "../utils/normalizePurchaseInfo";

/**
 * The same tiers priced in UTC: `pricesWei` is each pack's UTC price
 * (18 decimals; purchase_ships_with_utc, and the UTC buy_utc_with_near
 * mints), `flowPricesWei` the NEAR price of that UTC (yoctoNEAR;
 * buy_utc_with_near).
 */
export function useShipPurchaserPurchaseInfo() {
  const { data, isLoading, error, refetch } = usePriceTiers();
  const normalized = React.useMemo((): PurchaseInfoNormalized | null => {
    if (!data) return null;
    return { ...tierFields(data), pricesWei: data.map((t) => BigInt(t.utc_price)) };
  }, [data]);
  const flowPricesWei = React.useMemo(() => (data ?? []).map((t) => BigInt(t.near_utc_price)), [data]);
  return {
    tierCount: normalized?.tierCount ?? 0,
    tiers: normalized?.tiers ?? [],
    shipsPerTier: normalized?.shipsPerTier ?? [],
    pricesWei: normalized?.pricesWei ?? [],
    flowPricesWei,
    normalized,
    isLoading,
    error,
    isFromCache: false,
    refetch: () => void refetch(),
    purchaserDeployed: true,
  };
}
