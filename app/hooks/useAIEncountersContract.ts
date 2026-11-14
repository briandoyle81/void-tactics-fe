"use client";

import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archetype, AIShipConfig } from "../types/types";
import { aiConfigToPreviewShip } from "../utils/aiShipConfig";
import { viewGame } from "../near/rpc";
import { toEquipment } from "../near/adapters/ship";
import { toBig } from "../near/codec";
import type { AiShipConfig as NearAiShipConfig, Position } from "../near/generated/voidTactics";
import { useGameSettings } from "../near/useGameSettings";
import type { GameSettings } from "../near/generated/voidTactics";
import { fetchAllPages } from "../near/useNearView";

const selectMaxPlacements = (s: GameSettings) => BigInt(s.max_placements_per_map);

const ARCHETYPES = ["Grunt", "Aggressor", "Sniper", "Support", "Turtle", "Rammer", "Runner", "Hunter"] as const;

export const AI_CONFIGS_KEY = ["near-ai-configs", "all"] as const;
export function mapPlacementsKey(mapId: number | bigint) {
  return ["near-map-placements", String(mapId)] as const;
}

export function toAIShipConfig(id: bigint, c: NearAiShipConfig): AIShipConfig {
  return {
    id,
    name: c.name,
    equipment: toEquipment(c.equipment),
    traits: {
      serialNumber: toBig(c.traits.serial_number),
      colors: { ...c.traits.colors },
      variant: c.traits.variant,
      accuracy: c.traits.accuracy,
      hull: c.traits.hull,
      speed: c.traits.speed,
    },
    archetype: Math.max(0, ARCHETYPES.indexOf(c.archetype as (typeof ARCHETYPES)[number])) as Archetype,
    shiny: c.shiny,
    shipsDestroyed: c.ships_destroyed,
  };
}

/** Every AI ship config (ids 1..get_ai_config_count). */
export async function fetchAllAIShipConfigs(): Promise<AIShipConfig[]> {
  const pairs = await fetchAllPages(
    (from, limit) => viewGame("get_ai_ship_configs", { from_index: from, limit }),
    100,
  );
  return pairs.map(([id, c]) => toAIShipConfig(BigInt(id), c));
}

export function useGetAllAIShipConfigs() {
  return useQuery({ queryKey: AI_CONFIGS_KEY, queryFn: fetchAllAIShipConfigs, staleTime: ADMIN_DATA_STALE_MS });
}

/** Most AI ships one map may place (get_settings.max_placements_per_map). */
export function useMaxPlacementsPerMap() {
  return useGameSettings(selectMaxPlacements);
}

async function fetchMapPlacements(mapId: number | bigint) {
  const raw = (await viewGame("get_map_placements", { map_id: String(mapId) })) as unknown as Array<[Position, string]>;
  return {
    positions: raw.map(([p]) => ({ row: p.row, col: p.col })),
    configIds: raw.map(([, id]) => toBig(id)),
  };
}

export function useGetMapPlacements(mapId: bigint | undefined) {
  return useQuery({
    queryKey: mapPlacementsKey(mapId ?? BigInt(0)),
    queryFn: () => fetchMapPlacements(mapId!),
    enabled: mapId != null,
    staleTime: ADMIN_DATA_STALE_MS,
  });
}

/**
 * Total "enemy threat" for a node's map: the sum of each placed AI ship's
 * cost (aiConfigToPreviewShip, the same formula real player ships use).
 */
export function useMapEnemyThreat(mapId: bigint | undefined) {
  const { data: allConfigs, isLoading: configsLoading } = useGetAllAIShipConfigs();
  const { data: placements, isLoading: placementsLoading } = useGetMapPlacements(mapId);

  const totalThreat = useMemo(() => {
    if (!allConfigs || !placements) return 0;
    const configById = new Map(allConfigs.map((c) => [c.id.toString(), c]));
    return placements.configIds.reduce((sum, configId) => {
      const config = configById.get(configId.toString());
      return config ? sum + aiConfigToPreviewShip(config).shipData.cost : sum;
    }, 0);
  }, [allConfigs, placements]);

  return { totalThreat, isLoading: configsLoading || placementsLoading };
}

/** Placements for every map id (admin export / map problems). */
export function useGetAllMapPlacements(mapIds: number[]) {
  const key = mapIds.join(",");
  const result = useQuery({
    queryKey: ["near-map-placements", "all", key],
    queryFn: () => Promise.all(mapIds.map((id) => fetchMapPlacements(id))),
    enabled: mapIds.length > 0,
    staleTime: ADMIN_DATA_STALE_MS,
  });
  const data = useMemo(
    () =>
      mapIds.map((mapId, i) => ({
        mapId,
        positions: result.data?.[i]?.positions ?? [],
        configIds: result.data?.[i]?.configIds ?? [],
      })),
    [mapIds, result.data],
  );
  return { ...result, data };
}
