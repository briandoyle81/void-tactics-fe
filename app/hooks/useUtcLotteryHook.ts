"use client";

import { useCallback, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { eventAbi, useCombinedEventWatch, type DecodedLog } from "./useCombinedEventWatch";
import { usePageVisible } from "./usePageVisible";
import { baseSepolia } from "viem/chains";
import type { Abi, Address } from "viem";
import lotteryHookDeploy from "../contracts/base-sepolia/uniswap-lottery-hook.json";
import { useSelectedChainId } from "./useSelectedChainId";

// Base Sepolia only — this Uniswap v4 hook's address is constrained by its
// permission-flag bits (mined, not an Ignition-module deploy), so it ships
// in its own combined address+ABI file rather than deployed_addresses.json.
const LOTTERY_HOOK_ADDRESS = lotteryHookDeploy.address as `0x${string}`;
const LOTTERY_HOOK_ABI = lotteryHookDeploy.abi as Abi;
const LOTTERY_HOOK_ADDRESSES = [LOTTERY_HOOK_ADDRESS] as const;
// A draw closes at a block (DrawClosed; DrawRetargeted moves that block),
// then resolves. These names must match the deployed hook: eventAbi throws
// at import for a missing one, which takes the whole Store down.
const LOTTERY_DRAW_STATE_EVENTS = ["DrawClosed", "DrawRetargeted"];
const LOTTERY_EVENTS = ["SellRecorded", "DrawResolved", "DrawResolvedNoWinner", ...LOTTERY_DRAW_STATE_EVENTS].map((name) =>
  eventAbi(LOTTERY_HOOK_ABI, name),
);
const LOTTERY_POLL_MS = 15_000;

const RECENT_EVENTS_LIMIT = 10;

export interface LotterySellEntry {
  drawId: bigint;
  ethProceeds: bigint;
  playerWeightInDraw: bigint;
  blockNumber: bigint | null;
}

export interface LotteryDrawResultEntry {
  drawId: bigint;
  winner?: Address;
  noWinner: boolean;
  blockNumber: bigint | null;
}

/**
 * UTCLotteryHook (docs/update/Frontend_Updates_2026-09-17.md §4): entry
 * weight into a draw is capped per address, and a resolved draw does not
 * always have a winner. Qualifying entries come from selling UTC on the
 * hooked Uniswap v4 pool directly (not from an action in this app) — this
 * hook only surfaces live status/results, it never initiates a swap.
 */
export function useUtcLotteryHook() {
  const activeChainId = useSelectedChainId();
  const { address: userAddress } = useAccount();
  const isDeployed =
    activeChainId === baseSepolia.id &&
    !!LOTTERY_HOOK_ADDRESS &&
    LOTTERY_HOOK_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const baseConfig = {
    address: LOTTERY_HOOK_ADDRESS,
    abi: LOTTERY_HOOK_ABI,
    chainId: baseSepolia.id,
  } as const;

  // Owner-configurable — always read live, never hardcode the documented
  // defaults (1 ether / 10 / etc).
  const { data: maxWeightPerEntryWei } = useReadContract({
    ...baseConfig,
    functionName: "maxWeightPerEntryWei",
    query: { enabled: isDeployed },
  });
  const { data: maxWinProbabilityDenominator } = useReadContract({
    ...baseConfig,
    functionName: "maxWinProbabilityDenominator",
    query: { enabled: isDeployed },
  });
  const { data: minEntryThresholdWei } = useReadContract({
    ...baseConfig,
    functionName: "minEntryThresholdWei",
    query: { enabled: isDeployed },
  });
  const { data: minParticipants } = useReadContract({
    ...baseConfig,
    functionName: "minParticipants",
    query: { enabled: isDeployed },
  });
  const { data: minTotalWeightWei } = useReadContract({
    ...baseConfig,
    functionName: "minTotalWeightWei",
    query: { enabled: isDeployed },
  });
  const { data: drawInterval } = useReadContract({
    ...baseConfig,
    functionName: "drawInterval",
    query: { enabled: isDeployed },
  });
  const { data: lastDrawTime, refetch: refetchLastDrawTime } = useReadContract({
    ...baseConfig,
    functionName: "lastDrawTime",
    query: { enabled: isDeployed },
  });

  const { data: currentDrawIdData, refetch: refetchCurrentDrawId } = useReadContract({
    ...baseConfig,
    functionName: "currentDrawId",
    query: { enabled: isDeployed },
  });
  const currentDrawId = currentDrawIdData as bigint | undefined;

  const { data: totalWeightInDraw, refetch: refetchTotalWeight } = useReadContract({
    ...baseConfig,
    functionName: "totalWeightInDraw",
    args: currentDrawId != null ? [currentDrawId] : undefined,
    query: { enabled: isDeployed && currentDrawId != null },
  });

  const { data: yourWeightInDraw, refetch: refetchYourWeight } = useReadContract({
    ...baseConfig,
    functionName: "weightInDraw",
    args: currentDrawId != null && userAddress ? [currentDrawId, userAddress] : undefined,
    query: { enabled: isDeployed && currentDrawId != null && !!userAddress },
  });

  const { data: hasParticipated, refetch: refetchHasParticipated } = useReadContract({
    ...baseConfig,
    functionName: "hasParticipated",
    args: currentDrawId != null && userAddress ? [currentDrawId, userAddress] : undefined,
    query: { enabled: isDeployed && currentDrawId != null && !!userAddress },
  });

  // The open draw closes once it has minParticipants entrants (and the
  // interval and weight floor are met). There's no count getter, so ask for
  // entrant number minParticipants: it exists only once there are that many.
  const minParticipantsCount = minParticipants as bigint | undefined;
  const { data: lastNeededEntrant, isError: lacksEntrants, refetch: refetchEntrants } = useReadContract({
    ...baseConfig,
    functionName: "drawParticipants",
    args:
      currentDrawId != null && minParticipantsCount != null && minParticipantsCount > 0n
        ? [currentDrawId, minParticipantsCount - 1n]
        : undefined,
    query: {
      enabled: isDeployed && currentDrawId != null && minParticipantsCount != null && minParticipantsCount > 0n,
      retry: false,
    },
  });
  const hasEnoughEntrants =
    minParticipantsCount == null
      ? undefined
      : minParticipantsCount === 0n
        ? true
        : lastNeededEntrant != null
          ? true
          : lacksEntrants
            ? false
            : undefined;

  // A closed draw waits to be resolved: the next swap in a later block does
  // it, or anyone can call resolveDraw. nextDrawToResolve is the oldest one
  // that may still be waiting.
  const { data: nextDrawToResolveData, refetch: refetchNextDrawToResolve } = useReadContract({
    ...baseConfig,
    functionName: "nextDrawToResolve",
    query: { enabled: isDeployed },
  });
  const nextDrawToResolve = nextDrawToResolveData as bigint | undefined;
  const closedDrawId =
    nextDrawToResolve != null && currentDrawId != null && nextDrawToResolve < currentDrawId
      ? nextDrawToResolve
      : null;

  const { data: closedDrawResolved, refetch: refetchClosedDrawResolved } = useReadContract({
    ...baseConfig,
    functionName: "drawResolved",
    args: closedDrawId != null ? [closedDrawId] : undefined,
    query: { enabled: isDeployed && closedDrawId != null },
  });
  // resolveDraw can resolve a later draw first; nextDrawToResolve only
  // steps past it on the next swap. Resolved means nothing is waiting.
  const pendingDrawId = closedDrawId != null && closedDrawResolved === false ? closedDrawId : null;

  const { data: yourWeightInPendingDraw, refetch: refetchYourPendingWeight } = useReadContract({
    ...baseConfig,
    functionName: "weightInDraw",
    args: pendingDrawId != null && userAddress ? [pendingDrawId, userAddress] : undefined,
    query: { enabled: isDeployed && pendingDrawId != null && !!userAddress },
  });

  // A swap only resolves a waiting draw with at least this much gas left.
  const { data: autoResolveMinGas } = useReadContract({
    ...baseConfig,
    functionName: "autoResolveMinGas",
    query: { enabled: isDeployed },
  });

  const refetchDrawState = useCallback(() => {
    void refetchCurrentDrawId();
    void refetchTotalWeight();
    void refetchYourWeight();
    void refetchHasParticipated();
    void refetchLastDrawTime();
    void refetchEntrants();
    void refetchNextDrawToResolve();
    void refetchClosedDrawResolved();
    void refetchYourPendingWeight();
  }, [
    refetchCurrentDrawId,
    refetchTotalWeight,
    refetchYourWeight,
    refetchHasParticipated,
    refetchLastDrawTime,
    refetchEntrants,
    refetchNextDrawToResolve,
    refetchClosedDrawResolved,
    refetchYourPendingWeight,
  ]);

  // Recent event feed — live only (from the moment this hook mounts), not a
  // backfilled history. Bounded so it can't grow unbounded across a long
  // session.
  const [recentSells, setRecentSells] = useState<LotterySellEntry[]>([]);
  const [recentDrawResults, setRecentDrawResults] = useState<LotteryDrawResultEntry[]>([]);

  // One combined log poll for the lottery events (it was four
  // watchers with inline handlers, which re-subscribed on every render),
  // paused while the tab is hidden.
  const isPageVisible = usePageVisible();
  const onLotteryLogs = useCallback(
    (logs: DecodedLog[]) => {
      const me = userAddress?.toLowerCase();
      const sells = logs.filter(
        (log) =>
          log.eventName === "SellRecorded" &&
          !!me &&
          (log.args?.player as Address | undefined)?.toLowerCase() === me,
      );
      const draws = logs.filter(
        (log) => log.eventName === "DrawResolved" || log.eventName === "DrawResolvedNoWinner",
      );
      if (sells.length > 0) {
        setRecentSells((prev) => {
          const additions: LotterySellEntry[] = sells.map((log) => ({
            drawId: (log.args?.drawId as bigint | undefined) ?? 0n,
            ethProceeds: (log.args?.ethProceeds as bigint | undefined) ?? 0n,
            playerWeightInDraw: (log.args?.playerWeightInDraw as bigint | undefined) ?? 0n,
            blockNumber: log.blockNumber,
          }));
          return [...additions, ...prev].slice(0, RECENT_EVENTS_LIMIT);
        });
      }
      if (draws.length > 0) {
        setRecentDrawResults((prev) => {
          const additions: LotteryDrawResultEntry[] = draws.map((log) =>
            log.eventName === "DrawResolvedNoWinner"
              ? { drawId: (log.args?.drawId as bigint | undefined) ?? 0n, noWinner: true, blockNumber: log.blockNumber }
              : {
                  drawId: (log.args?.drawId as bigint | undefined) ?? 0n,
                  winner: log.args?.winner as Address | undefined,
                  noWinner: false,
                  blockNumber: log.blockNumber,
                },
          );
          return [...additions, ...prev].slice(0, RECENT_EVENTS_LIMIT);
        });
      }
      if (sells.length > 0 || draws.length > 0 || logs.some((log) => LOTTERY_DRAW_STATE_EVENTS.includes(log.eventName ?? ""))) {
        refetchDrawState();
      }
    },
    [userAddress, refetchDrawState],
  );
  useCombinedEventWatch({
    chainId: baseSepolia.id,
    addresses: LOTTERY_HOOK_ADDRESSES,
    events: LOTTERY_EVENTS,
    enabled: isDeployed && isPageVisible,
    pollingInterval: LOTTERY_POLL_MS,
    onLogs: onLotteryLogs,
  });

  return {
    isDeployed,
    lotteryHookAddress: LOTTERY_HOOK_ADDRESS,
    maxWeightPerEntryWei: maxWeightPerEntryWei as bigint | undefined,
    maxWinProbabilityDenominator: maxWinProbabilityDenominator as bigint | undefined,
    minEntryThresholdWei: minEntryThresholdWei as bigint | undefined,
    minParticipants: minParticipants as bigint | undefined,
    minTotalWeightWei: minTotalWeightWei as bigint | undefined,
    drawInterval: drawInterval as bigint | undefined,
    lastDrawTime: lastDrawTime as bigint | undefined,
    currentDrawId,
    totalWeightInDraw: totalWeightInDraw as bigint | undefined,
    yourWeightInDraw: yourWeightInDraw as bigint | undefined,
    hasParticipated: hasParticipated as boolean | undefined,
    hasEnoughEntrants,
    pendingDrawId,
    yourWeightInPendingDraw: yourWeightInPendingDraw as bigint | undefined,
    autoResolveMinGas: autoResolveMinGas as bigint | undefined,
    recentSells,
    recentDrawResults,
    refetchDrawState,
  };
}
