import { useMemo } from "react";
import { useChainAccount } from "../near/useChainAccount";
import { useNearView } from "../near/useNearView";
import { TOKEN_HIVE_MEDAL } from "../near/config";
import { useGameSettings } from "../near/useGameSettings";
import type { GameSettings } from "../near/generated/voidTactics";

const selectGated = (s: GameSettings) => s.gated_variants;

/**
 * Whether the signed-in player can mint/claim a variant. A gated variant
 * (get_settings.gated_variants; today the Drone faction, 2) requires the
 * Shattered Hive medal (NEP-245 "hive_medal").
 */
export function useVariantPurchaseGate(variant: number) {
  const { address } = useChainAccount();
  const { data: gatedVariants, isLoading: gateLoading } = useGameSettings(selectGated);
  const isGated = !!gatedVariants?.includes(variant);
  const args = useMemo(
    () => (isGated && address ? { account_id: address, token_id: TOKEN_HIVE_MEDAL } : null),
    [isGated, address],
  );
  const { data, isLoading } = useNearView("mt_balance_of", args, { staleTime: 60_000 });
  const holdsRequiredNft = !isGated || BigInt(data ?? "0") > BigInt(0);
  return {
    isGateDeployed: true,
    isGated,
    requiredNftAddress: isGated ? TOKEN_HIVE_MEDAL : undefined,
    isUnlocked: holdsRequiredNft,
    isLoading: gateLoading || (isGated && isLoading),
  };
}
