"use client";

import React from "react";
import { useOwnedShips } from "../hooks/useOwnedShips";
import { ConstructShipsButton } from "./ConstructShipsButton";
import type { Ship } from "../types/types";

/**
 * On a won single-player mission's result screen: a ship the win granted
 * (ShipGrantWinEffect) arrives unconstructed, minted at game end, and has to
 * be built within a few hours (docs/frontend-handoff-2026-10-17.md §2). If
 * the player has any ships waiting to be built, offer it here. Web3 only;
 * renders nothing when there's nothing to build.
 */
export function ConstructRewardShips() {
  const { ships, refetch } = useOwnedShips();
  const unconstructed = React.useMemo(
    () => ships.filter((ship: Ship) => !ship.shipData.constructed),
    [ships],
  );
  if (unconstructed.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border border-phosphor-green/40 p-3">
      <p className="font-mono text-xs leading-snug text-text-secondary">
        {unconstructed.length === 1 ? "A new ship is" : `${unconstructed.length} new ships are`} waiting in your
        fleet. Construct {unconstructed.length === 1 ? "it" : "them"} now to see the stats.
      </p>
      <ConstructShipsButton
        unconstructedShips={unconstructed}
        className="w-full border-2 border-phosphor-green px-4 py-2 font-mono text-sm font-bold uppercase tracking-wider text-phosphor-green hover:bg-phosphor-green/10"
        onConstructed={async () => {
          await refetch();
        }}
      />
    </div>
  );
}
