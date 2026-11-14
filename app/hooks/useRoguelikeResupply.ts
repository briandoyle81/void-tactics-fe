"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNearSession } from "../near/session";
import { GAS_HEAVY } from "../near/config";
import { invalidateRoguelikeRunQueries } from "./useRoguelikeRun";
import { useGameSettings } from "../near/useGameSettings";
import type { GameSettings } from "../near/generated/voidTactics";

const selectRepairCost = (s: GameSettings) => BigInt(s.repair_cost_per_hp);

/** Repair cost per missing HP (UTC, 18 decimals), from get_settings. */
export function useRepairCostPerHP() {
  return useGameSettings(selectRepairCost);
}

/**
 * Resupply-node actions. Repairs debit UTC directly (no approval step on
 * NEAR); roster changes cost nothing.
 */
export function useRoguelikeResupply() {
  const { send } = useNearSession();
  const queryClient = useQueryClient();

  const resupplyModifyRoster = useCallback(
    async (shipIdsToAdd: bigint[], shipIdsToRemove: bigint[]) => {
      const receipt = await send({
        method: "resupply_modify_roster",
        args: { add: shipIdsToAdd.map(String), remove: shipIdsToRemove.map(String) },
        gas: GAS_HEAVY,
      });
      void invalidateRoguelikeRunQueries(queryClient);
      return receipt;
    },
    [send, queryClient],
  );

  const resupplyRepair = useCallback(
    async (shipIds: bigint[]) => {
      const receipt = await send({
        method: "resupply_repair",
        args: { ship_ids: shipIds.map(String) },
        gas: GAS_HEAVY,
      });
      void invalidateRoguelikeRunQueries(queryClient);
      return receipt;
    },
    [send, queryClient],
  );

  return { resupplyModifyRoster, resupplyRepair };
}
