"use client";

import React from "react";
import { useReadContract } from "wagmi";
import { CONTRACT_ABIS, getContractAddresses } from "../config/contracts";
import { useSelectedChainId } from "./useSelectedChainId";
import { normalizeGetPurchaseInfoTuple } from "../utils/normalizePurchaseInfo";
import {
  readValidShipPurchaseInfoCache,
  writeShipPurchaseInfoCache,
  invalidateShipPurchaseInfoCache,
  type ShipPurchaseInfoKind,
} from "../utils/shipPurchaseInfoCache";

const ZERO = "0x0000000000000000000000000000000000000000";
const SHIP_PURCHASER_ABI = CONTRACT_ABIS.SHIP_PURCHASER;

/** One of ShipPurchaser's (tierShips, prices) views, through the localStorage cache. */
function usePurchaserTiers(
  chainId: number,
  address: `0x${string}`,
  deployed: boolean,
  functionName: "getPurchaseInfo" | "getFlowPurchaseInfo",
  kind: ShipPurchaseInfoKind,
) {
  const [reloadKey, setReloadKey] = React.useState(0);

  const fromCache = React.useMemo(() => {
    if (!deployed) return null;
    return readValidShipPurchaseInfoCache(chainId, kind);
    // reloadKey forces a fresh cache read after refetch().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, deployed, kind, reloadKey]);

  const shouldFetch = deployed && fromCache === null;

  const { data, isLoading, error, refetch } = useReadContract({
    address,
    abi: SHIP_PURCHASER_ABI,
    chainId,
    functionName,
    query: { enabled: shouldFetch },
  });

  React.useEffect(() => {
    if (!data || !deployed) return;
    const normalized = normalizeGetPurchaseInfoTuple(data);
    if (normalized && normalized.tierCount > 0) {
      writeShipPurchaseInfoCache(chainId, kind, normalized);
    }
  }, [data, chainId, deployed, kind]);

  const normalized = React.useMemo(() => {
    if (fromCache) return fromCache;
    return normalizeGetPurchaseInfoTuple(data);
  }, [fromCache, data]);

  const refetchFromChain = React.useCallback(() => {
    invalidateShipPurchaseInfoCache(chainId, kind);
    setReloadKey((k) => k + 1);
    void refetch();
  }, [chainId, kind, refetch]);

  return {
    normalized,
    isLoading: shouldFetch && isLoading,
    error,
    isFromCache: fromCache !== null,
    refetch: refetchFromChain,
  };
}

/**
 * ShipPurchaser's two price lists for the same tiers: `pricesWei` is each
 * pack's UTC price (getPurchaseInfo, paid by purchaseWithUTC, and the UTC that
 * purchaseUTCWithFlow mints), `flowPricesWei` is its native-token price
 * (getFlowPurchaseInfo, paid by purchaseUTCWithFlow).
 */
export function useShipPurchaserPurchaseInfo() {
  const chainId = useSelectedChainId();
  const purchaserAddr = getContractAddresses(chainId).SHIP_PURCHASER as `0x${string}`;
  const purchaserDeployed =
    Boolean(purchaserAddr) &&
    purchaserAddr.toLowerCase() !== ZERO.toLowerCase();

  const utc = usePurchaserTiers(chainId, purchaserAddr, purchaserDeployed, "getPurchaseInfo", "shipPurchaser");
  const flow = usePurchaserTiers(chainId, purchaserAddr, purchaserDeployed, "getFlowPurchaseInfo", "shipPurchaserFlow");
  const refetchUtc = utc.refetch;
  const refetchFlow = flow.refetch;

  const refetch = React.useCallback(() => {
    refetchUtc();
    refetchFlow();
  }, [refetchUtc, refetchFlow]);

  return {
    tierCount: utc.normalized?.tierCount ?? 0,
    tiers: utc.normalized?.tiers ?? [],
    shipsPerTier: utc.normalized?.shipsPerTier ?? [],
    pricesWei: utc.normalized?.pricesWei ?? [],
    flowPricesWei: flow.normalized?.pricesWei ?? [],
    normalized: utc.normalized,
    isLoading: utc.isLoading || flow.isLoading,
    error: utc.error ?? flow.error,
    isFromCache: utc.isFromCache && flow.isFromCache,
    refetch,
    purchaserDeployed,
  };
}
