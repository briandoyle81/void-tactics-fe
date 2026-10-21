"use client";

import React from "react";
import { REWARD_SHIP_SNAPSHOT } from "../../config/rewardShips";
import { missionSeedExportHref } from "../../config/routes";
import { isSnapshotForContract, REWARD_SHIP_SNAPSHOT_FILE } from "../../utils/rewardShipSnapshot";

// Reward Ships' app copy status: whether the chain's grants still match the
// checked-in app/data/content/rewardShips.json (what players' screens show).
// The copy is saved with the mission seed files (Admin › Export mission seed
// files), so every file a deploy needs comes from one place. Web3 only.

export function RewardShipSnapshotPanel({
  address,
  staleCount,
  isLoading,
}: {
  /** This deploy's ShipGrantWinEffect. */
  address: string;
  /** Nodes whose chain grant differs from the app copy. */
  staleCount: number;
  isLoading: boolean;
}) {
  const forContract = isSnapshotForContract(REWARD_SHIP_SNAPSHOT, address);
  const status = isLoading
    ? "Comparing with the chain…"
    : !forContract
      ? "The app copy is from another deploy, so players' screens read the chain until you save a new one."
      : staleCount === 0
        ? "The app copy matches the chain."
        : `${staleCount} node${staleCount === 1 ? "" : "s"} changed since the app copy was saved. Players still see the old ship${staleCount === 1 ? "" : "s"} until you save and deploy.`;
  const needsSave = !isLoading && (!forContract || staleCount > 0);

  return (
    <div className={`mb-4 space-y-2 border p-3 font-mono ${needsSave ? "border-amber/60 bg-amber/5" : "border-gunmetal bg-black/30"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-text-secondary">App copy</div>
          <div className="text-[11px] text-text-muted">
            app/data/content/{REWARD_SHIP_SNAPSHOT_FILE} · saved {new Date(REWARD_SHIP_SNAPSHOT.savedAt).toLocaleString()}
          </div>
        </div>
        <a
          href={missionSeedExportHref()}
          className={`border-2 px-4 py-2 text-xs font-bold uppercase tracking-wider ${
            needsSave ? "border-amber text-amber hover:bg-amber/10" : "border-cyan text-cyan hover:bg-cyan/10"
          }`}
        >
          [SAVE WITH SEED FILES]
        </a>
      </div>
      <p className={`text-xs ${needsSave ? "text-amber" : "text-text-secondary"}`}>{status}</p>
      <p className="text-[11px] text-text-muted">
        The copy is saved with the mission seed files on the Admin tab, which also puts each reward ship in the
        deploy&apos;s seed so a redeploy sets them.
      </p>
    </div>
  );
}
