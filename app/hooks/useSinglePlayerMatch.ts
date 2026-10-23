"use client";
import { useCallback } from "react";
import { useConfig, useReadContract, useWriteContract } from "wagmi";
import { estimateGas } from "wagmi/actions";
import { baseSepolia } from "viem/chains";
import { encodeFunctionData, type Abi } from "viem";
import { CONTRACT_ABIS, CONTRACT_ADDRESSES_BY_CHAIN_ID } from "../config/contracts";
import { paddedGasLimit } from "../utils/gasLimit";

// SinglePlayerMatch is Base Sepolia only today — pin to that chain directly
// rather than following the connected wallet/picker chain, same pattern as
// useTournamentAdmin.ts's CHAIN_ID.
const CHAIN_ID = baseSepolia.id;
const SINGLE_PLAYER_MATCH_ABI = CONTRACT_ABIS.SINGLE_PLAYER_MATCH as Abi;

export const SINGLE_PLAYER_MATCH_ADDRESS = CONTRACT_ADDRESSES_BY_CHAIN_ID[
  CHAIN_ID
].SINGLE_PLAYER_MATCH as `0x${string}`;

// The on-chain AI logic (pathfinding + combat resolution) makes takeAITurn
// a genuinely expensive call — measured via eth_estimateGas at ~1.41M gas
// for a single call on a real game, not the few-hundred-k typical of most
// writes here. Auto-estimation isn't reliable for this specific call under
// Dynamic's server-side (secure-enclave) signing path — set an explicit,
// generously-padded limit so it's never silently underestimated and leaves
// the AI's turn stuck mid-loop with no on-chain error at all. Confirmed
// flat cost regardless of map (per contracts-side update), so one constant
// covers every node.
const TAKE_AI_TURN_GAS_LIMIT = 2_500_000n;

// startNodeMatch's cost scales with the node's AI fleet size/complexity —
// confirmed up to ~4M gas on the most expensive map ("bastion") after the
// fleet-size rebalance. Unlike takeAITurn this isn't flat across nodes, but
// there's no per-node cost table wired into the frontend (and unused gas
// from the limit isn't spent, just capped), so one generously-padded
// constant used to cover every node. A bigger fleet outgrows any one
// number, so it's now estimated per call (paddedGasLimit), never below the
// old limit, with a large fallback if the estimate fails.
const START_NODE_MATCH_GAS_FLOOR = 5_500_000n;
const START_NODE_MATCH_GAS_FALLBACK = 10_000_000n;

export function useSinglePlayerMatch() {
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

  // Builds the human's fleet and starts the Game session in one call —
  // replaces the old acceptMatch/setupAIFleet two-step (removed from the
  // ABI entirely). Returns the tx hash only; the caller must await the
  // receipt and decode `gameId` from the NodeMatchStarted event rather than
  // computing it (the offset is an implementation detail, not something to
  // hardcode — see docs/singleplayer-frontend-integration.md).
  const startNodeMatch = useCallback(
    async (nodeId: bigint, shipIds: bigint[], positions: { row: number; col: number }[]) => {
      const args = [nodeId, shipIds, positions];
      const gas = await paddedGasLimit(
        () =>
          estimateGas(config, {
            to: SINGLE_PLAYER_MATCH_ADDRESS,
            data: encodeFunctionData({ abi: SINGLE_PLAYER_MATCH_ABI, functionName: "startNodeMatch", args }),
            chainId: CHAIN_ID,
          }),
        START_NODE_MATCH_GAS_FLOOR,
        START_NODE_MATCH_GAS_FALLBACK,
      );
      return writeContractAsync({
        address: SINGLE_PLAYER_MATCH_ADDRESS,
        abi: SINGLE_PLAYER_MATCH_ABI,
        functionName: "startNodeMatch",
        args,
        chainId: CHAIN_ID,
        gas,
      });
    },
    [writeContractAsync, config],
  );

  const takeAITurn = useCallback(
    (gameId: bigint) =>
      writeContractAsync({
        address: SINGLE_PLAYER_MATCH_ADDRESS,
        abi: SINGLE_PLAYER_MATCH_ABI,
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
        address: SINGLE_PLAYER_MATCH_ADDRESS,
        abi: SINGLE_PLAYER_MATCH_ABI,
        functionName: "takeAITurns",
        args: [gameId, BigInt(maxMoves)],
        chainId: CHAIN_ID,
        gas: TAKE_AI_TURN_GAS_LIMIT * BigInt(maxMoves),
      }),
    [writeContractAsync],
  );

  return { startNodeMatch, takeAITurn, takeAITurns };
}

// Maps a game back to the campaign node it was launched from — recorded
// on-chain by startNodeMatch. Used for the mission-result screen (which
// node was this, so it can show the right title / offer "return to
// campaign"). Node ids start at 1; 0 means "not a node match" (defensively
// handled even though every single-player game should have one).
export function useGameIdToNodeId(gameId: bigint | undefined) {
  const result = useReadContract({
    address: SINGLE_PLAYER_MATCH_ADDRESS,
    abi: SINGLE_PLAYER_MATCH_ABI,
    chainId: CHAIN_ID,
    functionName: "gameIdToNodeId",
    args: gameId != null ? [gameId] : undefined,
    query: {
      enabled: gameId != null,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      notifyOnChangeProps: ["data", "error"],
    },
  });
  return { ...result, data: result.data as bigint | undefined };
}
