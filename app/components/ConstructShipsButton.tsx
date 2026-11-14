"use client";

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import type { Ship } from "../types/types";
import { useNearSession } from "../near/session";
import { GAS_HEAVY } from "../near/config";
import { isContractError, shortErrorMessage } from "../near/errors";
import { openStorageTopUp } from "../near/onboarding/NearOnboardingHost";

/** How long new ships may take to build themselves before the manual build is offered. */
const AUTO_BUILD_GRACE_MS = 20_000;

/**
 * On NEAR new ships build themselves a block or two after minting
 * (self-callback randomness), so this mostly shows "building". A ship can
 * stay unbuilt if the player's storage ran out at mint; after a short wait
 * this offers to build those ships (construct_ships, up to 50 per call;
 * the session key signs, no prompt). Renders nothing when every ship is built.
 */
const CONSTRUCT_BATCH = 50;

export function ConstructShipsButton({
  unconstructedShips,
  className = "",
  onConstructed,
}: {
  unconstructedShips: Ship[];
  className?: string;
  onConstructed?: () => void | Promise<unknown>;
}) {
  const { send } = useNearSession();
  const [graceOver, setGraceOver] = useState(false);
  const [building, setBuilding] = useState(false);
  const count = unconstructedShips.length;

  useEffect(() => {
    setGraceOver(false);
    if (count === 0) return;
    const t = setTimeout(() => setGraceOver(true), AUTO_BUILD_GRACE_MS);
    return () => clearTimeout(t);
  }, [count]);

  if (count === 0) return null;

  const buildNow = async () => {
    setBuilding(true);
    try {
      // construct_ships builds up to 50 per call.
      for (let i = 0; i < count; i += CONSTRUCT_BATCH) {
        const ids = unconstructedShips.slice(i, i + CONSTRUCT_BATCH).map((ship) => ship.id.toString());
        await send({ method: "construct_ships", args: { ship_ids: ids }, gas: GAS_HEAVY });
      }
      toast.success(`Built ${count} ship${count === 1 ? "" : "s"}.`);
      await onConstructed?.();
    } catch (e) {
      if (isContractError(e, "InsufficientStorageBalance")) openStorageTopUp();
      else toast.error(`Couldn't build ships: ${shortErrorMessage(e)}`);
      await onConstructed?.();
    } finally {
      setBuilding(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void buildNow()}
      disabled={!graceOver || building}
      className={className}
      style={{ borderRadius: 0 }}
    >
      {building
        ? "[BUILDING…]"
        : graceOver
          ? `[BUILD ${count} SHIP${count === 1 ? "" : "S"}]`
          : `[BUILDING ${count} SHIP${count === 1 ? "" : "S"}…]`}
    </button>
  );
}
