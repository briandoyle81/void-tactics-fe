"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateShipsReads } from "./useShipsContract";
import { RoguelikePosition } from "../types/roguelike";
import { trackMissionStarted, trackResupplyEntered, trackRunStarted } from "../utils/analytics/gameEvents";
import { useNearSession } from "../near/session";
import { GAS_DEFAULT, GAS_HEAVY } from "../near/config";
import { toBig } from "../near/codec";
import { nearViewPrefix } from "../near/useNearView";
import { useSinglePlayerMatch } from "./useSinglePlayerMatch";

export function useRoguelikeMatch() {
  const { send } = useNearSession();
  const { takeAITurn, takeAITurns } = useSinglePlayerMatch();
  const queryClient = useQueryClient();

  // Starting, advancing or ending a run reserves/releases roster ships
  // (inFleet) and changes the run, so both are refetched after each call.
  const afterRunChange = useCallback(() => {
    void invalidateShipsReads(queryClient);
    void queryClient.invalidateQueries({ queryKey: nearViewPrefix("get_run") });
  }, [queryClient]);

  // Each sends its analytics event once the transaction has succeeded.
  const startRun = useCallback(
    async (campaignId: bigint, shipIds: bigint[]) => {
      const receipt = await send({
        method: "start_run",
        args: { campaign_id: campaignId.toString(), ship_ids: shipIds.map(String) },
        gas: GAS_HEAVY,
      });
      afterRunChange();
      trackRunStarted({ appMode: "web3", campaignId, fleetSize: shipIds.length });
      return receipt;
    },
    [send, afterRunChange],
  );

  /** Places both fleets and starts the node's game. Resolves with the game id. */
  const enterCombatNode = useCallback(
    async (targetNodeId: bigint, positions: RoguelikePosition[]) => {
      const receipt = await send({
        method: "enter_combat_node",
        args: {
          node_id: targetNodeId.toString(),
          positions: positions.map((p) => ({ row: Number(p.row), col: Number(p.col) })),
        },
        gas: GAS_HEAVY,
      });
      const gameId = toBig(receipt.returnValue as string);
      afterRunChange();
      trackMissionStarted({ appMode: "web3", gameMode: "roguelike", nodeId: targetNodeId });
      return gameId;
    },
    [send, afterRunChange],
  );

  const enterResupplyNode = useCallback(
    async (targetNodeId: bigint) => {
      const receipt = await send({
        method: "enter_resupply_node",
        args: { node_id: targetNodeId.toString() },
        gas: GAS_DEFAULT,
      });
      afterRunChange();
      trackResupplyEntered({ appMode: "web3", nodeId: targetNodeId });
      return receipt;
    },
    [send, afterRunChange],
  );

  // gameId = 0 if no match is currently active (between nodes); the active
  // gameId if retreating mid-combat.
  const retreatRun = useCallback(
    async (gameId: bigint) => {
      const receipt = await send({ method: "retreat_run", args: { game_id: gameId.toString() }, gas: GAS_HEAVY });
      afterRunChange();
      return receipt;
    },
    [send, afterRunChange],
  );

  return { startRun, enterCombatNode, enterResupplyNode, retreatRun, takeAITurn, takeAITurns };
}
