"use client";

import { useCallback } from "react";
import { useConfig, useWriteContract } from "wagmi";
import { estimateGas, waitForTransactionReceipt } from "wagmi/actions";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateShipsReads } from "./useShipsContract";
import { baseSepolia } from "viem/chains";
import { encodeFunctionData, type Abi } from "viem";
import { CONTRACT_ABIS, CONTRACT_ADDRESSES_BY_CHAIN_ID } from "../config/contracts";
import { RoguelikePosition } from "../types/roguelike";
import { paddedGasLimit } from "../utils/gasLimit";
import {
  trackMissionStarted,
  trackResupplyEntered,
  trackRunStarted,
} from "../utils/analytics/gameEvents";

const CHAIN_ID = baseSepolia.id;
const ROGUELIKE_MATCH_ABI = CONTRACT_ABIS.ROGUELIKE_MATCH as Abi;
export const ROGUELIKE_MATCH_ADDRESS = CONTRACT_ADDRESSES_BY_CHAIN_ID[
  CHAIN_ID
].ROGUELIKE_MATCH as `0x${string}`;

// takeAITurn is the same underlying Game/AIBehavior cost as
// SinglePlayerMatch.takeAITurn (see useSinglePlayerMatch.ts) — same padded
// limit.
const TAKE_AI_TURN_GAS_LIMIT = 2_500_000n;

// enterCombatNode is the call that actually places the AI fleet and starts
// the Game session (startRun itself only reserves the human roster via
// Fleets, no AI placement). Its cost grows with both fleets (~6M for a
// 7-ship fleet on Collision Course), so it's estimated per call
// (paddedGasLimit): never below the old fixed limit, and a large fallback
// if the estimate fails. Base Sepolia's block limit is 30M.
const ENTER_COMBAT_NODE_GAS_FLOOR = 5_500_000n;
const ENTER_COMBAT_NODE_GAS_FALLBACK = 10_000_000n;

export function useRoguelikeMatchContract() {
  return {
    address: ROGUELIKE_MATCH_ADDRESS,
    abi: ROGUELIKE_MATCH_ABI,
    chainId: CHAIN_ID,
  };
}

export function useRoguelikeMatch() {
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();
  const queryClient = useQueryClient();

  // Callers refetch run/node state right after these resolve, so each write
  // waits for its receipt here rather than just returning the submitted
  // hash — otherwise the refetch races the still-pending transaction and
  // reads stale state.
  const writeAndWait = useCallback(
    async (functionName: string, args: unknown[], gas?: bigint) => {
      const hash = await writeContractAsync({
        address: ROGUELIKE_MATCH_ADDRESS,
        abi: ROGUELIKE_MATCH_ABI,
        functionName,
        args,
        chainId: CHAIN_ID,
        ...(gas != null ? { gas } : {}),
      });
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: CHAIN_ID });
      // A mined-but-reverted tx resolves here too; surface it as a failure
      // instead of letting callers report success.
      if (receipt.status === "reverted") {
        throw new Error(`Transaction reverted (${functionName})`);
      }
      // Starting, advancing or ending a run reserves/releases roster ships
      // (inFleet), which the staleTime: Infinity Ships reads won't notice.
      void invalidateShipsReads(queryClient);
      return hash;
    },
    [writeContractAsync, config, queryClient],
  );

  // Each sends its analytics event once the transaction has succeeded.
  const startRun = useCallback(
    async (campaignId: bigint, shipIds: bigint[]) => {
      const hash = await writeAndWait("startRun", [campaignId, shipIds]);
      trackRunStarted({ appMode: "web3", campaignId, fleetSize: shipIds.length });
      return hash;
    },
    [writeAndWait],
  );

  const enterCombatNode = useCallback(
    async (targetNodeId: bigint, positions: RoguelikePosition[]) => {
      const args = [targetNodeId, positions];
      const gas = await paddedGasLimit(
        () =>
          estimateGas(config, {
            to: ROGUELIKE_MATCH_ADDRESS,
            data: encodeFunctionData({ abi: ROGUELIKE_MATCH_ABI, functionName: "enterCombatNode", args }),
            chainId: CHAIN_ID,
          }),
        ENTER_COMBAT_NODE_GAS_FLOOR,
        ENTER_COMBAT_NODE_GAS_FALLBACK,
      );
      const hash = await writeAndWait("enterCombatNode", args, gas);
      trackMissionStarted({ appMode: "web3", gameMode: "roguelike", nodeId: targetNodeId });
      return hash;
    },
    [writeAndWait, config],
  );

  const enterResupplyNode = useCallback(
    async (targetNodeId: bigint) => {
      const hash = await writeAndWait("enterResupplyNode", [targetNodeId]);
      trackResupplyEntered({ appMode: "web3", nodeId: targetNodeId });
      return hash;
    },
    [writeAndWait],
  );

  // gameId = 0 if no match is currently active (between nodes); the active
  // gameId if retreating mid-combat. Mid-combat is two calls (forfeit, then
  // end the run), so run_retreated is sent by the caller, RoguelikeGraph.
  const retreatRun = useCallback(
    (gameId: bigint) => writeAndWait("retreatRun", [gameId]),
    [writeAndWait],
  );

  // AI moves send without waiting or touching the ships cache: the AI loop
  // waits for the receipt itself (writeAndWait here made it wait twice) and
  // an AI move never changes which ships the player owns.
  const takeAITurn = useCallback(
    (gameId: bigint) =>
      writeContractAsync({
        address: ROGUELIKE_MATCH_ADDRESS,
        abi: ROGUELIKE_MATCH_ABI,
        functionName: "takeAITurn",
        args: [gameId],
        chainId: CHAIN_ID,
        gas: TAKE_AI_TURN_GAS_LIMIT,
      }),
    [writeContractAsync],
  );

  // Several AI moves in one tx — only when the human has no unmoved ships
  // left this round (see app/utils/aiTurnBatch.ts). Gas scales per move.
  const takeAITurns = useCallback(
    (gameId: bigint, maxMoves: number) =>
      writeContractAsync({
        address: ROGUELIKE_MATCH_ADDRESS,
        abi: ROGUELIKE_MATCH_ABI,
        functionName: "takeAITurns",
        args: [gameId, BigInt(maxMoves)],
        chainId: CHAIN_ID,
        gas: TAKE_AI_TURN_GAS_LIMIT * BigInt(maxMoves),
      }),
    [writeContractAsync],
  );

  return { startRun, enterCombatNode, enterResupplyNode, retreatRun, takeAITurn, takeAITurns };
}
