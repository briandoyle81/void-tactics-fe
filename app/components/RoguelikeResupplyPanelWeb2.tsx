"use client";

import React from "react";
import { toast } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { useOwnedShipsWeb2 } from "../hooks/useOwnedShipsWeb2";
import { useShipAttributesByIdsWeb2 } from "../hooks/useShipAttributesByIdsWeb2";
import { useFleetPlacementWeb2 } from "../hooks/useFleetPlacement";
import { useRoguelikeResupplyWeb2 } from "../hooks/useRoguelikeResupplyWeb2";
import type { RoguelikeRunWeb2, RoguelikeNodeWeb2 } from "../hooks/useRoguelikeWeb2";
import { DUPLICATE_SHIP_ID_TOAST, hasDuplicateShipIds } from "../utils/fleetShipIds";
import { buildFleetShipListItemsWeb2 } from "../utils/buildFleetShipListItemsWeb2";
import {
  navyFilterSecondaryOptionsWeb2,
  filterAndSortShipsWeb2,
} from "../utils/navyFiltersWeb2";
import { currentHullFromWeb2RosterHp, overlayHullPoints } from "../utils/rosterHull";
import {
  isResupplyCandidate,
  markRosterAvailableForSelect,
  resupplyCostLimit,
  rosterModifyDiff,
} from "../utils/resupplyFleet";
import { FLEET_HEADER_ACTION_CLASS } from "./FleetBriefing";
import { useSeedCombatRoster } from "./operations/RoguelikeCombatFleetModal";
import { RoguelikeFleetPicker } from "./operations/RoguelikeFleetPicker";

/**
 * Web2 counterpart to RoguelikeResupplyPanel: same hangar picker as run
 * start, live roster hull on the cards, and the node's new cost cap.
 */
export function RoguelikeResupplyPanelWeb2({
  run,
  node,
  onDone,
}: {
  run: RoguelikeRunWeb2;
  node: RoguelikeNodeWeb2;
  onDone: () => void;
}) {
  const { resupplyRepair, resupplyModifyRoster } = useRoguelikeResupplyWeb2();
  const { ships: ownedShips, isLoading: shipsLoading } = useOwnedShipsWeb2();
  const { data: repairCost } = useQuery({
    queryKey: ["roguelike", "repair-cost", "web2"],
    queryFn: () => apiFetch<{ repairCostPerHp: number }>("/api/roguelike/repair-cost"),
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRepairing, setIsRepairing] = React.useState(false);

  const rosterIdSet = React.useMemo(
    () => new Set(run.roster.map((r) => String(r.shipId))),
    [run.roster],
  );
  const requiredVariant = run.campaign.requiredVariant ?? 0;
  const costLimit = resupplyCostLimit(run.currentCostCap, node.costCapOverride ?? 0);
  const rosterVariant = run.roster[0]?.ship.traits.variant;
  const lockedVariant = requiredVariant > 0 ? requiredVariant : rosterVariant;

  const selectableShips = React.useMemo(() => {
    const byId = new Map(ownedShips.map((s) => [s.id, s]));
    run.roster.forEach((entry) => byId.set(entry.shipId, entry.ship));
    const candidates = Array.from(byId.values()).filter((s) =>
      isResupplyCandidate(
        {
          id: String(s.id),
          constructed: s.shipData.constructed,
          destroyed: s.shipData.timestampDestroyed > 0,
          inFleet: s.shipData.inFleet,
          variant: s.traits.variant,
        },
        rosterIdSet,
        requiredVariant,
      ),
    );
    return markRosterAvailableForSelect(candidates, rosterIdSet);
  }, [ownedShips, run.roster, rosterIdSet, requiredVariant]);

  const fleet = useFleetPlacementWeb2({
    ships: selectableShips,
    costLimit,
    costsVersion: null,
    isCreatorSide: true,
    requiredVariant: lockedVariant,
  });

  const rosterShips = React.useMemo(
    () => selectableShips.filter((s) => rosterIdSet.has(String(s.id))),
    [selectableShips, rosterIdSet],
  );
  useSeedCombatRoster(fleet, rosterShips);

  const shipIdsForAttributes = React.useMemo(() => fleet.ships.map((s) => s.id), [fleet.ships]);
  const { attributesByShipId, isLoading: attributesLoading } =
    useShipAttributesByIdsWeb2(shipIdsForAttributes);
  const damageByShipId = React.useMemo(() => {
    const damage = new Map<number, number>();
    run.roster.forEach((entry) => damage.set(entry.shipId, entry.hp));
    return damage;
  }, [run.roster]);
  const attributesWithRosterHull = React.useMemo(
    () =>
      overlayHullPoints(attributesByShipId, (id) => {
        if (!rosterIdSet.has(String(id))) return undefined;
        return currentHullFromWeb2RosterHp(
          damageByShipId.get(id) ?? 0,
          attributesByShipId.get(id)?.maxHullPoints ?? 0,
        );
      }),
    [attributesByShipId, damageByShipId, rosterIdSet],
  );

  // Roster ships carry their live run hull, so their cards show it and an HP bar.
  const buildItems = (pageShips: typeof fleet.ships) =>
    buildFleetShipListItemsWeb2({
      ships: pageShips,
      selectedShips: fleet.selectedShips,
      addShip: fleet.addShip,
      removeShip: fleet.removeShip,
      setDraggedShipId: fleet.setDraggedShipId,
      setDragOverPosition: fleet.setDragOverPosition,
      attributesMap: attributesWithRosterHull,
      attributesLoading,
      showInGameProperties: true,
      flipShips: false,
    });

  const isOverCap = fleet.totalCost > costLimit && costLimit > 0;
  const rosterValid = fleet.selectedShips.length > 0 && !isOverCap;

  const selectedRosterKeys = React.useMemo(
    () => new Set(fleet.selectedShips.filter((id) => rosterIdSet.has(String(id)))),
    [fleet.selectedShips, rosterIdSet],
  );
  const totalMissingHP = React.useMemo(() => {
    let missing = 0;
    attributesWithRosterHull.forEach((attrs, id) => {
      if (!selectedRosterKeys.has(id)) return;
      missing += Math.max(0, attrs.maxHullPoints - attrs.hullPoints);
    });
    return missing;
  }, [attributesWithRosterHull, selectedRosterKeys]);
  const repairKeys = React.useMemo(
    () =>
      Array.from(selectedRosterKeys).filter((id) => {
        const attrs = attributesWithRosterHull.get(id);
        return !!attrs && attrs.hullPoints < attrs.maxHullPoints;
      }),
    [selectedRosterKeys, attributesWithRosterHull],
  );

  const handleConfirm = async () => {
    if (fleet.selectedShips.length === 0) {
      toast.error("Select at least one ship for your roster");
      return;
    }
    if (hasDuplicateShipIds(fleet.selectedShips)) {
      toast.error(DUPLICATE_SHIP_ID_TOAST);
      return;
    }
    if (isOverCap) {
      toast.error(`Roster cost exceeds this run's ${costLimit} limit.`);
      return;
    }
    const { add, remove } = rosterModifyDiff(
      run.roster.map((entry) => entry.shipId),
      fleet.selectedShips,
    );
    if (add.length === 0 && remove.length === 0) {
      onDone();
      return;
    }
    setIsSaving(true);
    try {
      await resupplyModifyRoster(add, remove);
      toast.success("Roster updated");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update roster");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RoguelikeFleetPicker
      title="[SELECT YOUR FLEET]"
      headerAction={
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSaving || !rosterValid}
          className={FLEET_HEADER_ACTION_CLASS}
          style={{ borderRadius: 0 }}
        >
          {isSaving
            ? "[UPDATING...]"
            : `[CONFIRM FLEET (${costLimit > 0 ? `${fleet.totalCost}/${costLimit}` : fleet.totalCost})]`}
        </button>
      }
      extra={
        totalMissingHP > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border border-cyan/40 bg-cyan/10 p-3 text-xs">
            <span className="text-cyan">
              Repair cost: {totalMissingHP * (repairCost?.repairCostPerHp ?? 0)} UTC ({totalMissingHP} HP)
            </span>
            <button
              type="button"
              disabled={isRepairing}
              onClick={async () => {
                setIsRepairing(true);
                try {
                  const result = await resupplyRepair(repairKeys);
                  toast.success(`Repaired ${result.repaired.length} ship(s) for ${result.cost} UTC.`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to repair");
                } finally {
                  setIsRepairing(false);
                }
              }}
              className="border-2 border-phosphor-green px-4 py-2 text-xs font-bold uppercase tracking-wider text-phosphor-green transition-colors hover:bg-phosphor-green/10 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderRadius: 0 }}
            >
              {isRepairing ? "[REPAIRING...]" : `[REPAIR ${totalMissingHP} HP]`}
            </button>
          </div>
        ) : null
      }
      ships={fleet.ships}
      lockedVariant={fleet.lockedVariant}
      isLoading={shipsLoading}
      isEmpty={selectableShips.length === 0}
      filterAndSort={filterAndSortShipsWeb2}
      secondaryOptions={navyFilterSecondaryOptionsWeb2}
      buildItems={buildItems}
    />
  );
}
