import { parseEventLogs, type Abi, type Log } from "viem";
import { CONTRACT_ABIS } from "../config/contracts";
import { eventAbi } from "../hooks/useCombinedEventWatch";

// A takeAITurn/takeAITurns sent with too little gas can succeed without the
// AI acting: its decision and its Pass fallback both run out of gas inside
// try/catch (contracts handoff 2026-10-30 §9). So the AI loops check the
// receipt for AITurnTaken (SinglePlayerMatch and RoguelikeMatch emit the same
// event) and, when it's missing, resend with more gas. It's still the AI's
// turn, so nothing else changes.

const AI_TURN_TAKEN_EVENT = eventAbi(CONTRACT_ABIS.SINGLE_PLAYER_MATCH as Abi, "AITurnTaken");

/** Resends after a receipt with no AITurnTaken, each with 1.5x the gas. */
export const AI_TURN_GAS_RETRIES = 2;

// Base Sepolia's block gas limit is 30M; stay under it.
const AI_TURN_GAS_CAP = 25_000_000n;

/** The gas limit for an AI turn's nth send (0 = first): 1.5x per resend, capped. */
export function aiTurnGas(base: bigint, attempt: number): bigint {
  let gas = base;
  for (let i = 0; i < attempt; i++) gas = (gas * 3n) / 2n;
  return gas < AI_TURN_GAS_CAP ? gas : AI_TURN_GAS_CAP;
}

/** The receipt shows the AI acted. */
export function aiTurnTakenIn(receiptLogs: readonly Log[]): boolean {
  return parseEventLogs({ abi: [AI_TURN_TAKEN_EVENT], logs: receiptLogs as Log[], strict: false }).length > 0;
}
