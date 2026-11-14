"use client";

import React from "react";
import { useChainAccount } from "@/app/near/useChainAccount";
import { formatDec } from "../utils/formatDec";
import { toast } from "react-hot-toast";
import { TransactionButton } from "./TransactionButton";
import { useDroneStorefront } from "../hooks/useDroneStorefront";

/**
 * The DCC storefront (turn_in_cores): turn in DCC for a permanent,
 * cumulative bonus to the number of free ships granted per 28-day claim.
 * A tier ladder: the next tier's exact cost comes from the contract. The
 * contract debits DCC directly, so there's no approval step.
 */
const DroneStorefront: React.FC = () => {
  const { address } = useChainAccount();
  const {
    isDeployed,
    currentTier,
    nextTier,
    nextTierCost,
    maxTierReached,
    isLoadingTier,
    isLoadingNextTierCost,
    decBalance,
    refetchAll,
  } = useDroneStorefront();

  const insufficientBalance =
    nextTierCost !== undefined &&
    decBalance !== undefined &&
    decBalance < nextTierCost;

  // DCC has 0 decimals: amounts are plain counts of cores.
  const nextTierCostFormatted =
    nextTierCost !== undefined ? formatDec(Number(nextTierCost), "up") : null;
  const decBalanceFormatted =
    decBalance !== undefined ? formatDec(Number(decBalance)) : "0";

  return (
    <div className="w-full max-w-xl">

        <div className="mb-5 p-4 bg-cyan/10 border border-cyan/40 rounded-none">
          <div className="flex justify-between items-center mb-2">
            <p className="text-cyan/80 text-sm font-mono">Drone Computation Cores</p>
            <p className="text-cyan text-sm font-mono font-bold">
              {decBalanceFormatted} DCC
            </p>
          </div>
          <p className="text-cyan/85 text-xs font-mono leading-relaxed">
            DCC comes from destroying AI ships. Turn it in here to raise how
            many free ships each 28-day claim gives you. The bonus is
            permanent.
          </p>
        </div>

        {!isDeployed ? (
          <p className="text-center text-warning-red font-mono py-6">
            DroneStorefront is not deployed on this network.
          </p>
        ) : !address ? (
          <p className="text-center text-text-muted font-mono py-6">
            Sign in to view your tier.
          </p>
        ) : isLoadingTier ? (
          <p className="text-center text-text-muted font-mono py-6">
            Loading your tier…
          </p>
        ) : (
          <>
            <div className="mb-5 p-4 border border-cyan/25">
              <div className="flex justify-between text-xs font-mono uppercase tracking-wide text-text-secondary mb-1">
                <span>Current tier</span>
                <span>Current bonus</span>
              </div>
              <div className="flex justify-between text-lg font-mono font-bold text-cyan">
                <span>{currentTier}</span>
                <span>+{currentTier} ships / claim</span>
              </div>
            </div>

            {maxTierReached ? (
              <p className="text-center text-phosphor-green font-mono py-6">
                You&apos;re at the top tier.
              </p>
            ) : isLoadingNextTierCost ? (
              <p className="text-center text-text-muted font-mono py-6">
                Loading next tier cost…
              </p>
            ) : nextTierCost === undefined ? (
              <p className="text-center text-warning-red font-mono py-6">
                Couldn&apos;t read the next tier cost.
              </p>
            ) : (
              <div className="border border-cyan/40 p-4">
                <div className="flex justify-between text-sm font-mono text-text-secondary mb-3">
                  <span>Next tier ({nextTier})</span>
                  <span>Bonus +{nextTier} ships / claim</span>
                </div>
                <div className="grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-2 mb-4">
                  <div className="border border-solid border-cyan/30 bg-black/20 px-2 py-1.5">
                    <div className="opacity-75 text-[10px] uppercase tracking-wide text-cyan">
                      Cost
                    </div>
                    <div className="font-bold text-cyan font-mono">
                      {nextTierCostFormatted} DCC
                    </div>
                  </div>
                  <div className="border border-solid border-cyan/30 bg-black/20 px-2 py-1.5">
                    <div className="opacity-75 text-[10px] uppercase tracking-wide text-cyan">
                      Your balance
                    </div>
                    <div className="font-bold text-cyan font-mono">
                      {decBalanceFormatted} DCC
                    </div>
                  </div>
                </div>

                {(
                  <TransactionButton
                    transactionId={`turn-in-dec-drone-storefront-${nextTier}-${address}`}
                    call={{ method: "turn_in_cores", args: { amount: nextTierCost.toString() } }}
                    className="w-full px-4 py-3 rounded-none border-2 border-cyan text-cyan hover:text-cyan hover:bg-cyan/10 font-mono tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={insufficientBalance}
                    loadingText="[TURNING IN…]"
                    errorText="[ERROR TURNING IN]"
                    onSuccess={async () => {
                      await refetchAll();
                      toast.success(`Tier ${nextTier} unlocked!`);
                    }}
                    onError={(error) => {
                      console.error("Failed to turn in DCC:", error);
                      toast.error("Failed to turn in DCC");
                    }}
                    validateBeforeTransaction={() => {
                      if (!address) return "Please sign in first";
                      if (insufficientBalance) return "Insufficient DCC balance";
                      return true;
                    }}
                  >
                    [TURN IN {nextTierCostFormatted} DCC]
                  </TransactionButton>
                )}
              </div>
            )}
          </>
        )}
    </div>
  );
};

export default DroneStorefront;
