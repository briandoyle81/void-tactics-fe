"use client";

import { FreeShipsClaimAction, useFreeShipsClaim } from "./FreeShipsClaimAction";

const ACTION_CLASS =
  "w-full border-2 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Command Deck claim card: a meter filling toward the next free batch, and
 * the claim action when it's ready (gated on Selfie Check for web3).
 */
export function FreeShipsCard() {
  const { status, refetch } = useFreeShipsClaim();
  const ready = status.isEligible && !status.isLoading && !status.hasError;

  return (
    <div
      className="grid gap-2 border-2 border-solid p-3"
      style={{ borderColor: "var(--color-phosphor-green)", backgroundColor: "rgba(0,0,0,0.35)" }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-lg font-bold uppercase tracking-wider text-phosphor-green"
          style={{ fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" }}
        >
          Free ships
        </span>
        <span className="font-mono text-xs text-text-secondary">
          {status.isLoading ? "…" : ready ? "Ready" : (status.nextClaimInFormatted ?? "")}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden"
        style={{ backgroundColor: "var(--color-steel)" }}
        role="progressbar"
        aria-label="Next free ship batch"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(status.cooldownProgress * 100)}
      >
        <div
          className="h-full bg-phosphor-green transition-[width] duration-500"
          style={{ width: `${status.cooldownProgress * 100}%` }}
        />
      </div>
      <FreeShipsClaimAction
        status={status}
        refetch={refetch}
        className={`${ACTION_CLASS} border-phosphor-green text-phosphor-green hover:bg-phosphor-green/10`}
        verifyClassName={`${ACTION_CLASS} border-amber text-amber hover:bg-amber/10`}
        analyticsSurface="command_deck"
      />
    </div>
  );
}
