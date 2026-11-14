"use client";

import React from "react";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";
import posthog from "posthog-js";
import { useChainAccount } from "@/app/near/useChainAccount";
import { useNearBalance } from "@/app/near/useNearBalance";
import { useTokenBalance } from "@/app/near/useTokenBalance";
import { GAS_HEAVY, TOKEN_UTC } from "@/app/near/config";

interface ShipPurchaseButtonProps {
  tier: number;
  /** The pack's price: yoctoNEAR for "FLOW" (NEAR), 18-decimal UTC for "UTC". */
  price: bigint;
  /** "FLOW" is the native token (NEAR); the name is kept from the Base build. */
  paymentMethod: "FLOW" | "UTC";
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
  refetch?: () => void | Promise<unknown>;
  /** Faction to mint (default 1). Variant 2 needs the Shattered Hive medal;
   * the picker prevents choosing it without one and the contract refuses as
   * a backstop. */
  variant?: number;
}

/**
 * Buys a ship pack: with NEAR (purchase_ships_with_near, the exact price
 * attached as the deposit, which also pays the ships' storage; the wallet
 * confirms) or UTC (purchase_ships_with_utc, debited directly with no
 * approval; signed by the session key). The ships construct themselves a
 * block or two later.
 */
export function ShipPurchaseButton({
  tier,
  price,
  paymentMethod,
  children,
  className = "",
  disabled = false,
  onSuccess,
  onError,
  refetch,
  variant,
}: ShipPurchaseButtonProps) {
  const { address } = useChainAccount();
  const purchaseVariant = variant ?? 1;
  const { data: nearBalance } = useNearBalance(address);
  const { data: utcBalance, isPending: utcBalancePending } = useTokenBalance(
    address,
    TOKEN_UTC,
    paymentMethod === "UTC",
  );

  const validateBeforeTransaction = React.useCallback(() => {
    if (!address) return "Please sign in first";
    if (paymentMethod === "FLOW") {
      if (!nearBalance || nearBalance.value < price) return "Not enough NEAR";
    } else {
      if (utcBalancePending) return "Loading UTC balance…";
      if (utcBalance === undefined || utcBalance < price) return "Insufficient UTC balance";
    }
    return true;
  }, [address, nearBalance, utcBalance, utcBalancePending, price, paymentMethod]);

  const handleSuccess = React.useCallback(async () => {
    posthog.capture("ship_purchased", { tier, payment_method: paymentMethod, price: price.toString() });
    await refetch?.();
    await onSuccess?.();
  }, [onSuccess, refetch, tier, paymentMethod, price]);

  const args = { tier, referral: null, variant: purchaseVariant };

  if (paymentMethod === "UTC") {
    return (
      <TransactionButton
        transactionId={`purchase-ships-utc-tier-${tier}-v${purchaseVariant}-${address}`}
        call={{ method: "purchase_ships_with_utc", args, gas: GAS_HEAVY }}
        className={className}
        disabled={disabled || !address || (!utcBalancePending && (utcBalance === undefined || utcBalance < price))}
        loadingText="[PURCHASING…]"
        errorText="[ERROR PURCHASING]"
        onSuccess={handleSuccess}
        onError={onError}
        validateBeforeTransaction={validateBeforeTransaction}
      >
        <div className="flex flex-col items-center gap-2">
          {children}
          <span className="text-[11px] uppercase tracking-[0.08em]">[CLICK TO PURCHASE]</span>
        </div>
      </TransactionButton>
    );
  }

  return (
    <TransactionButton
      transactionId={`purchase-ships-near-tier-${tier}-v${purchaseVariant}-${address}`}
      call={{ method: "purchase_ships_with_near", args, deposit: price, gas: GAS_HEAVY }}
      className={className}
      disabled={disabled}
      loadingText="[PURCHASING…]"
      errorText="[ERROR PURCHASING]"
      onSuccess={handleSuccess}
      onError={onError}
      validateBeforeTransaction={validateBeforeTransaction}
    >
      {children}
    </TransactionButton>
  );
}
