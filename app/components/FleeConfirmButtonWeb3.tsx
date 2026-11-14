"use client";

import React from "react";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";
import { GAS_DEFAULT } from "../near/config";
import { toast } from "react-hot-toast";
import type { NearCallSpec } from "../near/session";

// The web3-specific CONFIRM button for FleeSafetySwitch.tsx's retreat
// modal. Pass to `renderConfirmButton`.
// - PvP: `flee(game_id)`.
// - Roguelike: `retreat_run(game_id)`, which forfeits the
//   match as a loss and ends the run (the contract has no mission-only
//   retreat).
interface FleeConfirmButtonWeb3Props {
  gameId: bigint;
  onSuccess: TransactionFollowUp;
  isRoguelike?: boolean;
}

export function FleeConfirmButtonWeb3({
  gameId,
  onSuccess,
  isRoguelike = false,
}: FleeConfirmButtonWeb3Props) {
  const call = React.useMemo<NearCallSpec>(
    () =>
      isRoguelike
        ? { method: "retreat_run", args: { game_id: gameId.toString() }, gas: GAS_DEFAULT }
        : { method: "flee", args: { game_id: gameId.toString() }, gas: GAS_DEFAULT },
    [isRoguelike, gameId],
  );

  return (
    <TransactionButton
      transactionId={`flee-game-${gameId}`}
      call={call}
      onSuccess={async () => {
        toast.success("Disengaged from battle.");
        await onSuccess();
      }}
      onError={(error) => {
        console.error("Error disengaging:", error);
        const errorMessage = error.message || String(error);
        if (
          errorMessage.includes("User rejected") ||
          errorMessage.includes("User denied")
        ) {
          toast.error("Transaction declined");
        } else {
          toast.error("[ERR] Disengage failed: " + errorMessage);
        }
      }}
      className="flex-1 px-4 py-2 bg-warning-red/20 hover:bg-warning-red/30 text-white font-mono font-bold rounded-none border border-warning-red transition-colors tracking-wider"
      loadingText="DISENGAGING…"
      errorText="[ERR]"
    >
      CONFIRM
    </TransactionButton>
  );
}
