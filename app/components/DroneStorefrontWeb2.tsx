"use client";

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { useDroneStorefrontWeb2 } from "../hooks/useDroneStorefrontWeb2";
import { formatDec } from "../utils/formatDec";

// Web2-mode counterpart to `DroneStorefront.tsx` — same tier ladder/copy,
// but no wallet/approval step: DCC is a plain per-user balance
// (app/lib/droneStorefrontTiers.ts), spent via a single server-side call
// instead of approve+turnInCores.
const DroneStorefrontWeb2: React.FC = () => {
  const { currentTier, nextTier, nextTierCost, maxTierReached, decBalance, isLoading, turnIn } =
    useDroneStorefrontWeb2();
  const [isTurningIn, setIsTurningIn] = useState(false);

  const insufficientBalance = nextTierCost !== null && decBalance < nextTierCost;

  const handleTurnIn = async () => {
    setIsTurningIn(true);
    try {
      await turnIn();
      toast.success(`Tier ${nextTier} unlocked!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to turn in DCC");
    } finally {
      setIsTurningIn(false);
    }
  };

  return (
    <div className="w-full max-w-xl">

        <div className="mb-5 p-4 bg-cyan/10 border border-cyan/40 rounded-none">
          <div className="flex justify-between items-center mb-2">
            <p className="text-cyan/80 text-sm font-mono">Drone Computation Cores</p>
            <p className="text-cyan text-sm font-mono font-bold">{formatDec(decBalance)} DCC</p>
          </div>
          <p className="text-cyan/85 text-xs font-mono leading-relaxed">
            DCC comes from destroying AI ships. Turn it in here to raise how
            many free ships each 28-day claim gives you. The bonus is
            permanent.
          </p>
        </div>

        {isLoading ? (
          <p className="text-center text-text-muted font-mono py-6">Loading your tier…</p>
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

            {maxTierReached || nextTierCost === null ? (
              <p className="text-center text-phosphor-green font-mono py-6">
                You&apos;re at the top tier.
              </p>
            ) : (
              <div className="border border-cyan/40 p-4">
                <div className="flex justify-between text-sm font-mono text-text-secondary mb-3">
                  <span>Next tier ({nextTier})</span>
                  <span>Bonus +{nextTier} ships / claim</span>
                </div>
                <div className="grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-2 mb-4">
                  <div className="border border-solid border-cyan/30 bg-black/20 px-2 py-1.5">
                    <div className="opacity-75 text-[10px] uppercase tracking-wide text-cyan">Cost</div>
                    <div className="font-bold text-cyan font-mono">{formatDec(nextTierCost, "up")} DCC</div>
                  </div>
                  <div className="border border-solid border-cyan/30 bg-black/20 px-2 py-1.5">
                    <div className="opacity-75 text-[10px] uppercase tracking-wide text-cyan">
                      Your balance
                    </div>
                    <div className="font-bold text-cyan font-mono">{formatDec(decBalance)} DCC</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleTurnIn()}
                  disabled={isTurningIn || insufficientBalance}
                  className="w-full px-4 py-3 rounded-none border-2 border-cyan text-cyan hover:text-cyan hover:bg-cyan/10 font-mono tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTurningIn
                    ? "[TURNING IN…]"
                    : insufficientBalance
                      ? "[INSUFFICIENT DCC]"
                      : `[TURN IN ${formatDec(nextTierCost, "up")} DCC]`}
                </button>
              </div>
            )}
          </>
        )}
    </div>
  );
};

export default DroneStorefrontWeb2;
