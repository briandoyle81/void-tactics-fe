"use client";

import React from "react";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";
import { erc20Approval } from "../utils/approvalSteps";
import { CONTRACT_ABIS, getContractAddresses } from "../config/contracts";
import { useAccount, useReadContract } from "wagmi";
import type { Abi, Address } from "viem";
import { parseEther, formatEther } from "viem";
import { useMapExists } from "../hooks/useMapsContract";
import { useSelectedChainId } from "../hooks/useSelectedChainId";
import posthog from "posthog-js";

interface LobbyCreateButtonProps {
  costLimit: bigint;
  turnTime: bigint;
  creatorGoesFirst: boolean;
  selectedMapId: bigint;
  maxScore: bigint;
  /** additionalLobbyFee (UTC wei) when this open lobby is past the player's
   * free ones, else 0. Lobbies.createLobby takes it with transferFrom. */
  lobbyFeeUtc: bigint;
  reservedJoiner?: Address; // Optional: address to reserve for (undefined or zero address for open lobby)
  /** True when this is the player's first unresolved AI reservation — Lobbies.createLobby waives the
   * usual 1 UTC reservation fee for it. Caller derives this from
   * playerState.activeAILobbiesCount (see Lobbies.tsx); ignored for human-reserved/open lobbies. */
  skipReservationFee?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
  onTransactionSent?: (hash: `0x${string}`) => void;
}

const LOBBY_CREATE_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "_costLimit", type: "uint256" },
      { internalType: "uint256", name: "_turnTime", type: "uint256" },
      { internalType: "bool", name: "_creatorGoesFirst", type: "bool" },
      { internalType: "uint256", name: "_selectedMapId", type: "uint256" },
      { internalType: "uint256", name: "_maxScore", type: "uint256" },
      { internalType: "address", name: "_reservedJoiner", type: "address" },
    ],
    name: "createLobby",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Listed so viem decodes the revert name (matched by the caller's onError).
  { type: "error", name: "InsufficientUTC", inputs: [] },
] as const;

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
  const { address } = useAccount();
  const chainId = useSelectedChainId();
  const contractAddresses = getContractAddresses(chainId);

  // Check if this is a reserved lobby
  const isReserved =
    reservedJoiner &&
    reservedJoiner !== "0x0000000000000000000000000000000000000000";
  const zeroAddress = "0x0000000000000000000000000000000000000000" as Address;

  // Read UTC balance
  const { data: utcBalance } = useReadContract({
    address: contractAddresses.UNIVERSAL_CREDITS as `0x${string}`,
    abi: CONTRACT_ABIS.UNIVERSAL_CREDITS as Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
  });

  // Check if map exists
  const { data: mapExists } = useMapExists(Number(selectedMapId));

  // Check if contract is paused
  const { data: paused } = useReadContract({
    address: contractAddresses.LOBBIES as `0x${string}`,
    abi: CONTRACT_ABIS.LOBBIES as Abi,
    functionName: "paused",
    chainId,
  });

  // Lobbies.createLobby charges one UTC fee: 1 UTC to reserve the lobby for
  // a player, otherwise additionalLobbyFee once the free lobbies are used.
  // skipReservationFee (a waived reservation) is the caller's to set.
  const totalUtcRequired = React.useMemo(() => {
    if (isReserved) return skipReservationFee ? 0n : parseEther("1");
    return lobbyFeeUtc;
  }, [isReserved, skipReservationFee, lobbyFeeUtc]);

  const validateBeforeTransaction = React.useCallback(() => {
    if (!address) {
      return "Please connect your wallet";
    }
    if (paused === true) {
      return "Lobby creation is currently paused";
    }
    if (mapExists === false) {
      return `Map ID ${selectedMapId} does not exist. Please select a valid map.`;
    }
    if (turnTime === 0n) {
      return "Turn time must be greater than 0";
    }
    // Prevent reserving lobby for yourself
    if (isReserved && reservedJoiner && address) {
      if (reservedJoiner.toLowerCase() === address.toLowerCase()) {
        return "Cannot reserve a lobby for yourself. Please enter a different player's address or leave empty for an open lobby.";
      }
    }
    // The reservation or extra-lobby fee, in UTC.
    if (totalUtcRequired > 0n) {
      const balance = utcBalance as bigint | undefined;
      if (!balance || balance < totalUtcRequired) {
        return `Insufficient UTC balance. Need ${formatEther(totalUtcRequired)} UTC.`;
      }
    }
    return true;
  }, [
    address,
    paused,
    mapExists,
    selectedMapId,
    turnTime,
    isReserved,
    reservedJoiner,
    totalUtcRequired,
    utcBalance,
  ]);

  const transactionId = React.useMemo(
    () =>
      `create-lobby-${address}-${costLimit}-${turnTime}-${selectedMapId}-${maxScore}-${
        reservedJoiner || "open"
      }`,
    [address, costLimit, turnTime, selectedMapId, maxScore, reservedJoiner]
  );

  // The UTC fee: the Lobbies contract's UTC allowance is approved
  // first if it's short, then the lobby is created straight after (one click).
  const utcApprovals = React.useMemo(
    () =>
      totalUtcRequired > 0n && address
        ? [
            erc20Approval({
              token: contractAddresses.UNIVERSAL_CREDITS as `0x${string}`,
              owner: address,
              spender: contractAddresses.LOBBIES as `0x${string}`,
              amount: totalUtcRequired,
              loadingText: `[APPROVING ${formatEther(totalUtcRequired)} UTC…]`,
            }),
          ]
        : undefined,
    [totalUtcRequired, address, contractAddresses.UNIVERSAL_CREDITS, contractAddresses.LOBBIES],
  );

  return (
    <TransactionButton
      transactionId={transactionId}
      contractAddress={contractAddresses.LOBBIES as `0x${string}`}
      abi={LOBBY_CREATE_ABI}
      functionName="createLobby"
      args={[
        costLimit,
        turnTime,
        creatorGoesFirst,
        selectedMapId,
        maxScore,
        reservedJoiner || zeroAddress,
      ]}
      approvals={utcApprovals}
      className={className}
      disabled={disabled}
      loadingText="[CREATING…]"
      errorText="[ERROR CREATING]"
      onSuccess={async () => {
        posthog.capture("lobby_created", {
          cost_limit_eth: formatEther(costLimit),
          turn_time_seconds: turnTime.toString(),
          creator_goes_first: creatorGoesFirst,
          max_score: maxScore.toString(),
          is_reserved: Boolean(isReserved),
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
