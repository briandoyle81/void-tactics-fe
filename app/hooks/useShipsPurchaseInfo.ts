"use client";

import React from "react";
import { usePriceTiers, tierFields } from "./usePriceTiers";
import type { PurchaseInfoNormalized } from "../utils/normalizePurchaseInfo";

/** Ship packs paid in NEAR: `pricesWei` is each tier's price in yoctoNEAR (purchase_ships_with_near). */
export function useShipsPurchaseInfo() {
  const { data, isLoading, error, refetch } = usePriceTiers();
  const normalized = React.useMemo((): PurchaseInfoNormalized | null => {
    if (!data) return null;
    return { ...tierFields(data), pricesWei: data.map((t) => BigInt(t.near_ship_price)) };
  }, [data]);
  return {
    tierCount: normalized?.tierCount ?? 0,
    tiers: normalized?.tiers ?? [],
    shipsPerTier: normalized?.shipsPerTier ?? [],
    pricesWei: normalized?.pricesWei ?? [],
    normalized,
    isLoading,
    error,
    isFromCache: false,
    refetch: () => void refetch(),
  };
}
