"use client";

import React from "react";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";
import { useChainAccount } from "@/app/near/useChainAccount";
import posthog from "posthog-js";

interface LobbyPruneButtonProps {
  lobbyId: bigint;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
}


// pruneStaleLobby is permissionless — no wallet-connection requirement
// beyond having one to sign with, unlike LobbyJoinButton's role-specific
// validation. See docs/update/Frontend_Updates_2026-08-27.md §4.
export function LobbyPruneButton({
  lobbyId,
  children,
  className = "",
  disabled = false,
  onSuccess,
  onError,
}: LobbyPruneButtonProps) {
  const { address } = useChainAccount();

  const validateBeforeTransaction = React.useCallback(() => {
    if (!address) {
      return "Please connect your wallet";
    }
    return true;
  }, [address]);

  return (
    <TransactionButton
      transactionId={`prune-lobby-${lobbyId}-${address}`}
      call={{ method: "prune_stale_lobby", args: { lobby_id: lobbyId.toString() } }}
      className={className}
      disabled={disabled}
      loadingText="[PRUNING…]"
      errorText="[ERROR PRUNING]"
      onSuccess={async () => {
        posthog.capture("lobby_pruned", { lobby_id: lobbyId.toString() });
        await onSuccess?.();
      }}
      onError={onError}
      validateBeforeTransaction={validateBeforeTransaction}
    >
      {children}
    </TransactionButton>
  );
}
