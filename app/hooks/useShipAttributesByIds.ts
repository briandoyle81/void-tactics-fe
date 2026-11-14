import React from "react";
import { useQuery } from "@tanstack/react-query";
import type { Attributes, Ship } from "../types/types";
import { viewGame } from "../near/rpc";
import { calculateAttributesFromContracts, tableFromNear, type VariantAttributeTable } from "../utils/shipAttributesCalculator";
import { useShipList } from "./useShipsContract";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";

export interface LiveAttributeTable {
  version: number;
  table: VariantAttributeTable;
}

/**
 * Each variant's current attribute table (get_current_attributes_version +
 * get_variant_attributes). A ship's stats are a pure function of the ship
 * and its variant's table (the contract computes them the same way in
 * vt-core), so the app computes them locally instead of a per-ship read.
 */
export function useVariantAttributeTables(variants: readonly number[] = [1, 2]) {
  const key = [...new Set(variants)].sort().join(",");
  return useQuery({
    queryKey: ["near-attribute-tables", key],
    queryFn: async () => {
      const out = new Map<number, LiveAttributeTable>();
      await Promise.all(
        key.split(",").filter(Boolean).map(async (v) => {
          const variant = Number(v);
          const version = await viewGame("get_current_attributes_version", { variant });
          const data = await viewGame("get_variant_attributes", { variant, version });
          if (data) out.set(variant, { version, table: tableFromNear(data) });
        }),
      );
      return out;
    },
    staleTime: ADMIN_DATA_STALE_MS,
  });
}

/** One ship's stats from the live tables (falls back to the built-in mirror while they load). */
export function attributesFor(ship: Ship, tables: Map<number, LiveAttributeTable> | undefined): Attributes {
  const live = tables?.get(ship.traits.variant);
  return calculateAttributesFromContracts(ship, live?.table, live?.version);
}

/** In-game stats for ships by id (player ships), in the same order. */
export function useShipAttributesByIds(shipIds: bigint[]) {
  const shipsQuery = useShipList(shipIds);
  const tablesQuery = useVariantAttributeTables();
  const ships = shipsQuery.data;
  const tables = tablesQuery.data;

  const attributes = React.useMemo((): Attributes[] => {
    if (!ships || !tables || shipIds.length === 0) return [];
    const byId = new Map(ships.map((s) => [s.id.toString(), s]));
    const rows: Attributes[] = [];
    for (const id of shipIds) {
      const ship = byId.get(id.toString());
      if (!ship) return [];
      rows.push(attributesFor(ship, tables));
    }
    return rows;
  }, [ships, tables, shipIds]);

  return {
    attributes,
    isLoading: shipIds.length > 0 && (shipsQuery.isLoading || tablesQuery.isLoading),
    error: shipsQuery.error ?? tablesQuery.error,
    refetch: shipsQuery.refetch,
    isFromCache: false,
  };
}
