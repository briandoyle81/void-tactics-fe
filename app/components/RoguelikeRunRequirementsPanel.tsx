"use client";

import React from "react";
import {
  MIN_CONSTRUCTED_SHIPS_FOR_RUN,
  MIN_ROSTER_COST_FRACTION,
  type RoguelikeRunRequirements,
} from "../utils/roguelikeRunRequirements";

// Requirement checklist above the roguelike roster picker, shared by the web3
// and web2 run-start screens. `constructButton` is the mode-specific
// construct action, shown while the player has unconstructed ships.
export function RoguelikeRunRequirementsPanel({
  requirements,
  rosterCost,
  costLimit,
  constructButton,
}: {
  requirements: RoguelikeRunRequirements;
  rosterCost: number;
  costLimit: number;
  constructButton?: React.ReactNode;
}) {
  const { constructedCount, hasEnoughConstructed, minRosterCost, meetsMinRosterCost } = requirements;
  return (
    <div className="flex flex-col gap-3 border border-gunmetal bg-near-black/40 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
      <ul className="flex flex-col gap-1">
        <li className={hasEnoughConstructed ? "text-phosphor-green" : "text-amber"}>
          {hasEnoughConstructed ? "[OK]" : "[ ]"} Constructed ships: {constructedCount} / {MIN_CONSTRUCTED_SHIPS_FOR_RUN}
        </li>
        {minRosterCost > 0 && (
          <li className={meetsMinRosterCost ? "text-phosphor-green" : "text-amber"}>
            {meetsMinRosterCost ? "[OK]" : "[ ]"} Roster cost at least {minRosterCost} ({Math.round(MIN_ROSTER_COST_FRACTION * 100)}% of {costLimit}):{" "}
            {rosterCost}
          </li>
        )}
      </ul>
      {constructButton && <div className="shrink-0">{constructButton}</div>}
    </div>
  );
}
