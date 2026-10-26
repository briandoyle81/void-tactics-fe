"use client";

import React from "react";
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import type { Abi, TransactionReceipt } from "viem";
import { toast } from "react-hot-toast";
import { useTransaction } from "../providers/TransactionContext";
import { useSelectedChainId } from "../hooks/useSelectedChainId";
import { useSwitchToSelectedChainIfNeeded } from "../hooks/useSwitchToSelectedChainIfNeeded";
import {
  bumpedLegacyGasPriceForRetry,
  getLegacyGasPriceOverridesForWrite,
} from "../utils/legacyGasPriceForWrite";

export type TransactionFollowUp = () => void | Promise<void>;

interface TransactionButtonProps {
  // Transaction identification
  transactionId: string;

  // Contract call configuration
  contractAddress: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: unknown[];
  value?: bigint;
  /** Gas limit; omitted, the wallet estimates it. */
  gas?: bigint;

  // Button appearance
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** When true, button stays enabled when another transaction is pending (only this button's own pending state disables it). */
  allowWhenOtherPending?: boolean;
  loadingText?: string;
  errorText?: string;

  // Callbacks. onSuccess may return a Promise; the button stays loading and
  // disabled until that Promise settles (receipt plus any refetch/UI wait).
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
  onTransactionSent?: (hash: `0x${string}`) => void; // Called when transaction is sent (hash available)
  onReceipt?: (receipt: TransactionReceipt) => void; // Called with the confirmed (not reverted) receipt

  // Validation
  validateBeforeTransaction?: () => boolean | string; // Return true or error message
  /** Called once per click after validation passes, before the wallet prompt — snapshot exactly what's being submitted here. */
  onBeforeSend?: () => void;

  /** Merged with defaults (e.g. square corners). Use for theme borders on the underlying button. */
  style?: React.CSSProperties;
}

export function TransactionButton({
  transactionId,
  contractAddress,
  abi,
  functionName,
  args = [],
  value,
  gas,
  children,
  className = "",
  disabled = false,
  allowWhenOtherPending = false,
  loadingText = "[PROCESSING...]",
  errorText = "[ERR]",
  onSuccess,
  onError,
  onTransactionSent,
  onBeforeSend,
  onReceipt,
  validateBeforeTransaction,
  style: buttonStyle,
}: TransactionButtonProps) {
  const selectedChainId = useSelectedChainId();
  const switchToSelectedChainIfNeeded = useSwitchToSelectedChainIfNeeded();
  const publicClient = usePublicClient({ chainId: selectedChainId });
  const { writeContract, isPending, error, data: hash } = useWriteContract();
  const {
    transactionState,
    startTransaction,
    setTransactionHash,
    completeTransaction,
    clearError,
  } = useTransaction();

  // Hydration safety - prevent mismatch between server and client
  const [isHydrated, setIsHydrated] = React.useState(false);
  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Check if this button is the active transaction
  const isActiveTransaction =
    transactionState.activeTransactionId === transactionId;

  // Local state to track if we should consider the transaction as pending
  const [isLocallyPending, setIsLocallyPending] = React.useState(false);

  // Track if we've already called onTransactionSent for this hash
  const transactionSentHashRef = React.useRef<`0x${string}` | null>(null);
  // Track hashes we've already processed for completion callbacks
  const completedHashRef = React.useRef<`0x${string}` | null>(null);

  // Wait for transaction receipt
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash,
    chainId: selectedChainId,
    query: {
      enabled:
        !!hash &&
        isHydrated &&
        (isActiveTransaction ||
          isLocallyPending ||
          transactionSentHashRef.current === hash), // Keep receipt tracking alive for this button's tx even if global active ID is cleared early
    },
  });

  const isTransactionPending =
    (transactionState.isPending && isActiveTransaction) ||
    (isHydrated && isConfirming && isActiveTransaction) ||
    isLocallyPending;
  const hasTransactionError = transactionState.error && isActiveTransaction;

  const messageFromUnknownError = React.useCallback((err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (
      typeof err === "object" &&
      err !== null &&
      "message" in err &&
      typeof (err as { message: unknown }).message === "string"
    ) {
      return (err as { message: string }).message;
    }
    return String(err);
  }, []);

  const isTransactionUnderpricedError = React.useCallback(
    (err: unknown): boolean => {
      let current: unknown = err;
      for (let i = 0; i < 8 && current != null; i++) {
        const msg = messageFromUnknownError(current).toLowerCase();
        if (msg.includes("transaction underpriced")) return true;
        if (typeof current === "object" && current !== null && "cause" in current) {
          current = (current as { cause: unknown }).cause;
        } else {
          break;
        }
      }
      return false;
    },
    [messageFromUnknownError],
  );

  // Handle transaction execution
  const handleTransaction = async () => {
    try {
      // Validate before transaction if validator provided
      if (validateBeforeTransaction) {
        const validation = validateBeforeTransaction();
        if (validation !== true) {
          toast.error(validation as string);
          return;
        }
      }
      onBeforeSend?.();

      await switchToSelectedChainIfNeeded();

      // Start transaction tracking
      startTransaction(transactionId);
      setIsLocallyPending(true); // Set local pending state

      // Execute the contract call
      const writePayload = {
        address: contractAddress,
        abi,
        functionName,
        args,
        value,
        ...(gas != null ? { gas } : {}),
        chainId: selectedChainId,
      } as const;

      try {
        await writeContract({
          ...writePayload,
          ...(await getLegacyGasPriceOverridesForWrite(
            selectedChainId,
            publicClient,
          )),
        });
      } catch (writeErr) {
        if (!isTransactionUnderpricedError(writeErr) || !publicClient) {
          throw writeErr;
        }

        // Some RPCs reject wallet-estimated fees with "transaction underpriced".
        // Retry once with explicit legacy gasPrice above network quote.
        const baseGasPrice = await publicClient.getGasPrice();
        const bumpedGasPrice = bumpedLegacyGasPriceForRetry(
          selectedChainId,
          baseGasPrice,
        );
        await writeContract({
          ...writePayload,
          gasPrice: bumpedGasPrice,
        });
      }

      // Note: The hash will be available in the hash variable from useWriteContract
      // We'll trigger onTransactionSent in a useEffect when hash becomes available
    } catch (err: unknown) {
      const detail = messageFromUnknownError(err);
      const normalized = isTransactionUnderpricedError(err)
        ? `${detail}\n\nHint: wallet/RPC nonce state may be stuck. Try clearing wallet activity/nonce state, then retry.`
        : detail;
      const error = new Error(normalized);
      setIsLocallyPending(false); // Reset local pending state on error
      completeTransaction(transactionId, false, error);
      onError?.(error);
    }
  };

  // onTransactionSent, once per hash. Called from both effects below: the
  // receipt can land in the same render the hash appears (fast chains, a
  // cached receipt), and callers that track the tx from "sent" (the move
  // submit) must still hear about it, and before its success.
  const notifySent = React.useCallback(
    (sentHash: `0x${string}`) => {
      if (transactionSentHashRef.current === sentHash) return;
      transactionSentHashRef.current = sentHash;
      setTransactionHash(transactionId, sentHash);
      onTransactionSent?.(sentHash);
    },
    [setTransactionHash, transactionId, onTransactionSent],
  );

  // Handle transaction completion based on receipt confirmation
  React.useEffect(() => {
    const isOwnSentHash =
      !!hash && transactionSentHashRef.current === hash;
    const canHandleSuccess = isHydrated && (isActiveTransaction || isOwnSentHash);

    if (canHandleSuccess && isConfirmed && receipt && hash) {
      // Prevent duplicate handling for the same tx hash.
      if (completedHashRef.current === hash) return;
      completedHashRef.current = hash;
      notifySent(hash);

      // `isConfirmed` (useWaitForTransactionReceipt's isSuccess) only means
      // a receipt was fetched — it stays true even when the transaction
      // itself reverted on-chain (status: "reverted"), since viem doesn't
      // throw for that case. Without this check, every reverted write
      // (wrong turn, invalid move, etc.) across the app was silently
      // treated as a success: onSuccess fired, onError never did, and
      // callers that record optimistic state on success (e.g. the move
      // confirm widget) were left showing a move that never happened until
      // something unrelated eventually reconciled the UI.
      if (receipt.status === "reverted") {
        setIsLocallyPending(false);
        const revertError = new Error(
          "Transaction reverted on-chain",
        );
        completeTransaction(transactionId, false, revertError);
        onError?.(revertError);
        return;
      }

      // The confirmed receipt (e.g. minted ship ids for useConstructAfterMint)
      if (onReceipt) {
        onReceipt(receipt);
      }

      // Stay loading/disabled until follow-up UI work (refetch, wait for
      // the new lobby to appear, etc.) finishes. completeTransaction is
      // what re-enables the rest of the crypto buttons.
      void (async () => {
        try {
          await onSuccess?.();
        } catch (followUpError) {
          console.error("Transaction follow-up failed:", followUpError);
        } finally {
          setIsLocallyPending(false);
          completeTransaction(transactionId, true);
        }
      })();
    } else if (isActiveTransaction && isHydrated && receiptError) {
      // Transaction failed during confirmation
      setIsLocallyPending(false); // Reset local pending state
      completeTransaction(transactionId, false, receiptError);
      onError?.(receiptError);
    } else if (isActiveTransaction && !isPending && error) {
      // Transaction failed during submission
      setIsLocallyPending(false); // Reset local pending state
      completeTransaction(transactionId, false, error);
      onError?.(error);
    }
  }, [
    isActiveTransaction,
    isHydrated,
    isConfirmed,
    isPending,
    error,
    receiptError,
    receipt,
    hash,
    transactionId,
    completeTransaction,
    onSuccess,
    onError,
    onReceipt,
    notifySent,
  ]);

  // Clear error when component unmounts or transaction changes
  React.useEffect(() => {
    return () => {
      if (isActiveTransaction) {
        clearError(transactionId);
      }
    };
  }, [isActiveTransaction, transactionId, clearError]);

  // If this button unmounts after the receipt already landed (move confirm
  // widget calls handleCancelMove inside onSuccess), finish the global
  // pending lock so the next ship's Fire is clickable.
  React.useEffect(() => {
    return () => {
      if (completedHashRef.current) {
        completeTransaction(transactionId, true);
      }
    };
  }, [transactionId, completeTransaction]);

  // Reset transaction state when transaction ID changes
  React.useEffect(() => {
    // Clear any stale transaction state when the transaction ID changes
    if (transactionState.activeTransactionId !== transactionId) {
      clearError(transactionId);
      setIsLocallyPending(false); // Reset local pending state
    }
  }, [transactionId, transactionState.activeTransactionId, clearError]);

  // Reset local pending state when all transactions are cleared (activeTransactionId becomes null)
  // This ensures the button is re-enabled after clearAllTransactions() is called
  React.useEffect(() => {
    if (!transactionState.activeTransactionId && !transactionState.isPending) {
      setIsLocallyPending(false);
    }
  }, [transactionState.activeTransactionId, transactionState.isPending]);

  // Trigger onTransactionSent when the hash becomes available. Not gated on
  // the receipt still loading: that query starts the moment the hash exists,
  // and skipping "sent" whenever it had already flipped to confirming left
  // callers that track the tx from here (the move submit) waiting forever.
  React.useEffect(() => {
    if (hash && (isActiveTransaction || isLocallyPending)) notifySent(hash);
  }, [hash, isActiveTransaction, isLocallyPending, notifySent]);

  // Reset the ref when transaction changes
  React.useEffect(() => {
    if (!isActiveTransaction) {
      transactionSentHashRef.current = null;
      completedHashRef.current = null;
    }
  }, [isActiveTransaction]);

  // Determine button state
  const isDisabled =
    disabled ||
    isTransactionPending ||
    (!allowWhenOtherPending &&
      transactionState.isPending &&
      !isActiveTransaction);

  let buttonContent = children;
  if (isTransactionPending) {
    buttonContent = loadingText;
  } else if (hasTransactionError) {
    buttonContent = errorText;
  }

  // Remove rounded classes from className to enforce square corners
  const cleanedClassName = className
    .replace(/\brounded(-\w+)?\b/g, "")
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim();

  return (
    <button
      onClick={handleTransaction}
      disabled={isDisabled}
      className={`${cleanedClassName} ${
        isDisabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      style={{
        ...(buttonStyle ?? {}),
        borderRadius: 0, // Force square corners for industrial theme
      }}
    >
      {buttonContent}
    </button>
  );
}
