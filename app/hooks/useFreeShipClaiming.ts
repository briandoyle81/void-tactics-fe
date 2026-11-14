import { toast } from "react-hot-toast";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useChainAccount } from "../near/useChainAccount";
import { useNearSession } from "../near/session";
import { useNearView } from "../near/useNearView";
import { gasForShips } from "../near/config";
import { isContractError, isUserRejection, shortErrorMessage } from "../near/errors";
import { openStorageTopUp } from "../near/onboarding/NearOnboardingHost";
import { useOwnedShips } from "./useOwnedShips";

const DEFAULT_COOLDOWN_SECONDS = 28 * 24 * 60 * 60; // 28 days

// Exported: shared with useClaimFreeEligibilityWeb2.ts / ClaimFreeShipsControls.tsx.
export function formatTimeUntil(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return "0m";
  const d = Math.floor(secondsRemaining / 86400);
  const h = Math.floor((secondsRemaining % 86400) / 3600);
  const m = Math.floor((secondsRemaining % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

/**
 * Free-ship claim (claim_free_ships): eligibility and countdown from
 * get_claim_status, and the claim itself (session key, no prompt). The new
 * ships construct themselves a block or two later; useOwnedShips polls until
 * they have.
 */
export function useFreeShipClaiming() {
  const { address } = useChainAccount();
  const { send } = useNearSession();
  const { refetch: refetchShips } = useOwnedShips();
  const [selectedVariant, setSelectedVariant] = useState(1);

  const statusArgs = useMemo(() => (address ? { account_id: address } : null), [address]);
  const {
    data: status,
    isLoading: isLoadingClaimStatus,
    error: claimStatusError,
    refetch: refetchClaimStatus,
  } = useNearView("get_claim_status", statusArgs, { staleTime: 30_000 });

  const nextClaimAt = status ? Number(status.next_claim_at_s) : null;
  const [nowS, setNowS] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (nextClaimAt == null || nextClaimAt <= nowS) return;
    const id = setInterval(() => setNowS(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [nextClaimAt, nowS]);

  // No status yet means the player has never claimed (or isn't registered): eligible.
  const secondsUntilNextClaim = nextClaimAt != null && nextClaimAt > nowS ? nextClaimAt - nowS : null;
  const isEligible = !!address && (status == null || secondsUntilNextClaim == null);
  const hasCheckedEligibility = !!address && !isLoadingClaimStatus;

  const [isPending, setIsPending] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const claimFreeShips = useCallback(async () => {
    if (!address) {
      toast.error("Please sign in first");
      return;
    }
    if (!isEligible) {
      toast.error("You are not eligible for free ships or have already claimed them");
      return;
    }
    setIsPending(true);
    setIsConfirmed(false);
    setError(null);
    try {
      const receipt = await send({
        method: "claim_free_ships",
        args: { variant: selectedVariant },
        // Sized to the claim (ships_per_claim); 300 Tgas would need ~0.3 NEAR up front.
        gas: gasForShips(status?.ships_per_claim ?? 20),
      });
      const ids = (receipt.returnValue as string[] | null) ?? [];
      setIsConfirmed(true);
      toast.success(`Claimed ${ids.length || "your"} free ships! They're being built now.`);
      await refetchClaimStatus();
      await refetchShips();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      if (isUserRejection(e)) toast.error("Transaction declined");
      else if (isContractError(e, "InsufficientStorageBalance") || isContractError(e, "StorageNotRegistered")) {
        openStorageTopUp();
      } else toast.error(`Claim failed: ${shortErrorMessage(e)}`);
    } finally {
      setIsPending(false);
    }
  }, [address, isEligible, send, selectedVariant, status?.ships_per_claim, refetchClaimStatus, refetchShips]);

  return {
    isEligible,
    hasCheckedEligibility,
    hasClaimed: !isEligible,
    isFreeShipClaimDeployed: true,
    selectedVariant,
    setSelectedVariant,

    secondsUntilNextClaim,
    nextClaimInFormatted: secondsUntilNextClaim != null ? formatTimeUntil(secondsUntilNextClaim) : null,
    cooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
    /** Ships each claim gives (base plus storefront tier). */
    shipsPerClaim: status?.ships_per_claim,
    droneCoreTier: status?.drone_core_tier,

    isLoadingClaimStatus,
    claimFreeShips,

    isPending,
    isConfirmed,
    error,
    claimStatusError,
  };
}
