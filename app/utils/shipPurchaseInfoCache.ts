import type { PurchaseInfoNormalized } from "./normalizePurchaseInfo";
import { getContractAddresses } from "../config/contractAddresses";

/** "shipPurchaserFlow" is ShipPurchaser's getFlowPurchaseInfo (native-token prices). */
export type ShipPurchaseInfoKind = "ships" | "shipPurchaser" | "shipPurchaserFlow";

const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

// Keyed by the contract's address too, so a redeploy never serves the old
// deployment's prices (a stale ETH price makes every purchase revert).
function storageKey(chainId: number, kind: ShipPurchaseInfoKind): string {
  const addresses = getContractAddresses(chainId);
  const address = String(kind === "ships" ? addresses.SHIPS : addresses.SHIP_PURCHASER).toLowerCase();
  return `warpflow-purchase-info-v2-${chainId}-${address}-${kind}`;
}

interface CachedPayload {
  timestamp: number;
  chainId: number;
  tierShips: number[];
  tierPricesWei: string[];
}

export function readValidShipPurchaseInfoCache(
  chainId: number,
  kind: ShipPurchaseInfoKind,
): PurchaseInfoNormalized | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(chainId, kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (
      parsed.chainId !== chainId ||
      Date.now() - parsed.timestamp >= CACHE_MS ||
      !Array.isArray(parsed.tierShips) ||
      !Array.isArray(parsed.tierPricesWei) ||
      parsed.tierShips.length === 0 ||
      parsed.tierShips.length !== parsed.tierPricesWei.length
    ) {
      localStorage.removeItem(storageKey(chainId, kind));
      return null;
    }
    const n = parsed.tierShips.length;
    return {
      tierCount: n,
      tiers: Array.from({ length: n }, (_, i) => i),
      shipsPerTier: parsed.tierShips.map((x) =>
        Math.min(255, Math.max(0, Math.floor(Number(x)))),
      ),
      pricesWei: parsed.tierPricesWei.map((s) => BigInt(s)),
    };
  } catch {
    localStorage.removeItem(storageKey(chainId, kind));
    return null;
  }
}

export function writeShipPurchaseInfoCache(
  chainId: number,
  kind: ShipPurchaseInfoKind,
  info: PurchaseInfoNormalized,
): void {
  if (typeof window === "undefined") return;
  if (info.tierCount === 0) return;
  try {
    const payload: CachedPayload = {
      timestamp: Date.now(),
      chainId,
      tierShips: info.shipsPerTier,
      tierPricesWei: info.pricesWei.map((p) => p.toString()),
    };
    localStorage.setItem(storageKey(chainId, kind), JSON.stringify(payload));
  } catch (e) {
    console.warn("writeShipPurchaseInfoCache failed:", e);
  }
}

export function invalidateShipPurchaseInfoCache(
  chainId: number,
  kind: ShipPurchaseInfoKind,
): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(chainId, kind));
}

/** Clears every cached ship pack price list (Ships, and ShipPurchaser's UTC and native) for one chain. */
export function invalidateAllShipPurchasePriceCachesForChain(
  chainId: number,
): void {
  invalidateShipPurchaseInfoCache(chainId, "ships");
  invalidateShipPurchaseInfoCache(chainId, "shipPurchaser");
  invalidateShipPurchaseInfoCache(chainId, "shipPurchaserFlow");
}
