"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { formatEther, parseEther, parseEventLogs } from "viem";
import type { Abi, TransactionReceipt } from "viem";
import { UTC_DISPLAY_DECIMALS, formatBalance } from "../utils/formatBalance";
import { toast } from "react-hot-toast";
import { TransactionButton } from "./TransactionButton";
import lotteryHookDeploy from "../contracts/base-sepolia/uniswap-lottery-hook.json";
import { useUtcLotteryHook } from "../hooks/useUtcLotteryHook";
import { useLotteryPrizes } from "../hooks/useLotteryPrizes";
import { useOwnedShips } from "../hooks/useOwnedShips";
import { useExpiredShipSerials } from "../hooks/useRandomManager";
import { ShipActionButton } from "./ShipActionButton";
import { ShipImage } from "./ShipImage";
import type { Ship } from "../types/types";
import { useUtcSellSwap, useUtcSellQuote } from "../hooks/useUtcSellSwap";
import {
  PERMIT2_ABI,
  PERMIT2_ADDRESS,
  UNIVERSAL_ROUTER_ABI,
  UNIVERSAL_ROUTER_ADDRESS,
  encodeUtcSellSwap,
} from "../config/uniswapV4";
import { CONTRACT_ABIS } from "../config/contracts";

const LOTTERY_HOOK_ABI = lotteryHookDeploy.abi as Abi;
const UTC_ABI = CONTRACT_ABIS.UNIVERSAL_CREDITS as Abi;

const MAX_UINT160 = (1n << 160n) - 1n;
const MAX_UINT256 = (1n << 256n) - 1n;
const PERMIT2_APPROVAL_WINDOW_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SLIPPAGE_BPS = 200n; // 2%

// While a closed draw waits, a sell gets this much gas over the hook's
// autoResolveMinGas so it resolves that draw too (the wallet's own estimate
// comes in under the floor, and the hook then skips resolving).
const RESOLVE_WITH_SELL_EXTRA_GAS = 300_000n;

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** "5h 12m" / "12m" / "under a minute" until a time, in seconds. */
function formatTimeLeft(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** resolveDraw's revert reasons, for players. */
function resolveErrorMessage(error: Error, drawId: bigint): string {
  const msg = error.message;
  if (msg.includes("DrawNotReady")) return `Draw #${drawId} just closed. Try again in a few seconds.`;
  if (msg.includes("DrawAlreadyResolved")) return `Draw #${drawId}'s winner has already been picked.`;
  if (msg.includes("DrawNotClosed")) return `Draw #${drawId} hasn't closed yet.`;
  if (msg.includes("MintPaused")) return "Prize ships can't be minted right now. Try again later.";
  if (msg.includes("NoParticipants")) return `Draw #${drawId} has no entries.`;
  return msg || "Failed to pick the winner";
}

/** Seconds since the epoch, updated every 30 s. */
function useNowSeconds(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/**
 * A won prize ship that arrived unconstructed (the random 4-star fallback):
 * it has to be built within a few hours of the draw, so it's offered here.
 * One past the window needs support to re-arm it (useExpiredShipSerials).
 */
function PrizeShipsCard({
  ships,
  drawIdByShipId,
  onConstructed,
}: {
  ships: Ship[];
  drawIdByShipId: Map<string, bigint>;
  onConstructed: () => Promise<void>;
}) {
  const { expiredSerials } = useExpiredShipSerials(ships);
  const buildable = ships.filter((s) => !expiredSerials.has(s.traits.serialNumber.toString()));
  const expiredCount = ships.length - buildable.length;
  const draws = [...new Set(ships.map((s) => drawIdByShipId.get(s.id.toString())).filter((d) => d != null))]
    .map((d) => `#${d!.toString()}`)
    .join(", ");
  const plural = ships.length !== 1;
  return (
    <div className="mb-5 p-4 border-2 border-phosphor-green">
      <div className="text-xs font-mono uppercase tracking-wide text-text-secondary mb-1">
        You won draw {draws}
      </div>
      <div className="text-lg font-mono font-bold text-phosphor-green mb-2">
        {plural ? "Prize ships" : "Prize ship"} to construct
      </div>
      <div className="mb-3 flex gap-2">
        {ships.map((ship) => (
          <ShipImage key={ship.id.toString()} ship={ship} className="h-20 w-20" showLoadingState={false} />
        ))}
      </div>
      <p className="mb-3 text-xs font-mono leading-relaxed text-text-secondary">
        Construct {plural ? "them" : "it"} within a few hours of the draw. After that,{" "}
        {plural ? "they" : "it"} can&apos;t be built without help from support.
      </p>
      {expiredCount > 0 && (
        <p className="mb-3 text-xs font-mono leading-snug text-amber">
          {expiredCount === 1 ? "1 prize ship" : `${expiredCount} prize ships`} missed the construction window.
          Contact support to have {expiredCount === 1 ? "it" : "them"} made buildable again.
        </p>
      )}
      {buildable.length > 0 && (
        <ShipActionButton
          action="constructShips"
          shipIds={buildable.map((s) => s.id)}
          ships={buildable}
          className="w-full px-4 py-3 rounded-none border-2 border-phosphor-green text-phosphor-green hover:bg-phosphor-green/10 font-mono tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onSuccess={async () => {
            toast.success(buildable.length === 1 ? "Prize ship constructed" : "Prize ships constructed");
            await onConstructed();
          }}
        >
          {buildable.length === 1 ? "[CONSTRUCT PRIZE SHIP]" : `[CONSTRUCT ${buildable.length} PRIZE SHIPS]`}
        </ShipActionButton>
      )}
    </div>
  );
}

function ConditionRow({ met, children }: { met: boolean | undefined; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-2">
      <span
        aria-hidden
        className={met ? "text-phosphor-green" : "text-text-muted"}
      >
        {met == null ? "·" : met ? "✓" : "○"}
      </span>
      <span className={met ? "text-text-secondary" : "text-text-primary"}>{children}</span>
    </li>
  );
}

/**
 * UTCLotteryHook status/results panel (docs/update/Frontend_Updates_2026-09-17.md §4).
 * Entries come from selling UTC on the hooked Uniswap v4 pool directly, not
 * from this app — the sell flow below goes directly through Universal Router + Permit2 (never
 * Uniswap's own hosted swap UI or any other third-party interface, which has no way to pass this
 * hook's custom hookData convention and would silently earn zero entries — see
 * docs/eth-global-remote/uniswap-lottery-selfie-check-frontend-integration.md §4.3). A resolved
 * draw does not always have a winner (DrawResolvedNoWinner) — that state is shown explicitly,
 * never inferred from an absent balance change.
 */
export function UtcLotteryPanel() {
  const { address } = useAccount();
  const {
    isDeployed,
    lotteryHookAddress,
    maxWeightPerEntryWei,
    maxWinProbabilityDenominator,
    minTotalWeightWei,
    minParticipants,
    drawInterval,
    lastDrawTime,
    currentDrawId,
    totalWeightInDraw,
    yourWeightInDraw,
    hasParticipated,
    hasEnoughEntrants,
    pendingDrawId,
    yourWeightInPendingDraw,
    autoResolveMinGas,
    recentSells,
    recentDrawResults,
    refetchDrawState,
  } = useUtcLotteryHook();

  const {
    isSupported: isSwapSupported,
    utcAddress,
    utcBalance,
    erc20AllowanceToPermit2,
    permit2AmountWei,
    permit2Expiration,
    refetchAll: refetchSellSwapState,
  } = useUtcSellSwap();

  const [sellAmount, setSellAmount] = useState("");
  const amountInWei = useMemo(() => {
    if (!sellAmount.trim()) return undefined;
    try {
      return parseEther(sellAmount);
    } catch {
      return undefined;
    }
  }, [sellAmount]);

  const { amountOutWei: quotedAmountOutWei, isLoading: isQuoting } = useUtcSellQuote(amountInWei);
  const amountOutMinimumWei =
    quotedAmountOutWei != null ? (quotedAmountOutWei * (10_000n - SLIPPAGE_BPS)) / 10_000n : undefined;

  const insufficientBalance =
    amountInWei != null && utcBalance != null && amountInWei > utcBalance;
  const needsErc20Approval =
    amountInWei != null && (erc20AllowanceToPermit2 == null || erc20AllowanceToPermit2 < amountInWei);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const needsPermit2Approval =
    !needsErc20Approval &&
    amountInWei != null &&
    (permit2AmountWei < amountInWei || permit2Expiration <= nowSeconds);
  const readyToSwap =
    !needsErc20Approval && !needsPermit2Approval && amountInWei != null && amountOutMinimumWei != null;

  const swapEncoding = useMemo(() => {
    if (!readyToSwap || !address || amountInWei == null || amountOutMinimumWei == null) return null;
    return encodeUtcSellSwap({ trader: address, amountInWei, amountOutMinimumWei });
  }, [readyToSwap, address, amountInWei, amountOutMinimumWei]);

  const swapDeadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

  // The open draw closes with the first qualifying sell once all of these
  // hold (UTCLotteryHook._maybeCloseDraw).
  const now = useNowSeconds();
  const closesAfter =
    lastDrawTime != null && drawInterval != null ? Number(lastDrawTime + drawInterval) : undefined;
  const intervalMet = closesAfter != null ? now >= closesAfter : undefined;
  const weightMet =
    totalWeightInDraw != null && minTotalWeightWei != null
      ? totalWeightInDraw > 0n && totalWeightInDraw >= minTotalWeightWei
      : undefined;
  const readyToClose = intervalMet === true && hasEnoughEntrants === true && weightMet === true;

  // Wins from the last few hours whose prize arrived unconstructed. A live
  // win refetches them.
  const liveWinKey = useMemo(
    () =>
      recentDrawResults
        .filter((r) => !!address && r.winner?.toLowerCase() === address.toLowerCase())
        .map((r) => r.drawId.toString())
        .join(","),
    [recentDrawResults, address],
  );
  const { data: prizes } = useLotteryPrizes(address, isDeployed, liveWinKey);
  const { shipIds: ownedShipIds, ships: ownedShips, refetch: refetchOwnedShips } = useOwnedShips();
  const drawIdByShipId = useMemo(() => {
    const map = new Map<string, bigint>();
    prizes?.forEach((prize) => prize.shipIds.forEach((id) => map.set(id.toString(), prize.drawId)));
    return map;
  }, [prizes]);
  const prizeShipsToBuild = useMemo(
    () => ownedShips.filter((s) => drawIdByShipId.has(s.id.toString()) && !s.shipData.constructed),
    [ownedShips, drawIdByShipId],
  );
  // A prize minted since the fleet last loaded isn't in it yet: reload once.
  const refetchedForPrizesRef = useRef("");
  useEffect(() => {
    const owned = new Set(ownedShipIds.map((id) => id.toString()));
    const missing = [...drawIdByShipId.keys()].filter((id) => !owned.has(id));
    const key = missing.join(",");
    if (missing.length === 0 || refetchedForPrizesRef.current === key) return;
    refetchedForPrizesRef.current = key;
    void refetchOwnedShips();
  }, [drawIdByShipId, ownedShipIds, refetchOwnedShips]);

  const sellGas =
    pendingDrawId != null && autoResolveMinGas != null
      ? autoResolveMinGas + RESOLVE_WITH_SELL_EXTRA_GAS
      : undefined;

  // resolveDraw past the result window moves the draw to a new block
  // instead of resolving it; that needs a second call.
  const handleResolveReceipt = (receipt: TransactionReceipt, drawId: bigint) => {
    const logs = parseEventLogs({ abi: LOTTERY_HOOK_ABI, logs: receipt.logs });
    const names = new Set(logs.map((log) => (log as { eventName?: string }).eventName));
    if (names.has("DrawResolved")) toast.success(`Draw #${drawId}'s winner is picked.`);
    else if (names.has("DrawResolvedNoWinner")) toast.success(`Draw #${drawId} had no winner.`);
    else if (names.has("DrawRetargeted")) toast(`Draw #${drawId} was moved to a new block. Pick again in a few seconds.`);
  };

  return (
    <div className="w-full max-w-xl">

        <div className="mb-5 p-4 bg-amber/10 border border-amber/40 rounded-none">
          <p className="text-amber/85 text-xs font-mono leading-relaxed">
            Selling UTC on the hooked pool earns entry-weight into the current
            draw, capped per address. A draw can end with no winner if real
            participation is thin. That&apos;s expected, not a bug. Prize ships
            go straight to the winner&apos;s fleet.
          </p>
        </div>

        {!isDeployed ? (
          <p className="text-center text-warning-red font-mono py-6">
            UTC Lottery Hook is not deployed on this network.
          </p>
        ) : !address ? (
          <p className="text-center text-text-muted font-mono py-6">
            Connect your wallet to view lottery status.
          </p>
        ) : (
          <>
            {prizeShipsToBuild.length > 0 && (
              <PrizeShipsCard
                ships={prizeShipsToBuild}
                drawIdByShipId={drawIdByShipId}
                onConstructed={async () => {
                  await refetchOwnedShips();
                }}
              />
            )}

            <div className="mb-5 p-4 border border-amber/25">
              <div className="flex justify-between text-xs font-mono uppercase tracking-wide text-text-secondary mb-1">
                <span>Current draw</span>
                <span>Status</span>
              </div>
              <div className="flex justify-between text-lg font-mono font-bold text-amber">
                <span>{currentDrawId != null ? `#${currentDrawId.toString()}` : "…"}</span>
                <span>{readyToClose ? "Closing" : "Open"}</span>
              </div>
              <p className="mt-3 text-xs font-mono text-text-secondary">
                {readyToClose
                  ? "Closes with the next qualifying sell."
                  : "Closes with the first qualifying sell once:"}
              </p>
              {!readyToClose && (
                <ul className="mt-1 space-y-0.5 text-xs font-mono">
                  <ConditionRow met={intervalMet}>
                    {intervalMet || closesAfter == null
                      ? "The draw has run its full time"
                      : `The draw has run its full time (${formatTimeLeft(closesAfter - now)} left)`}
                  </ConditionRow>
                  <ConditionRow met={hasEnoughEntrants}>
                    {minParticipants != null
                      ? `At least ${minParticipants.toString()} players have entered`
                      : "Enough players have entered"}
                  </ConditionRow>
                  <ConditionRow met={weightMet}>
                    {minTotalWeightWei != null && minTotalWeightWei > 0n
                      ? `Total weight reaches ${formatEther(minTotalWeightWei)} (now ${totalWeightInDraw != null ? formatEther(totalWeightInDraw) : "0"})`
                      : "Someone has entered"}
                  </ConditionRow>
                </ul>
              )}
            </div>

            {pendingDrawId != null && (
              <div className="mb-5 p-4 border border-phosphor-green/40">
                <div className="flex justify-between text-xs font-mono uppercase tracking-wide text-text-secondary mb-1">
                  <span>Closed draw</span>
                  <span>Status</span>
                </div>
                <div className="flex justify-between text-lg font-mono font-bold text-phosphor-green">
                  <span>#{pendingDrawId.toString()}</span>
                  <span>Picking winner</span>
                </div>
                <p className="mt-3 mb-3 text-xs font-mono leading-relaxed text-text-secondary">
                  Entries are locked. The winner is picked with the next trade on the pool, or you
                  can pick it now.
                  {yourWeightInPendingDraw != null && yourWeightInPendingDraw > 0n && (
                    <> You&apos;re in with {formatEther(yourWeightInPendingDraw)} weight.</>
                  )}
                </p>
                <TransactionButton
                  transactionId={`resolve-utc-lottery-draw-${pendingDrawId}-${address}`}
                  contractAddress={lotteryHookAddress}
                  abi={LOTTERY_HOOK_ABI}
                  functionName="resolveDraw"
                  args={[pendingDrawId]}
                  className="w-full px-4 py-3 rounded-none border-2 border-phosphor-green text-phosphor-green hover:bg-phosphor-green/10 font-mono tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  loadingText="[PICKING...]"
                  errorText="[ERROR PICKING]"
                  onReceipt={(receipt) => handleResolveReceipt(receipt, pendingDrawId)}
                  onSuccess={async () => {
                    await refetchDrawState();
                  }}
                  onError={(error) => {
                    console.error("Failed to resolve draw:", error);
                    if (error.message.includes("DrawAlreadyResolved")) refetchDrawState();
                    toast.error(resolveErrorMessage(error, pendingDrawId));
                  }}
                >
                  [PICK WINNER #{pendingDrawId.toString()}]
                </TransactionButton>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-[12px] mb-5">
              <div className="border border-solid border-amber/30 bg-black/20 px-2 py-1.5">
                <div className="opacity-75 text-[10px] uppercase tracking-wide text-amber">
                  Your weight {hasParticipated ? "(entered)" : ""}
                </div>
                <div className="font-bold text-amber font-mono">
                  {yourWeightInDraw != null ? formatEther(yourWeightInDraw) : "0"}
                </div>
              </div>
              <div className="border border-solid border-amber/30 bg-black/20 px-2 py-1.5">
                <div className="opacity-75 text-[10px] uppercase tracking-wide text-amber">
                  Total weight
                </div>
                <div className="font-bold text-amber font-mono">
                  {totalWeightInDraw != null ? formatEther(totalWeightInDraw) : "0"}
                </div>
              </div>
              <div className="border border-solid border-amber/30 bg-black/20 px-2 py-1.5">
                <div className="opacity-75 text-[10px] uppercase tracking-wide text-amber">
                  Cap / entry
                </div>
                <div className="font-bold text-amber font-mono">
                  {maxWeightPerEntryWei != null ? formatEther(maxWeightPerEntryWei) : "…"} ETH
                </div>
              </div>
              <div className="border border-solid border-amber/30 bg-black/20 px-2 py-1.5">
                <div className="opacity-75 text-[10px] uppercase tracking-wide text-amber">
                  Best odds
                </div>
                <div className="font-bold text-amber font-mono">
                  {maxWinProbabilityDenominator != null
                    ? `1 in ${maxWinProbabilityDenominator.toString()}`
                    : "…"}
                </div>
              </div>
            </div>

            <div className="mb-5 p-4 border border-amber/25">
              <h3 className="text-xs uppercase tracking-widest text-amber/70 mb-2">Sell UTC</h3>
              {!isSwapSupported ? (
                <p className="text-xs text-text-muted">Not available on this network.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={sellAmount}
                      onChange={(e) => setSellAmount(e.target.value)}
                      placeholder="0.0"
                      className="flex-1 px-3 py-2 bg-near-black border text-amber font-mono focus:outline-none focus:ring-2 focus:ring-amber"
                      style={{ borderRadius: 0, borderColor: "var(--color-amber)" }}
                    />
                    <span className="text-xs text-text-muted font-mono">UTC</span>
                  </div>
                  <div className="text-[11px] text-text-muted font-mono mb-3">
                    Balance: {formatBalance(utcBalance != null ? Number(formatEther(utcBalance)) : 0, UTC_DISPLAY_DECIMALS)} UTC
                    {amountInWei != null && (
                      <>
                        {" · "}
                        {isQuoting
                          ? "quoting…"
                          : quotedAmountOutWei != null
                            ? `~${formatEther(quotedAmountOutWei)} ETH (2% slippage)`
                            : "no quote"}
                      </>
                    )}
                  </div>

                  {needsErc20Approval ? (
                    <TransactionButton
                      transactionId={`approve-utc-permit2-${address}`}
                      contractAddress={utcAddress}
                      abi={UTC_ABI}
                      functionName="approve"
                      args={[PERMIT2_ADDRESS, MAX_UINT256]}
                      className="w-full px-4 py-3 rounded-none border-2 border-amber text-amber hover:bg-amber/10 font-mono tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!amountInWei || insufficientBalance}
                      loadingText="[APPROVING...]"
                      errorText="[ERROR APPROVING]"
                      onSuccess={async () => {
                        await refetchSellSwapState();
                        toast.success("UTC approved for Permit2");
                      }}
                      onError={(error) => {
                        console.error("Failed to approve UTC:", error);
                        toast.error("Failed to approve UTC");
                      }}
                      validateBeforeTransaction={() => {
                        if (!amountInWei) return "Enter an amount";
                        if (insufficientBalance) return "Insufficient UTC balance";
                        return true;
                      }}
                    >
                      [APPROVE UTC]
                    </TransactionButton>
                  ) : needsPermit2Approval ? (
                    <TransactionButton
                      transactionId={`approve-permit2-router-${address}`}
                      contractAddress={PERMIT2_ADDRESS}
                      abi={PERMIT2_ABI}
                      functionName="approve"
                      args={[
                        utcAddress,
                        UNIVERSAL_ROUTER_ADDRESS,
                        MAX_UINT160,
                        BigInt(Math.floor(Date.now() / 1000) + PERMIT2_APPROVAL_WINDOW_SECONDS),
                      ]}
                      className="w-full px-4 py-3 rounded-none border-2 border-amber text-amber hover:bg-amber/10 font-mono tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      loadingText="[APPROVING...]"
                      errorText="[ERROR APPROVING]"
                      onSuccess={async () => {
                        await refetchSellSwapState();
                        toast.success("Router approved");
                      }}
                      onError={(error) => {
                        console.error("Failed to approve router:", error);
                        toast.error("Failed to approve router");
                      }}
                    >
                      [APPROVE ROUTER]
                    </TransactionButton>
                  ) : (
                    <TransactionButton
                      transactionId={`sell-utc-${address}-${sellAmount}`}
                      contractAddress={UNIVERSAL_ROUTER_ADDRESS}
                      abi={UNIVERSAL_ROUTER_ABI}
                      functionName="execute"
                      gas={sellGas}
                      args={
                        swapEncoding
                          ? [swapEncoding.commands, swapEncoding.inputs, swapDeadline]
                          : []
                      }
                      className="w-full px-4 py-3 rounded-none border-2 border-phosphor-green text-phosphor-green hover:bg-phosphor-green/10 font-mono tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!readyToSwap || insufficientBalance}
                      loadingText="[SELLING...]"
                      errorText="[ERROR SELLING]"
                      onSuccess={async () => {
                        setSellAmount("");
                        await refetchSellSwapState();
                        await refetchDrawState();
                        toast.success("UTC sold — check recent sells below for your entry.");
                      }}
                      onError={(error) => {
                        console.error("Failed to sell UTC:", error);
                        toast.error(error instanceof Error ? error.message : "Failed to sell UTC");
                      }}
                      validateBeforeTransaction={() => {
                        if (!readyToSwap) return "Enter an amount";
                        if (insufficientBalance) return "Insufficient UTC balance";
                        return true;
                      }}
                    >
                      [SELL UTC]
                    </TransactionButton>
                  )}
                  {pendingDrawId != null && (
                    <p className="mt-2 text-[11px] text-text-muted font-mono">
                      Your sell also picks draw #{pendingDrawId.toString()}&apos;s winner.
                    </p>
                  )}
                </>
              )}
            </div>

            {recentSells.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-widest text-amber/70 mb-2">
                  Your recent sells
                </h3>
                <div className="space-y-1">
                  {recentSells.map((sell, i) => (
                    <div
                      key={`${sell.drawId}-${sell.blockNumber}-${i}`}
                      className="flex justify-between text-[11px] font-mono text-text-secondary border border-gunmetal/50 px-2 py-1"
                    >
                      <span>Draw #{sell.drawId.toString()}</span>
                      <span>Sold {formatEther(sell.ethProceeds)} ETH</span>
                      <span>+{formatEther(sell.playerWeightInDraw)} weight</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentDrawResults.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs uppercase tracking-widest text-amber/70 mb-2">
                  Recent draws
                </h3>
                <div className="space-y-1">
                  {recentDrawResults.map((result, i) => (
                    <div
                      key={`${result.drawId}-${result.blockNumber}-${i}`}
                      className="flex justify-between text-[11px] font-mono text-text-secondary border border-gunmetal/50 px-2 py-1"
                    >
                      <span>Draw #{result.drawId.toString()}</span>
                      <span>
                        {result.noWinner
                          ? "No winner"
                          : result.winner
                            ? result.winner.toLowerCase() === address.toLowerCase()
                              ? "You won!"
                              : `Winner: ${shortAddr(result.winner)}`
                            : "Resolved"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}
