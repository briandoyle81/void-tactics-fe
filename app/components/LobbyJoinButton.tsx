"use client";

import React from "react";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";
import { erc20Approval } from "../utils/approvalSteps";
import { CONTRACT_ABIS, getContractAddresses } from "../config/contracts";
import { useSelectedChainId } from "../hooks/useSelectedChainId";
import { useAccount, useReadContract } from "wagmi";
import { formatEther, type Abi } from "viem";
import posthog from "posthog-js";

interface LobbyJoinButtonProps {
  lobbyId: bigint;
  /** additionalLobbyFee (UTC wei) when joining this open lobby is past the
   * player's free lobbies, else 0. Lobbies.joinLobby takes it with
   * transferFrom; a reserved joiner pays nothing. */
  lobbyFeeUtc?: bigint;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
}

const LOBBY_JOIN_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "_lobbyId", type: "uint256" }],
    name: "joinLobby",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Listed so viem decodes the revert name (shown by the caller's onError).
  { type: "error", name: "NotReservedJoiner", inputs: [] },
  { type: "error", name: "KickedFromLobby", inputs: [] },
  { type: "error", name: "InsufficientUTC", inputs: [] },
] as const;

export function LobbyJoinButton({
  lobbyId,
  lobbyFeeUtc = 0n,
  children,
  className = "",
  disabled = false,
  onSuccess,
  onError,
}: LobbyJoinButtonProps) {
  const { address } = useAccount();
  const chainId = useSelectedChainId();
  const contractAddresses = getContractAddresses(chainId);

  const { data: utcBalance } = useReadContract({
    address: contractAddresses.UNIVERSAL_CREDITS as `0x${string}`,
    abi: CONTRACT_ABIS.UNIVERSAL_CREDITS as Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: Boolean(address) && lobbyFeeUtc > 0n },
  });

  const validateBeforeTransaction = React.useCallback(() => {
    if (!address) {
      return "Please connect your wallet";
    }
    if (lobbyFeeUtc > 0n) {
      const balance = utcBalance as bigint | undefined;
      if (!balance || balance < lobbyFeeUtc) {
        return `Insufficient UTC balance. Need ${formatEther(lobbyFeeUtc)} UTC for the lobby fee.`;
      }
    }
    return true;
  }, [address, lobbyFeeUtc, utcBalance]);

  // The lobby fee: the Lobbies contract's UTC allowance is approved first if
  // it's short, then the lobby is joined straight after (one click).
  const utcApprovals = React.useMemo(
    () =>
      lobbyFeeUtc > 0n && address
        ? [
            erc20Approval({
              token: contractAddresses.UNIVERSAL_CREDITS as `0x${string}`,
              owner: address,
              spender: contractAddresses.LOBBIES as `0x${string}`,
              amount: lobbyFeeUtc,
              loadingText: `[APPROVING ${formatEther(lobbyFeeUtc)} UTC…]`,
            }),
          ]
        : undefined,
    [lobbyFeeUtc, address, contractAddresses.UNIVERSAL_CREDITS, contractAddresses.LOBBIES],
  );

  return (
    <TransactionButton
      transactionId={`join-lobby-${lobbyId}-${address}`}
      contractAddress={contractAddresses.LOBBIES as `0x${string}`}
      abi={LOBBY_JOIN_ABI}
      functionName="joinLobby"
      args={[lobbyId]}
      approvals={utcApprovals}
      className={className}
      disabled={disabled}
      loadingText="[JOINING…]"
      errorText="[ERROR JOINING]"
      onSuccess={async () => {
        posthog.capture("lobby_joined", { lobby_id: lobbyId.toString() });
        await onSuccess?.();
      }}
      onError={onError}
      validateBeforeTransaction={validateBeforeTransaction}
    >
      {children}
    </TransactionButton>
  );
}
