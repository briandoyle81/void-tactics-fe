"use client";

import React from "react";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";
import { useChainAccount } from "@/app/near/useChainAccount";
import { useNearBalance } from "@/app/near/useNearBalance";
import { GAS_DEFAULT } from "@/app/near/config";
import posthog from "posthog-js";

interface UTCPurchaseButtonProps {
  tier: number;
  /** The tier's NEAR price, in yoctoNEAR (attached as the deposit). */
  flowCost: bigint;
  utcAmount: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
  refetch?: () => void | Promise<unknown>;
}

/** Buys a tier's UTC with NEAR (buy_utc_with_near); the wallet confirms the deposit. */
export function UTCPurchaseButton({
  tier,
  flowCost,
  utcAmount,
  children,
  className = "",
  disabled = false,
  onSuccess,
  onError,
  refetch,
}: UTCPurchaseButtonProps) {
  const { address } = useChainAccount();
  const { data: nearBalance } = useNearBalance(address);

  const validateBeforeTransaction = React.useCallback(() => {
    if (!address) return "Please sign in first";
    if (!nearBalance || nearBalance.value < flowCost) return "Not enough NEAR";
    return true;
  }, [address, nearBalance, flowCost]);

  const handleSuccess = React.useCallback(async () => {
    posthog.capture("utc_purchased", { tier, utc_amount: utcAmount });
    await refetch?.();
    await onSuccess?.();
  }, [onSuccess, refetch, tier, utcAmount]);

  return (
    <TransactionButton
      transactionId={`purchase-utc-tier-${tier}-${address}`}
      call={{ method: "buy_utc_with_near", args: { tier }, deposit: flowCost, gas: GAS_DEFAULT }}
      className={className}
      disabled={disabled}
      loadingText="[PURCHASING UTC…]"
      errorText="[ERROR PURCHASING]"
      onSuccess={handleSuccess}
      onError={onError}
      validateBeforeTransaction={validateBeforeTransaction}
    >
      {children}
    </TransactionButton>
  );
}
