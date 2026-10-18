"use client";

import React from "react";
import { toast } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { useOwnedShipsWeb2 } from "../hooks/useOwnedShipsWeb2";
import { useShipAttributesByIdsWeb2 } from "../hooks/useShipAttributesByIdsWeb2";
import { useRoguelikeResupplyWeb2 } from "../hooks/useRoguelikeResupplyWeb2";
import type { RoguelikeRunWeb2, RoguelikeNodeWeb2 } from "../hooks/useRoguelikeWeb2";
import ShipCard from "./ShipCard";
import { ShipImageWeb2 } from "./ShipImageWeb2";
import { toShipCardDataWeb2 } from "../utils/toShipCardData";
import { RoguelikeResupplyView } from "./operations/RoguelikeResupplyView";

/**
 * Web2's resupply screen (see RoguelikeResupplyView): repairs and roster
 * changes through the API. No approve step: credits are a ledger balance,
 * not an ERC20 allowance. A roster entry's `hp` is damage taken (0 = full).
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
  const { ships: ownedShips } = useOwnedShipsWeb2();
  const { data: repairCost } = useQuery({
    queryKey: ["roguelike", "repair-cost", "web2"],
    queryFn: () => apiFetch<{ repairCostPerHp: number }>("/api/roguelike/repair-cost"),
  });
  const { attributesByShipId } = useShipAttributesByIdsWeb2(run.roster.map((r) => r.shipId));
  const [isRepairing, setIsRepairing] = React.useState(false);

  const modifyRoster = async (add: number[], remove: number[], done: string) => {
    try {
      await resupplyModifyRoster(add, remove);
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to modify roster");
    }
  };

  const rosterShipIds = new Set(run.roster.map((r) => r.shipId));
  const rosterVariant = run.roster[0]?.ship.traits.variant;
  const availableShips = ownedShips.filter(
    (s) =>
      s.shipData.constructed &&
      s.shipData.timestampDestroyed === 0 &&
      !s.shipData.inFleet &&
      !rosterShipIds.has(s.id) &&
      (rosterVariant != null ? s.traits.variant === rosterVariant : true),
  );

  return (
    <RoguelikeResupplyView
      nodeLabel={String(node.id)}
      costCapLabel={String(run.currentCostCap)}
      roster={run.roster.map((entry) => {
        const max = attributesByShipId.get(entry.shipId)?.maxHullPoints ?? 0;
        return {
          key: String(entry.shipId),
          name: entry.ship.name || `Ship #${entry.shipId}`,
          image: <ShipImageWeb2 ship={entry.ship} className="h-full w-full" showLoadingState={false} />,
          currentHP: max - entry.hp,
          maxHP: max,
        };
      })}
      available={availableShips.map((ship) => ({
        key: String(ship.id),
        card: (
          <ShipCard
            ship={toShipCardDataWeb2(ship)}
            shipImage={<ShipImageWeb2 ship={ship} className="h-full w-full" />}
            isStarred={false}
            onToggleStar={() => {}}
            isSelected={false}
            onToggleSelection={() => {}}
            onRecycleClick={() => {}}
            showInGameProperties={false}
            hideRecycle
            hideCheckbox
          />
        ),
      }))}
      onAdd={(key) => modifyRoster([Number(key)], [], "Ship added to roster.")}
      onRemove={(key) => modifyRoster([], [Number(key)], "Ship removed from roster.")}
      repairCostLabel={(missingHP) =>
        `Repair cost: ${missingHP * (repairCost?.repairCostPerHp ?? 0)} UTC (${missingHP} HP)`
      }
      renderRepairButton={({ keys, missingHP, onRepaired }) => (
        <button
          type="button"
          disabled={isRepairing}
          onClick={async () => {
            setIsRepairing(true);
            try {
              const result = await resupplyRepair(keys.map(Number));
              onRepaired();
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
          {isRepairing ? "[REPAIRING...]" : `[REPAIR ${missingHP} HP]`}
        </button>
      )}
      onDone={onDone}
    />
  );
}
