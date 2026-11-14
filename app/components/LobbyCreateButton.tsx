"use client";

import React from "react";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";
import { useChainAccount } from "@/app/near/useChainAccount";
import { useTokenBalance } from "@/app/near/useTokenBalance";
import { TOKEN_UTC } from "@/app/near/config";
import { formatUnits18, parseUnits18 } from "@/app/near/codec";
import type { Address } from "../types/chain";
import { isNoAccount } from "../types/chain";
import { useMapExists } from "../hooks/useMapsContract";
import posthog from "posthog-js";

interface LobbyCreateButtonProps {
  costLimit: bigint;
  turnTime: bigint;
  creatorGoesFirst: boolean;
  selectedMapId: bigint;
  maxScore: bigint;
  /** The extra-lobby fee (UTC, 18 decimals) when this open lobby is past the
   * player's free ones, else 0. The contract debits it directly. */
  lobbyFeeUtc: bigint;
  /** Reserve the lobby for this player (omit for an open lobby). */
  reservedJoiner?: Address;
  /** True when the reservation fee is waived (the caller decides). */
  skipReservationFee?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
  onTransactionSent?: (hash: string) => void;
}

export function LobbyCreateButton({
  costLimit,
  turnTime,
  creatorGoesFirst,
  selectedMapId,
  maxScore,
  lobbyFeeUtc,
  reservedJoiner,
  skipReservationFee = false,
  children,
  className = "",
  disabled = false,
  onSuccess,
  onError,
  onTransactionSent,
}: LobbyCreateButtonProps) {
  const { address } = useChainAccount();
  const isReserved = !!reservedJoiner && !isNoAccount(reservedJoiner);
  const { data: utcBalance } = useTokenBalance(address, TOKEN_UTC);
  const { data: mapExists } = useMapExists(Number(selectedMapId));

  // One UTC fee: 1 UTC to reserve the lobby for a player, otherwise the
  // extra-lobby fee once the free lobbies are used.
  const totalUtcRequired = React.useMemo(() => {
    if (isReserved) return skipReservationFee ? BigInt(0) : parseUnits18("1");
    return lobbyFeeUtc;
  }, [isReserved, skipReservationFee, lobbyFeeUtc]);

  const validateBeforeTransaction = React.useCallback(() => {
    if (!address) return "Please sign in first";
    if (mapExists === false) return `Map ID ${selectedMapId} does not exist. Please select a valid map.`;
    if (turnTime === BigInt(0)) return "Turn time must be greater than 0";
    if (isReserved && reservedJoiner === address) {
      return "Cannot reserve a lobby for yourself. Enter a different player's account, or leave it empty for an open lobby.";
    }
    if (totalUtcRequired > BigInt(0) && (utcBalance ?? BigInt(0)) < totalUtcRequired) {
      return `Insufficient UTC balance. Need ${formatUnits18(totalUtcRequired)} UTC.`;
    }
    return true;
  }, [address, mapExists, selectedMapId, turnTime, isReserved, reservedJoiner, totalUtcRequired, utcBalance]);

  const transactionId = React.useMemo(
    () => `create-lobby-${address}-${costLimit}-${turnTime}-${selectedMapId}-${maxScore}-${reservedJoiner || "open"}`,
    [address, costLimit, turnTime, selectedMapId, maxScore, reservedJoiner],
  );

  const call = React.useMemo(
    () => ({
      method: "create_lobby" as const,
      args: {
        cost_limit: Number(costLimit),
        turn_time: Number(turnTime),
        creator_goes_first: creatorGoesFirst,
        map_id: selectedMapId.toString(),
        max_score: Number(maxScore),
        reserved_joiner: isReserved ? reservedJoiner! : null,
      },
    }),
    [costLimit, turnTime, creatorGoesFirst, selectedMapId, maxScore, isReserved, reservedJoiner],
  );

  return (
    <TransactionButton
      transactionId={transactionId}
      call={call}
      className={className}
      disabled={disabled}
      loadingText="[CREATING…]"
      errorText="[ERROR CREATING]"
      onSuccess={async () => {
        posthog.capture("lobby_created", {
          cost_limit: costLimit.toString(),
          turn_time_seconds: turnTime.toString(),
          creator_goes_first: creatorGoesFirst,
          max_score: maxScore.toString(),
          is_reserved: isReserved,
          reservation_fee_waived: skipReservationFee,
        });
        await onSuccess?.();
      }}
      onError={onError}
      onTransactionSent={onTransactionSent}
      validateBeforeTransaction={validateBeforeTransaction}
    >
      {children}
    </TransactionButton>
  );
}
