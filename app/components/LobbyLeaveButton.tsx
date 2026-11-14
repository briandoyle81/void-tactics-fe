"use client";

import React from "react";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";

interface LobbyLeaveButtonProps {
  lobbyId: bigint;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** When true, button stays enabled when another transaction is pending (e.g. Create Fleet). */
  allowWhenOtherPending?: boolean;
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
}


export function LobbyLeaveButton({
  lobbyId,
  children,
  className = "",
  disabled = false,
  allowWhenOtherPending = false,
  onSuccess,
  onError,
}: LobbyLeaveButtonProps) {
  return (
    <TransactionButton
      transactionId={`leave-lobby-${lobbyId}`}
      call={{ method: "leave_lobby", args: { lobby_id: lobbyId.toString() } }}
      className={className}
      disabled={disabled}
      allowWhenOtherPending={allowWhenOtherPending}
      onSuccess={onSuccess}
      onError={onError}
    >
      {children}
    </TransactionButton>
  );
}
