"use client";

import React from "react";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";
import { useChainAccount } from "@/app/near/useChainAccount";
import { useTokenBalance } from "@/app/near/useTokenBalance";
import { TOKEN_UTC } from "@/app/near/config";
import { formatUnits18 } from "@/app/near/codec";
import posthog from "posthog-js";

interface LobbyJoinButtonProps {
  lobbyId: bigint;
  /** The extra-lobby fee (UTC, 18 decimals) when joining is past the
   * player's free lobbies, else 0. The contract debits it directly; a
   * reserved joiner pays nothing. */
  lobbyFeeUtc?: bigint;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
}

export function LobbyJoinButton({
  lobbyId,
  lobbyFeeUtc = BigInt(0),
  children,
  className = "",
  disabled = false,
  onSuccess,
  onError,
}: LobbyJoinButtonProps) {
  const { address } = useChainAccount();
  const { data: utcBalance } = useTokenBalance(address, TOKEN_UTC, lobbyFeeUtc > BigInt(0));

  const validateBeforeTransaction = React.useCallback(() => {
    if (!address) return "Please sign in first";
    if (lobbyFeeUtc > BigInt(0) && (utcBalance ?? BigInt(0)) < lobbyFeeUtc) {
      return `Insufficient UTC balance. Need ${formatUnits18(lobbyFeeUtc)} UTC for the lobby fee.`;
    }
    return true;
  }, [address, lobbyFeeUtc, utcBalance]);

  const call = React.useMemo(
    () => ({ method: "join_lobby" as const, args: { lobby_id: lobbyId.toString() } }),
    [lobbyId],
  );

  return (
    <TransactionButton
      transactionId={`join-lobby-${lobbyId}-${address}`}
      call={call}
      className={className}
      disabled={disabled}
      loadingText="[JOINING…]"
      errorText="[ERROR JOINING]"
      onSuccess={async () => {
        posthog.capture("lobby_joined", { lobby_id: lobbyId.toString() });
        await onSuccess?.();
      }}
      onError={onError}
      validateBeforeTransaction={validateBeforeTransaction}
    >
      {children}
    </TransactionButton>
  );
}
