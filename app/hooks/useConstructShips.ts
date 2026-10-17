"use client";

import { useCallback } from "react";
import { useConfig, usePublicClient, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import type { Abi } from "viem";
import { CONTRACT_ABIS, getContractAddresses } from "../config/contracts";
import { getLegacyGasPriceOverridesForWrite } from "../utils/legacyGasPriceForWrite";
import { invalidateShipAttributesByIdsCache } from "../utils/shipAttributesLocalCache";
import { useEnsureConstructable } from "./useRandomManager";
import { useSelectedChainId } from "./useSelectedChainId";
import { useSwitchToSelectedChainIfNeeded } from "./useSwitchToSelectedChainIfNeeded";

// constructShips reverts the whole batch if any id is already constructed
// (selector 0xa6639c3e); RequestExpired bubbles up from RandomManager. Both
// are listed so viem can decode them.
const CONSTRUCT_ERRORS = [
  { type: "error", name: "ShipConstructed", inputs: [{ internalType: "uint256", name: "", type: "uint256" }] },
  { type: "error", name: "RequestExpired", inputs: [{ internalType: "uint256", name: "requestId", type: "uint256" }] },
] as const;

const CONSTRUCT_SHIPS_ABI = [
  {
    inputs: [{ internalType: "uint256[]", name: "_ids", type: "uint256[]" }],
    name: "constructShips",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  ...CONSTRUCT_ERRORS,
] as Abi;

const CONSTRUCT_ALL_ABI = [
  {
    inputs: [],
    name: "constructAllMyShips",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  ...CONSTRUCT_ERRORS,
] as Abi;

type LiveShip = {
  id: bigint;
  traits: { serialNumber: bigint };
  shipData: { constructed: boolean };
};

/**
 * Constructs ships in one player-signed transaction (constructShips for a
 * list, constructAllMyShips for "all"). Constructing also reveals the ship's
 * roll, so there's no separate reveal step (see useRandomManager.ts).
 *
 * Before signing it re-reads the ships (the navy list can lag a construct)
 * and drops any already built, then checks none has expired and waits for
 * the mint block to be sealed (useEnsureConstructable). Returns false when
 * there was nothing left to construct. Shared by ShipActionButton and the
 * construct-right-after-mint flows (useConstructAfterMint).
 */
export function useConstructShips() {
  const activeChainId = useSelectedChainId();
  const contractAddresses = getContractAddresses(activeChainId);
  const switchToSelectedChainIfNeeded = useSwitchToSelectedChainIfNeeded();
  const publicClient = usePublicClient({ chainId: activeChainId });
  const wagmiConfig = useConfig();
  const { writeContractAsync } = useWriteContract();
  const ensureConstructable = useEnsureConstructable();

  return useCallback(
    async (target: { ids: readonly bigint[] } | { all: true; ids: readonly bigint[] }): Promise<boolean> => {
      await switchToSelectedChainIfNeeded();
      if (!publicClient) throw new Error("No RPC client available");
      const shipsAddress = contractAddresses.SHIPS as `0x${string}`;
      const constructAll = "all" in target;

      const live =
        target.ids.length > 0
          ? ((await publicClient.readContract({
              address: shipsAddress,
              abi: CONTRACT_ABIS.SHIPS as Abi,
              functionName: "getShipsByIds",
              args: [[...target.ids]],
            })) as LiveShip[])
          : [];
      const unbuilt = live.filter((s) => !s.shipData.constructed);
      if (!constructAll && unbuilt.length === 0) {
        invalidateShipAttributesByIdsCache(activeChainId);
        return false;
      }

      await ensureConstructable(unbuilt.map((s) => s.traits.serialNumber));

      const hash = await writeContractAsync({
        address: shipsAddress,
        abi: constructAll ? CONSTRUCT_ALL_ABI : CONSTRUCT_SHIPS_ABI,
        functionName: constructAll ? "constructAllMyShips" : "constructShips",
        args: constructAll ? [] : [unbuilt.map((s) => s.id)],
        chainId: activeChainId,
        ...(await getLegacyGasPriceOverridesForWrite(activeChainId, publicClient)),
      });
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: activeChainId });
      if (receipt.status === "reverted") throw new Error("Transaction reverted on-chain");

      // Construction is what populates a ship's real attributes (equipment is
      // all zeros until then). The by-ids attributes cache is keyed only by
      // the shipIds list, which doesn't change when a ship goes
      // unconstructed -> constructed, so without this the navy keeps serving
      // the pre-construction zeros (e.g. 0% armor/shield damage reduction).
      invalidateShipAttributesByIdsCache(activeChainId);
      return true;
    },
    [
      switchToSelectedChainIfNeeded,
      publicClient,
      contractAddresses.SHIPS,
      activeChainId,
      ensureConstructable,
      writeContractAsync,
      wagmiConfig,
    ],
  );
}

/** A player-facing message for a construct failure, or null for a wallet decline. */
export function constructErrorMessage(message: string): string | null {
  if (message.includes("User rejected") || message.includes("User denied") || message.includes("rejected")) {
    return null;
  }
  if (message.includes("RequestExpired")) {
    return "Construction window missed. Contact support to have these ships re-armed.";
  }
  if (message.includes("TooSoonToReveal")) {
    return "These ships aren't ready to construct yet. Try again in a few seconds.";
  }
  if (message.includes("ShipConstructed") || message.includes("0xa6639c3e")) {
    return "Some of these ships are already constructed. Refreshing your fleet.";
  }
  return `Failed to construct: ${message}`;
}
