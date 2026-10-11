"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthToken, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { baseSepolia } from "viem/chains";
import { toast } from "react-hot-toast";
import { getSelectedChainId, VOID_TACTICS_CHAIN_CHANGED_EVENT } from "../config/networks";

// Asks /api/faucet/gas once for test ETH when a player's Dynamic embedded
// wallet is in use on Base Sepolia (the server decides eligibility and
// enforces once-per-wallet; this only avoids asking again). Remembered per
// address in localStorage once the server says sent or already claimed. Testnet
// only, until an onramp replaces it. Mounted once in providers.tsx.

const DONE_KEY = "vt-gas-grant-v1";

function isDone(address: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(DONE_KEY) ?? "{}") as Record<string, boolean>)[address] === true;
  } catch {
    return false;
  }
}

function markDone(address: string): void {
  try {
    const done = JSON.parse(localStorage.getItem(DONE_KEY) ?? "{}") as Record<string, boolean>;
    done[address] = true;
    localStorage.setItem(DONE_KEY, JSON.stringify(done));
  } catch {
    // Storage unavailable: the server still refuses a second grant.
  }
}

export function GasGrantClaimer() {
  const { user, primaryWallet } = useDynamicContext();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const queryClient = useQueryClient();
  const [chainId, setChainId] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => setChainId(getSelectedChainId());
    sync();
    window.addEventListener(VOID_TACTICS_CHAIN_CHANGED_EVENT, sync);
    return () => window.removeEventListener(VOID_TACTICS_CHAIN_CHANGED_EVENT, sync);
  }, []);

  const address = primaryWallet?.address?.toLowerCase() ?? null;
  const isEmbedded =
    !!address &&
    (user?.verifiedCredentials ?? []).some(
      (vc) => vc.address?.toLowerCase() === address && vc.walletProvider === "embeddedWallet",
    );

  // Refetch the wallet's ETH balance (wagmi's "balance" queries, e.g. the
  // HUD pill) once the grant lands. Repeated a few times: RPC providers
  // load-balance across nodes, and one that hasn't seen the new block yet
  // returns the old balance, which would otherwise stick.
  const refreshBalancesAfter = useCallback(async (txHash: `0x${string}`) => {
    const refetchBalances = () =>
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "balance" });
    try {
      await publicClient?.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
    } catch (error) {
      console.warn("Gas grant receipt not confirmed yet:", error);
    }
    for (const delayMs of [0, 2_000, 5_000, 10_000]) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await refetchBalances();
    }
  }, [publicClient, queryClient]);

  useEffect(() => {
    if (chainId !== baseSepolia.id || !address || !isEmbedded || isDone(address)) return;
    let cancelled = false;
    void (async () => {
      const token = getAuthToken();
      if (!token) return;
      try {
        const res = await fetch("/api/faucet/gas", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ address }),
        });
        if (!res.ok) return; // Transient (faucet empty, auth hiccup): ask again next visit.
        const result = (await res.json()) as { status: string; txHash?: `0x${string}` };
        // Only final answers are remembered; "ineligible" (faucet off, daily
        // limit, a token that doesn't list the wallet yet) asks again later.
        if (result.status !== "sent" && result.status !== "already-claimed") return;
        markDone(address);
        if (result.status !== "sent" || !result.txHash || cancelled) return;
        toast.success("Your wallet received test ETH to cover transaction fees.");
        await refreshBalancesAfter(result.txHash);
      } catch (error) {
        console.error("Gas grant request failed:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chainId, address, isEmbedded, refreshBalancesAfter]);

  return null;
}
