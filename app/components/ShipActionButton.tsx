"use client";

import React from "react";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";
import type { Ship } from "../types/types";
import { GAS_HEAVY } from "../near/config";
import posthog from "posthog-js";

interface ShipActionButtonProps {
  /** Ships construct themselves after minting on NEAR, so recycling is the only action. */
  action: "recycle";
  shipId?: bigint;
  shipIds?: bigint[];
  ships?: Ship[];
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
}

/** Recycles ships for UTC (recycle_ships). Free ships can't be recycled. */
export function ShipActionButton({
  shipIds,
  children,
  className = "",
  disabled = false,
  onSuccess,
  onError,
}: ShipActionButtonProps) {
  const call = React.useMemo(
    () =>
      shipIds && shipIds.length > 0
        ? { method: "recycle_ships" as const, args: { ship_ids: shipIds.map(String) }, gas: GAS_HEAVY }
        : null,
    [shipIds],
  );

  return (
    <TransactionButton
      transactionId={`recycle-ships-${shipIds?.join("-")}`}
      call={call}
      className={className}
      disabled={disabled}
      loadingText="[RECYCLING…]"
      errorText="[ERROR RECYCLING]"
      onSuccess={async () => {
        posthog.capture("ships_recycled", { ship_count: shipIds?.length ?? 0 });
        await onSuccess?.();
      }}
      onError={onError}
      validateBeforeTransaction={() => (shipIds && shipIds.length > 0) || "No ships selected for recycling"}
    >
      {children}
    </TransactionButton>
  );
}
