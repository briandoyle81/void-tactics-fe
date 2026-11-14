import { useCallback, useMemo } from "react";
import { useChainAccount } from "../near/useChainAccount";
import { useNearView } from "../near/useNearView";
import { TOKEN_DEC } from "../near/config";

/**
 * The DCC storefront (turn_in_cores): a player's tier, the cost of their
 * next tier (get_claim_status / get_storefront_tiers), and their DCC
 * balance (NEP-245 "dec", 0 decimals). Turning in debits DCC directly: no
 * approval step.
 */
export function useDroneStorefront() {
  const { address } = useChainAccount();
  const accountArgs = useMemo(() => (address ? { account_id: address } : null), [address]);
  const decArgs = useMemo(() => (address ? { account_id: address, token_id: TOKEN_DEC } : null), [address]);

  const status = useNearView("get_claim_status", accountArgs, { staleTime: 30_000 });
  const tiers = useNearView("get_storefront_tiers", {}, { staleTime: 5 * 60_000 });
  const dec = useNearView("mt_balance_of", decArgs, { staleTime: 15_000 });

  const currentTier = status.data?.drone_core_tier ?? 0;
  const nextTier = currentTier + 1;
  const nextCostRaw = status.data?.next_tier_cost ?? (tiers.data ? tiers.data[currentTier] : undefined);
  const maxTierReached = !!tiers.data && currentTier >= tiers.data.length;

  const refetchAll = useCallback(async () => {
    await Promise.all([status.refetch(), tiers.refetch(), dec.refetch()]);
  }, [status, tiers, dec]);

  return {
    isDeployed: true,
    currentTier,
    nextTier,
    nextTierCost: maxTierReached || nextCostRaw == null ? undefined : BigInt(nextCostRaw),
    maxTierReached,
    isLoadingTier: status.isLoading,
    isLoadingNextTierCost: tiers.isLoading,
    decBalance: dec.data != null ? BigInt(dec.data) : undefined,
    refetchAll,
  };
}
