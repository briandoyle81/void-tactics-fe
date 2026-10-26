"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { baseSepolia } from "viem/chains";
import type { Abi, AbiEvent, Address, Hash } from "viem";
import lotteryHookDeploy from "../contracts/base-sepolia/uniswap-lottery-hook.json";
import { getContractAddresses } from "../config/contracts";
import { mintedShipIds } from "../utils/mintedShipIds";
import { eventAbi } from "./useCombinedEventWatch";

const LOTTERY_HOOK_ADDRESS = lotteryHookDeploy.address as Address;
const DRAW_RESOLVED_EVENT: AbiEvent = eventAbi(lotteryHookDeploy.abi as Abi, "DrawResolved");

/**
 * How far back to look for wins: a ship can only be constructed for 8191
 * blocks (~4.5 h on Base) after its mint, so an older prize is past saving
 * here (docs/frontend-handoff-2026-10-17.md §2).
 */
const PRIZE_LOOKBACK_BLOCKS = 8191n;
/** The public Base Sepolia RPC caps eth_getLogs at 200 blocks; a keyed one may allow the whole window in one call. */
const LOG_CHUNK_BLOCKS = 200n;
const LOG_CHUNK_CONCURRENCY = 4;

type WinLog = { drawId: bigint; transactionHash: Hash; blockNumber: bigint };

// Wins found so far per player, and the last block scanned, so a refetch
// only reads the blocks since (one small getLogs) instead of the window.
const scanned = new Map<string, { toBlock: bigint; wins: WinLog[] }>();

export interface LotteryPrize {
  drawId: bigint;
  transactionHash: Hash;
  /** Ships the resolving transaction minted to the winner. */
  shipIds: bigint[];
}

/**
 * The player's recent lottery wins and the ships each one minted them. A
 * curated prize arrives constructed; the random 4-star fallback arrives
 * unconstructed and has to be built while its mint block's hash is still
 * readable, so the Lottery panel offers to construct it. Prizes are minted
 * in someone else's swap (or a resolveDraw), so they're found from the
 * DrawResolved logs naming the player (winner is indexed), then each
 * resolving transaction's Transfer logs. `refreshKey` refetches (a live win
 * came in).
 */
export function useLotteryPrizes(player: Address | undefined, enabled: boolean, refreshKey: string) {
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const shipsAddress = getContractAddresses(baseSepolia.id).SHIPS as string;

  return useQuery({
    queryKey: ["lotteryPrizes", LOTTERY_HOOK_ADDRESS, player, refreshKey],
    enabled: enabled && !!player && !!publicClient,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<LotteryPrize[]> => {
      if (!player || !publicClient) return [];
      const latest = await publicClient.getBlockNumber();
      const windowStart = latest > PRIZE_LOOKBACK_BLOCKS ? latest - PRIZE_LOOKBACK_BLOCKS : 0n;
      const cacheKey = `${LOTTERY_HOOK_ADDRESS}:${player}`.toLowerCase();
      const prev = scanned.get(cacheKey);
      const fromBlock = prev && prev.toBlock + 1n > windowStart ? prev.toBlock + 1n : windowStart;

      const readWins = async (from: bigint, to: bigint): Promise<WinLog[]> => {
        const logs = await publicClient.getLogs({
          address: LOTTERY_HOOK_ADDRESS,
          event: DRAW_RESOLVED_EVENT,
          args: { winner: player },
          fromBlock: from,
          toBlock: to,
        });
        return logs.flatMap((log) =>
          log.transactionHash && log.blockNumber != null
            ? [
                {
                  drawId: (log as { args?: { drawId?: bigint } }).args?.drawId ?? 0n,
                  transactionHash: log.transactionHash,
                  blockNumber: log.blockNumber,
                },
              ]
            : [],
        );
      };
      let found: WinLog[] = [];
      if (fromBlock <= latest) {
        try {
          found = await readWins(fromBlock, latest);
        } catch {
          // The RPC limits the range: read it in pieces.
          const ranges: [bigint, bigint][] = [];
          for (let start = fromBlock; start <= latest; start += LOG_CHUNK_BLOCKS) {
            const end = start + LOG_CHUNK_BLOCKS - 1n;
            ranges.push([start, end < latest ? end : latest]);
          }
          for (let i = 0; i < ranges.length; i += LOG_CHUNK_CONCURRENCY) {
            const batch = await Promise.all(ranges.slice(i, i + LOG_CHUNK_CONCURRENCY).map(([a, b]) => readWins(a, b)));
            found.push(...batch.flat());
          }
        }
      }
      const wins = [...(prev?.wins ?? []), ...found].filter((w) => w.blockNumber >= windowStart);
      scanned.set(cacheKey, { toBlock: latest, wins });

      return Promise.all(
        wins.map(async (win) => {
          const receipt = await publicClient.getTransactionReceipt({ hash: win.transactionHash });
          return {
            drawId: win.drawId,
            transactionHash: win.transactionHash,
            shipIds: mintedShipIds(receipt.logs, shipsAddress, player),
          };
        }),
      );
    },
  });
}
