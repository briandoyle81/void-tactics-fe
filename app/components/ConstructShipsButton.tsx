"use client";

import React from "react";
import { toast } from "react-hot-toast";
import { ShipActionButton } from "./ShipActionButton";
import { STALE_COST_SYNC_BATCH_CAP } from "../utils/navyFilters";
import type { Ship } from "../types/types";

// Constructs the player's unconstructed ships: all of them in one
// constructAllMyShips call, or the first STALE_COST_SYNC_BATCH_CAP via
// constructShips when there are more than that. Shared by Manage Navy and the
// roguelike roster picker.
export function ConstructShipsButton({
  unconstructedShips,
  className,
  onConstructed,
}: {
  unconstructedShips: Ship[];
  className: string;
  /** Runs after the success toast, e.g. to refetch ships. */
  onConstructed: () => void | Promise<void>;
}) {
  if (unconstructedShips.length > STALE_COST_SYNC_BATCH_CAP) {
    const batch = unconstructedShips.slice(0, STALE_COST_SYNC_BATCH_CAP);
    return (
      <ShipActionButton
        action="constructShips"
        shipIds={batch.map((ship) => ship.id)}
        ships={batch}
        className={className}
        onSuccess={async () => {
          toast.success(`${STALE_COST_SYNC_BATCH_CAP} ships construction started!`);
          await onConstructed();
        }}
      >
        [CONSTRUCT {STALE_COST_SYNC_BATCH_CAP} SHIPS]
      </ShipActionButton>
    );
  }
  return (
    <ShipActionButton
      action="constructAll"
      ships={unconstructedShips}
      className={className}
      disabled={unconstructedShips.length === 0}
      onSuccess={async () => {
        toast.success("Ships constructed successfully!");
        await onConstructed();
      }}
    >
      [CONSTRUCT ALL SHIPS]
    </ShipActionButton>
  );
}
