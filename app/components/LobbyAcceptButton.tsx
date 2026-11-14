"use client";

import React from "react";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";
import { useChainAccount } from "@/app/near/useChainAccount";
import posthog from "posthog-js";

interface LobbyAcceptButtonProps {
  lobbyId: bigint;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
}


export function LobbyAcceptButton({
  lobbyId,
  children,
  className = "",
  disabled = false,
  onSuccess,
  onError,
}: LobbyAcceptButtonProps) {
  const { address } = useChainAccount();

  const validateBeforeTransaction = React.useCallback(() => {
    if (!address) {
      return "Please connect your wallet";
    }
    return true;
  }, [address]);

  return (
    <TransactionButton
      transactionId={`accept-game-${lobbyId}-${address}`}
      call={{ method: "accept_game", args: { lobby_id: lobbyId.toString() } }}
      className={className}
      disabled={disabled}
      loadingText="[ACCEPTING…]"
      errorText="[ERROR ACCEPTING]"
      onSuccess={async () => {
        posthog.capture("game_accepted", { lobby_id: lobbyId.toString() });
        await onSuccess?.();
      }}
      onError={onError}
      validateBeforeTransaction={validateBeforeTransaction}
    >
      {children}
    </TransactionButton>
  );
}

