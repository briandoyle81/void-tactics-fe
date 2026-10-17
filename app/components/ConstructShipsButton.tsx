"use client";

import React from "react";
import { toast } from "react-hot-toast";
import { ShipActionButton } from "./ShipActionButton";
import { useExpiredShipSerials } from "../hooks/useRandomManager";
import { STALE_COST_SYNC_BATCH_CAP } from "../utils/navyFilters";
import type { Ship } from "../types/types";

// Constructs the player's unconstructed ships: all of them in one
// constructAllMyShips call, or the first STALE_COST_SYNC_BATCH_CAP via
// constructShips when there are more than that. Shared by Manage Navy and the
// roguelike roster picker.
//
// A ship whose construction window has passed (RandomManager.isExpired; see
// useRandomManager.ts) can't be built until an admin re-targets it, and one
// in a batch reverts the whole batch. Those are left out, and a note says
// how many are waiting.
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
  const { expiredSerials } = useExpiredShipSerials(unconstructedShips);
  const buildable = React.useMemo(
    () => unconstructedShips.filter((ship) => !expiredSerials.has(ship.traits.serialNumber.toString())),
    [unconstructedShips, expiredSerials],
  );
  const expiredCount = unconstructedShips.length - buildable.length;

  const expiredNote =
    expiredCount > 0 ? (
      <p className="max-w-xs font-mono text-xs leading-snug text-amber">
        {expiredCount === 1 ? "1 ship" : `${expiredCount} ships`} missed the construction window. Contact
        support to have {expiredCount === 1 ? "it" : "them"} made buildable again.
      </p>
    ) : null;

  // constructAllMyShips would include the expired ships, so with any expired
  // the buildable ones go by id instead.
  const constructAll = expiredCount === 0 && buildable.length <= STALE_COST_SYNC_BATCH_CAP;
  const batch = buildable.slice(0, STALE_COST_SYNC_BATCH_CAP);

  if (expiredCount > 0 && buildable.length === 0) return expiredNote;

  const button = constructAll ? (
    <ShipActionButton
      action="constructAll"
      ships={buildable}
      className={className}
      disabled={buildable.length === 0}
      onSuccess={async () => {
        toast.success("Ships constructed successfully!");
        await onConstructed();
      }}
    >
      [CONSTRUCT ALL SHIPS]
    </ShipActionButton>
  ) : (
    <ShipActionButton
      action="constructShips"
      shipIds={batch.map((ship) => ship.id)}
      ships={batch}
      className={className}
      onSuccess={async () => {
        toast.success(`${batch.length} ${batch.length === 1 ? "ship" : "ships"} constructed!`);
        await onConstructed();
      }}
    >
      {`[CONSTRUCT ${batch.length} ${batch.length === 1 ? "SHIP" : "SHIPS"}]`}
    </ShipActionButton>
  );

  return expiredNote ? (
    <>
      {button}
      {expiredNote}
    </>
  ) : (
    button
  );
}
