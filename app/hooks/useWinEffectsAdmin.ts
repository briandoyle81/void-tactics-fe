"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNearSession } from "../near/session";
import { fetchAllRoguelikeNodes } from "../near/adapters/roguelike";
import { GAS_HEAVY } from "../near/config";
import { RL_GRAPH_QUERY_ROOT } from "./useGameLens";
import type { WinEffect } from "../near/generated/voidTactics";

/**
 * Campaign-wide win-effect values. On NEAR each node stores its own DCC
 * bonus / heal percent, so "set the bonus" rewrites every node that runs
 * that effect (one transaction per node; NODE_EDITOR or owner).
 */
export function useWinEffectsAdmin() {
  const { send } = useNearSession();
  const queryClient = useQueryClient();

  const rewriteNodes = useCallback(
    async (change: (e: WinEffect) => WinEffect | null) => {
      const nodes = await fetchAllRoguelikeNodes();
      let last = null;
      for (const { node, raw } of nodes) {
        let changed = false;
        const next = raw.win_effects.map((e) => {
          const r = change(e);
          if (!r) return e;
          changed = true;
          return r;
        });
        if (!changed) continue;
        last = await send({
          method: "set_rl_node_win_effects",
          args: { node_id: node.id.toString(), effects: next },
          gas: GAS_HEAVY,
        });
      }
      void queryClient.invalidateQueries({ queryKey: [RL_GRAPH_QUERY_ROOT] });
      return last?.hash ?? null;
    },
    [send, queryClient],
  );

  const setDecBonusAmount = useCallback(
    (amount: bigint) =>
      rewriteNodes((e) => ("DecBonus" in e ? { DecBonus: { amount: amount.toString() } } : null)),
    [rewriteNodes],
  );

  const setHealAboveFloorPercent = useCallback(
    (percent: number) => rewriteNodes((e) => ("HealAboveFloor" in e ? { HealAboveFloor: { percent } } : null)),
    [rewriteNodes],
  );

  return { setDecBonusAmount, setHealAboveFloorPercent };
}
