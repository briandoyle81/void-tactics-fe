"use client";

import { useFreeShipClaimStatus } from "../hooks/useFreeShipClaimStatus";
import { useOwnedShips } from "../hooks/useOwnedShips";
import { useOwnedShipsWeb2 } from "../hooks/useOwnedShipsWeb2";
import { FreeShipClaimButton } from "./FreeShipClaimButton";
import { ClaimFreeButtonWeb2 } from "./ClaimFreeButtonWeb2";
import { SelfieCheckVerifyButton } from "./SelfieCheckVerifyButton";

type ClaimStatus = ReturnType<typeof useFreeShipClaimStatus>;
export type FreeShipsAnalyticsSurface = "info" | "manage_navy" | "command_deck" | "fleet_select" | "unknown";

/** Claim status plus a refetch of the player's ships for the current mode (one instance per screen). */
export function useFreeShipsClaim() {
  const status = useFreeShipClaimStatus();
  const { refetch: refetchShips } = useOwnedShips();
  const { refetch: refetchShipsWeb2 } = useOwnedShipsWeb2();
  const refetch = status.appMode === "web2" ? refetchShipsWeb2 : refetchShips;
  return { status, refetch };
}

/**
 * The free-ship claim action for either mode: verify (web3 Selfie Check
 * gate), claim when ready, otherwise nothing or, with `showCountdown`, a
 * disabled button with the time until the next claim. Shared by the Command
 * Deck's FreeShipsCard and the roguelike "Select your fleet" header.
 */
export function FreeShipsClaimAction({
  status,
  refetch,
  className,
  verifyClassName,
  showCountdown = false,
  analyticsSurface,
  onClaimed,
}: {
  status: ClaimStatus;
  refetch: () => unknown;
  className: string;
  /** For the verify step (defaults to `className`). */
  verifyClassName?: string;
  showCountdown?: boolean;
  analyticsSurface: FreeShipsAnalyticsSurface;
  /** After the claim confirms and ships are refetched. */
  onClaimed?: () => unknown;
}) {
  const ready = status.isEligible && !status.isLoading && !status.hasError;
  const afterClaim = async () => {
    await refetch();
    await onClaimed?.();
  };

  if (status.isSelfieCheckBlocking && status.address) {
    return (
      <SelfieCheckVerifyButton
        address={status.address}
        onVerified={() => void status.refetchSelfieCheck()}
        className={verifyClassName ?? className}
      >
        [VERIFY TO CLAIM]
      </SelfieCheckVerifyButton>
    );
  }
  if (ready) {
    return status.appMode === "web2" ? (
      <ClaimFreeButtonWeb2 onSuccess={afterClaim} analyticsSurface={analyticsSurface} className={className} />
    ) : (
      <FreeShipClaimButton
        isEligible={status.isEligible}
        isPending={status.web3Claim.isPending}
        isConfirmed={status.web3Claim.isConfirmed}
        claimFreeShips={status.web3Claim.claimFreeShips}
        analyticsSurface={analyticsSurface}
        className={className}
        onSuccess={afterClaim}
      >
        [CLAIM FREE SHIPS]
      </FreeShipClaimButton>
    );
  }
  if (!showCountdown) return null;
  return (
    <button type="button" disabled className={`${className} cursor-not-allowed opacity-50`} style={{ borderRadius: 0 }}>
      {status.isLoading
        ? "[CHECKING CLAIM...]"
        : status.nextClaimInFormatted
          ? `[NEXT CLAIM IN ${status.nextClaimInFormatted.toUpperCase()}]`
          : "[CLAIM UNAVAILABLE]"}
    </button>
  );
}
