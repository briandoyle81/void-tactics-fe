"use client";

import { useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import type { Hash, Log } from "viem";
import { toast } from "react-hot-toast";
import posthog from "posthog-js";
import { getContractAddresses } from "../config/contracts";
import { mintedShipIds } from "../utils/mintedShipIds";
import { constructErrorMessage, useConstructShips } from "./useConstructShips";
import { useOwnedShips } from "./useOwnedShips";
import { useSelectedChainId } from "./useSelectedChainId";

/**
 * Constructs the ships a mint just gave the player, straight after the mint
 * confirms (docs/frontend-handoff-2026-10-17.md §2): a ship's roll comes
 * from its mint block's hash, which can only be read for a few hours, so
 * waiting for the player to press Construct later risks the window closing.
 * Takes the mint's receipt and costs one more signature. If the player
 * declines or it fails, the ships stay unconstructed and can be built from
 * the fleet as before. Used by the ship pack purchase, the free ship claim,
 * the tutorial reward claim, and the card payment (a server-sent mint, passed
 * by hash).
 */
export function useConstructAfterMint() {
  const { address } = useAccount();
  const activeChainId = useSelectedChainId();
  const shipsAddress = getContractAddresses(activeChainId).SHIPS as string;
  const constructShips = useConstructShips();
  const { refetch: refetchOwnedShips } = useOwnedShips(undefined, { enabled: false });
  const publicClient = usePublicClient({ chainId: activeChainId });

  return useCallback(
    async (mint: { logs: readonly Log[] } | { hash: Hash }) => {
      if (!address) return;
      let logs: readonly Log[];
      if ("logs" in mint) {
        logs = mint.logs;
      } else {
        if (!publicClient) return;
        logs = (await publicClient.waitForTransactionReceipt({ hash: mint.hash })).logs;
      }
      const ids = mintedShipIds(logs, shipsAddress, address);
      if (ids.length === 0) return;
      const plural = ids.length === 1 ? "ship" : "ships";
      const toastId = toast.loading(`Constructing your new ${plural}…`);
      try {
        await constructShips({ ids });
        toast.success(`New ${plural} constructed`, { id: toastId });
        posthog.capture("ships_constructed", { action: "after_mint", ship_count: ids.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(
          constructErrorMessage(message) ?? `Construction skipped. Build your new ${plural} from your fleet.`,
          { id: toastId },
        );
      } finally {
        void refetchOwnedShips();
      }
    },
    [address, shipsAddress, constructShips, refetchOwnedShips, publicClient],
  );
}
