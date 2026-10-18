"use client";

import { useCallback, useMemo } from "react";
import { usePublicClient, useReadContracts } from "wagmi";
import type { Abi } from "viem";
import { CONTRACT_ABIS, getContractAddresses } from "../config/contracts";
import { useSelectedChainId } from "./useSelectedChainId";
import type { Ship } from "../types/types";

const RANDOM_MANAGER_ABI = CONTRACT_ABIS.RANDOM_MANAGER as Abi;

// Since the 2026-10-17 redeploy a ship's roll is
// keccak256(blockhash(mint block), requestId), fixed once the mint's block is
// sealed (docs/frontend-handoff-2026-10-17.md §2). Constructing reads that
// hash and reveals the stats in the same transaction, so there's no separate
// reveal step. The hash is only readable for a limited window after the
// mint (8191 blocks, ~4.5h on Base); after that the request expires and the
// ship can't be constructed until an admin re-targets it. The contract's
// `isExpired` / `canFulfillBatch` are the source of truth for both, so no
// window size is hard-coded here.

/** Construct needs one block past the mint; Base makes one every ~2s. */
const READY_POLL_INTERVAL_MS = 1000;
const READY_TIMEOUT_MS = 20000;

/** Thrown when a ship's construction window has passed (admin re-target needed). */
export const REQUEST_EXPIRED_ERROR = "RequestExpired";
/** Thrown when the mint block isn't sealed yet within the wait. */
export const NOT_READY_ERROR = "TooSoonToReveal";

/**
 * Checks a set of unconstructed ships can be constructed now, before
 * spending a signature: throws REQUEST_EXPIRED_ERROR if any has expired, and
 * waits (polling the free `canFulfillBatch` view) until the mint block is
 * sealed, throwing NOT_READY_ERROR if that takes too long. Reads only.
 */
export function useEnsureConstructable() {
  const activeChainId = useSelectedChainId();
  const contractAddresses = getContractAddresses(activeChainId);
  const publicClient = usePublicClient({ chainId: activeChainId });

  return useCallback(
    async (serialNumbers: bigint[]) => {
      if (!publicClient) throw new Error("No RPC client available");
      if (serialNumbers.length === 0) return;
      const address = contractAddresses.RANDOM_MANAGER as `0x${string}`;

      const expired = await publicClient.multicall({
        contracts: serialNumbers.map((serial) => ({
          address,
          abi: RANDOM_MANAGER_ABI,
          functionName: "isExpired",
          args: [serial],
        })),
        allowFailure: false,
      });
      if (expired.some(Boolean)) throw new Error(REQUEST_EXPIRED_ERROR);

      const deadline = Date.now() + READY_TIMEOUT_MS;
      for (;;) {
        const ready = await publicClient.readContract({
          address,
          abi: RANDOM_MANAGER_ABI,
          functionName: "canFulfillBatch",
          args: [serialNumbers],
        });
        if (ready) return;
        if (Date.now() > deadline) throw new Error(NOT_READY_ERROR);
        await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL_MS));
      }
    },
    [publicClient, contractAddresses],
  );
}

/**
 * Which of `ships` (unconstructed ones) missed their construction window
 * and need an admin re-target: serial number → true. One batched read.
 */
export function useExpiredShipSerials(ships: readonly Ship[]) {
  const activeChainId = useSelectedChainId();
  const contractAddresses = getContractAddresses(activeChainId);
  const serials = useMemo(
    () => ships.filter((s) => !s.shipData.constructed).map((s) => s.traits.serialNumber),
    [ships],
  );
  const contracts = useMemo(
    () =>
      serials.map((serial) => ({
        address: contractAddresses.RANDOM_MANAGER as `0x${string}`,
        abi: RANDOM_MANAGER_ABI,
        functionName: "isExpired" as const,
        args: [serial] as const,
        chainId: activeChainId,
      })),
    [serials, contractAddresses.RANDOM_MANAGER, activeChainId],
  );
  const result = useReadContracts({ contracts, query: { enabled: contracts.length > 0 } });
  const expiredSerials = useMemo(() => {
    const set = new Set<string>();
    serials.forEach((serial, i) => {
      if (result.data?.[i]?.result === true) set.add(serial.toString());
    });
    return set;
  }, [serials, result.data]);
  return { expiredSerials, refetch: result.refetch };
}
