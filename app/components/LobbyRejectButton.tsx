"use client";

import React from "react";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";
import { useChainAccount } from "@/app/near/useChainAccount";

interface LobbyRejectButtonProps {
  lobbyId: bigint;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
}


export function LobbyRejectButton({
  lobbyId,
  children,
  className = "",
  disabled = false,
  onSuccess,
  onError,
}: LobbyRejectButtonProps) {
  const { address } = useChainAccount();

  const validateBeforeTransaction = React.useCallback(() => {
    if (!address) {
      return "Please connect your wallet";
    }
    return true;
  }, [address]);

  return (
    <TransactionButton
      transactionId={`reject-game-${lobbyId}-${address}`}
      call={{ method: "reject_game", args: { lobby_id: lobbyId.toString() } }}
      className={className}
      disabled={disabled}
      loadingText="[REJECTING…]"
      errorText="[ERROR REJECTING]"
      onSuccess={onSuccess}
      onError={onError}
      validateBeforeTransaction={validateBeforeTransaction}
    >
      {children}
    </TransactionButton>
  );
}

