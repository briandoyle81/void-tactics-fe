"use client";

import { useCallback, useEffect, useState } from "react";
import { encodeFunctionData, type Abi, type Address, type Hex } from "viem";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { simulateContract } from "wagmi/actions";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { getWalletAccounts } from "@dynamic-labs-sdk/client";
import {
  EvmGasSponsorshipNotEnabledError,
  getEVMSponsoredTransactionStatus,
  isEvmGasSponsorshipEnabled,
  isEvmWalletAccount,
  relaySponsoredTransaction,
  type EvmWalletAccount,
} from "@dynamic-labs-sdk/evm";
import { addWaasEvmExtension } from "@dynamic-labs-sdk/evm/waas";
import posthog from "posthog-js";

// Gas sponsorship (Dynamic's native EVM sponsorship, Sponsor Gas › Dynamic in
// the dashboard). Dynamic only pays for transactions sent through its relayer
// (relaySponsoredTransaction), never for an ordinary eth_sendTransaction, so
// every contract write in the client goes through useSponsoredWriteContract
// (a drop-in for wagmi's useWriteContract; lint forbids the wagmi one):
// - The player's Dynamic embedded wallet, with sponsorship on: the call is
//   simulated (same revert errors as before), signed as a sponsored intent and
//   relayed. It resolves with the transaction hash once the relay has
//   broadcast it, so callers wait for the receipt as before. msg.sender is
//   still the player's address (EIP-7702; the first send delegates the wallet
//   once, automatically). The receipt's `from` is Dynamic's relayer.
// - A browser wallet, or sponsorship off: wagmi's writeContract, as before
//   (the player pays gas).

const EMBEDDED_PROVIDER_PREFIX = "dynamicwaas";
const STATUS_POLL_MS = 750;
const HASH_TIMEOUT_MS = 90_000;

let waasExtensionAdded = false;

/**
 * Registers the embedded wallet's signer with Dynamic's JS client (which
 * sdk-react-core creates but never wires for sponsorship). Mounted once by
 * providers.tsx.
 */
export function RegisterGasSponsorship() {
  const { sdkHasLoaded } = useDynamicContext();
  useEffect(() => {
    if (!sdkHasLoaded || waasExtensionAdded) return;
    try {
      addWaasEvmExtension();
      waasExtensionAdded = true;
    } catch (error) {
      console.error("[gas sponsorship] couldn't register the embedded wallet provider:", error);
    }
  }, [sdkHasLoaded]);
  return null;
}

/** The player's embedded wallet account, when Dynamic will sponsor its gas. */
function sponsorableAccount(address: Address | undefined): EvmWalletAccount | null {
  if (!address || !waasExtensionAdded) return null;
  try {
    if (!isEvmGasSponsorshipEnabled()) return null;
    const lower = address.toLowerCase();
    return (
      getWalletAccounts().find(
        (account): account is EvmWalletAccount =>
          isEvmWalletAccount(account) &&
          account.walletProviderKey.startsWith(EMBEDDED_PROVIDER_PREFIX) &&
          account.address.toLowerCase() === lower,
      ) ?? null
    );
  } catch {
    return null;
  }
}

async function waitForRelayHash(requestId: string): Promise<Hex> {
  const deadline = Date.now() + HASH_TIMEOUT_MS;
  for (;;) {
    const status = await getEVMSponsoredTransactionStatus({ requestId });
    if (status.status === "failure") {
      throw new Error(status.errorMessage || "The sponsored transaction failed.");
    }
    if (status.transactionHash) return status.transactionHash;
    if (Date.now() > deadline) {
      throw new Error("The sponsored transaction wasn't sent in time. Try again.");
    }
    await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MS));
  }
}

type WagmiWrite = ReturnType<typeof useWriteContract>;
type LooseWriteParams = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  chainId?: number;
};

/**
 * wagmi's useWriteContract, with gas sponsored for the embedded wallet (see
 * the top of this file). Same shape: writeContract / writeContractAsync,
 * data (hash), isPending, error, reset.
 */
export function useSponsoredWriteContract() {
  const wagmiWrite = useWriteContract();
  const { writeContractAsync: wagmiWriteAsync, reset: wagmiReset } = wagmiWrite;
  const { address, chainId: walletChainId } = useAccount();
  const config = useConfig();
  const [state, setState] = useState<{ data: Hex | undefined; error: Error | null; isPending: boolean }>({
    data: undefined,
    error: null,
    isPending: false,
  });

  const writeContractAsync = useCallback(
    async (...callArgs: Parameters<WagmiWrite["writeContractAsync"]>): Promise<Hex> => {
      const params = callArgs[0] as unknown as LooseWriteParams;
      setState({ data: undefined, error: null, isPending: true });
      try {
        const walletAccount =
          params.chainId == null || params.chainId === walletChainId ? sponsorableAccount(address) : null;
        let hash: Hex;
        if (walletAccount && address) {
          try {
            hash = await sendSponsored(params, address, walletAccount, config);
          } catch (error) {
            if (!(error instanceof EvmGasSponsorshipNotEnabledError)) throw error;
            hash = await wagmiWriteAsync(...callArgs);
          }
        } else {
          hash = await wagmiWriteAsync(...callArgs);
        }
        setState({ data: hash, error: null, isPending: false });
        return hash;
      } catch (error) {
        setState({ data: undefined, error: error as Error, isPending: false });
        throw error;
      }
    },
    [address, walletChainId, config, wagmiWriteAsync],
  ) as WagmiWrite["writeContractAsync"];

  // Like wagmi's writeContract: fire and forget, errors land in `error`.
  const writeContract = useCallback(
    (...callArgs: Parameters<WagmiWrite["writeContract"]>) => {
      (writeContractAsync as (...a: unknown[]) => Promise<Hex>)(...callArgs).catch(() => {});
    },
    [writeContractAsync],
  ) as WagmiWrite["writeContract"];

  const reset = useCallback(() => {
    wagmiReset();
    setState({ data: undefined, error: null, isPending: false });
  }, [wagmiReset]);

  return { writeContract, writeContractAsync, reset, ...state };
}

async function sendSponsored(
  params: LooseWriteParams,
  address: Address,
  walletAccount: EvmWalletAccount,
  config: ReturnType<typeof useConfig>,
): Promise<Hex> {
  // Surface reverts (and their reasons) before signing, like a wallet's gas
  // estimate does.
  await simulateContract(config, {
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
    value: params.value,
    chainId: params.chainId,
    account: address,
  } as Parameters<typeof simulateContract>[1]);

  const data = encodeFunctionData({
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
  } as Parameters<typeof encodeFunctionData>[0]);

  try {
    const { requestId } = await relaySponsoredTransaction({
      walletAccount,
      calls: [{ target: params.address, data, value: params.value ?? BigInt(0) }],
    });
    return await waitForRelayHash(requestId);
  } catch (error) {
    if (!(error instanceof EvmGasSponsorshipNotEnabledError)) {
      console.error("[gas sponsorship] sponsored send failed:", error);
      posthog.capture("sponsored_tx_failed", {
        function_name: params.functionName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}
