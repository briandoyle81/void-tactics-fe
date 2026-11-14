import { useMemo } from "react";
import { useNearView } from "../near/useNearView";
import { useGameSettings } from "../near/useGameSettings";
import type { GameSettings } from "../near/generated/voidTactics";

type ClaimKind = "freeShipClaim" | "tutorialClaim";

const selectRequirements = (s: GameSettings) => ({
  freeShipClaim: s.free_claim_requires_verification,
  tutorialClaim: s.tutorial_requires_verification,
});

/**
 * Selfie Check verification for a claim: whether the contract requires it
 * (get_settings) and whether the player passes (is_eligible). A claim that
 * doesn't require it is always eligible.
 */
export function useSelfieCheckEligibility(kind: ClaimKind, player: string | undefined) {
  const args = useMemo(() => (player ? { account_id: player } : null), [player]);
  const { data: requirements, isLoading: requirementsLoading } = useGameSettings(selectRequirements);
  const { data, isLoading, refetch } = useNearView("is_eligible", args, { staleTime: 60_000 });
  const required = requirements?.[kind];
  return {
    isEligible: required === undefined ? undefined : required ? data : true,
    isVerified: data,
    isGateConfigured: required === true,
    isLoading: requirementsLoading || isLoading,
    refetchIsEligible: refetch,
  };
}
