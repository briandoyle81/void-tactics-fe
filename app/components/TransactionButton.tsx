"use client";

import React from "react";
import { toast } from "react-hot-toast";
import { useTransaction } from "../providers/TransactionContext";
import { useNearCall, type NearCallSpec, type NearReceipt } from "../near/useNearCall";

export type TransactionFollowUp = () => void | Promise<void>;

interface TransactionButtonProps {
  // Transaction identification
  transactionId: string;

  /**
   * The contract call (app/near/session.tsx NearCallSpec: method, args,
   * optional deposit/gas). Null disables the button. Calls without a
   * deposit are signed by the session key with no wallet prompt; a deposit
   * (purchases, storage, 1-yocto transfers) goes through the wallet.
   */
  call: NearCallSpec | null;

  // Button appearance
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** When true, button stays enabled when another transaction is pending (only this button's own pending state disables it). */
  allowWhenOtherPending?: boolean;
  loadingText?: string;
  errorText?: string;

  // Callbacks. onSuccess may return a Promise; the button stays loading and
  // disabled until that Promise settles (the transaction plus any refetch/UI wait).
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
  /** Called with the transaction hash once it has executed (before onReceipt/onSuccess). */
  onTransactionSent?: (hash: string) => void;
  /** Called with the executed (successful) transaction: return value and events. */
  onReceipt?: (receipt: NearReceipt) => void;

  // Validation
  validateBeforeTransaction?: () => boolean | string; // Return true or error message
  /** Called once per click after validation passes, before sending — snapshot exactly what's being submitted here. */
  onBeforeSend?: () => void;
  /**
   * Asked after validation, before anything is sent (e.g. "hold fire with a
   * target in range?", HoldFireConfirm). Resolving false cancels the click.
   */
  confirmBeforeSend?: () => boolean | Promise<boolean>;

  /** Merged with defaults (e.g. square corners). Use for theme borders on the underlying button. */
  style?: React.CSSProperties;
}

export function TransactionButton({
  transactionId,
  call,
  children,
  className = "",
  disabled = false,
  allowWhenOtherPending = false,
  loadingText = "[PROCESSING…]",
  errorText = "[ERR]",
  onSuccess,
  onError,
  onTransactionSent,
  onBeforeSend,
  confirmBeforeSend,
  onReceipt,
  validateBeforeTransaction,
  style: buttonStyle,
}: TransactionButtonProps) {
  const { call: sendCall } = useNearCall();
  const { transactionState, startTransaction, setTransactionHash, completeTransaction, clearError } =
    useTransaction();

  const isActiveTransaction = transactionState.activeTransactionId === transactionId;
  const [isLocallyPending, setIsLocallyPending] = React.useState(false);
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isTransactionPending = (transactionState.isPending && isActiveTransaction) || isLocallyPending;
  const hasTransactionError = transactionState.error && isActiveTransaction;

  const handleTransaction = async () => {
    if (!call) return;
    if (validateBeforeTransaction) {
      const validation = validateBeforeTransaction();
      if (validation !== true) {
        toast.error(validation as string);
        return;
      }
    }
    if (confirmBeforeSend && !(await confirmBeforeSend())) return;
    onBeforeSend?.();

    startTransaction(transactionId);
    setIsLocallyPending(true);
    let receipt: NearReceipt;
    try {
      receipt = await sendCall(call);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (mountedRef.current) setIsLocallyPending(false);
      completeTransaction(transactionId, false, error);
      onError?.(error);
      return;
    }

    setTransactionHash(transactionId, receipt.hash);
    onTransactionSent?.(receipt.hash);
    onReceipt?.(receipt);
    try {
      await onSuccess?.();
    } catch (followUpError) {
      console.error("Transaction follow-up failed:", followUpError);
    } finally {
      if (mountedRef.current) setIsLocallyPending(false);
      completeTransaction(transactionId, true);
    }
  };

  // Clear this button's error when it unmounts.
  React.useEffect(() => {
    return () => {
      if (isActiveTransaction) clearError(transactionId);
    };
  }, [isActiveTransaction, transactionId, clearError]);

  // Re-enable after clearAllTransactions().
  React.useEffect(() => {
    if (!transactionState.activeTransactionId && !transactionState.isPending) setIsLocallyPending(false);
  }, [transactionState.activeTransactionId, transactionState.isPending]);

  const isDisabled =
    disabled ||
    !call ||
    isTransactionPending ||
    (!allowWhenOtherPending && transactionState.isPending && !isActiveTransaction);

  let buttonContent = children;
  if (isTransactionPending) buttonContent = loadingText;
  else if (hasTransactionError) buttonContent = errorText;

  // Remove rounded classes from className to enforce square corners
  const cleanedClassName = className
    .replace(/\brounded(-\w+)?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return (
    <button
      onClick={handleTransaction}
      disabled={isDisabled}
      className={`${cleanedClassName} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
      style={{
        ...(buttonStyle ?? {}),
        borderRadius: 0, // Force square corners for industrial theme
      }}
    >
      {buttonContent}
    </button>
  );
}
