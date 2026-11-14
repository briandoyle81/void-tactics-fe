import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { useChainAccount } from "../near/useChainAccount";
import { useNearSession } from "../near/session";
import { useNearBalance } from "../near/useNearBalance";
import { GAS_HEAVY } from "../near/config";
import { formatNear } from "../near/codec";
import { isUserRejection, shortErrorMessage } from "../near/errors";
import { useOwnedShips } from "./useOwnedShips";
import { useShipsPurchaseInfo } from "./useShipsPurchaseInfo";

/**
 * Ship packs paid in NEAR (purchase_ships_with_near). The attached deposit
 * must be the tier's exact price, which also pays the new ships' storage;
 * the wallet confirms it (deposits never use the session key).
 */
export function useShipPurchasing() {
  const { address } = useChainAccount();
  const { send } = useNearSession();
  const { refetch } = useOwnedShips();
  const { tiers, shipsPerTier, pricesWei, isLoading: isLoadingPurchaseInfo } = useShipsPurchaseInfo();
  const { data: nearBalance, isLoading: isLoadingFlowBalance } = useNearBalance(address);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const purchaseShips = useCallback(
    async (tier: number, variant = 1) => {
      if (!address) {
        toast.error("Please sign in first");
        return;
      }
      if (tier < 0 || tier >= tiers.length) {
        toast.error("Invalid tier selected");
        return;
      }
      const price = pricesWei[tier] ?? BigInt(0);
      if (price === BigInt(0)) {
        toast.error("Invalid tier price");
        return;
      }
      if (nearBalance && nearBalance.value < price) {
        toast.error("Not enough NEAR");
        return;
      }
      setIsPending(true);
      setError(null);
      try {
        await send({
          method: "purchase_ships_with_near",
          args: { tier, referral: null, variant },
          deposit: price,
          gas: GAS_HEAVY,
        });
        toast.success("Ships purchased! They're being built now.");
        await refetch();
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        toast.error(isUserRejection(e) ? "Transaction declined" : `Purchase failed: ${shortErrorMessage(e)}`);
      } finally {
        setIsPending(false);
      }
    },
    [address, tiers.length, pricesWei, nearBalance, send, refetch],
  );

  const getPurchaseCosts = (tier: number) => {
    const p = pricesWei[tier];
    if (p === undefined) return [];
    return [{ count: Number(shipsPerTier[tier] || 1), cost: p, costFormatted: `${formatNear(p)} NEAR` }];
  };

  const canAfford = (tier: number) => {
    const p = pricesWei[tier];
    return p !== undefined && !!nearBalance && nearBalance.value >= p;
  };

  return {
    tiers,
    prices: pricesWei,
    maxPerTier: shipsPerTier,
    flowBalance: nearBalance,
    isLoadingFlowBalance,
    isLoadingPurchaseInfo,
    purchaseShips,
    getPurchaseCosts,
    canAfford,
    isPending,
    error,
  };
}
