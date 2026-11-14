"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archetype, MapPosition, ShipEquipment, AIEncountersTraits } from "../types/types";
import { useNearSession } from "../near/session";
import { viewGame } from "../near/rpc";
import { GAS_HEAVY, ROLE } from "../near/config";
import { toBig } from "../near/codec";
import { fromEquipment } from "../near/adapters/ship";
import { AI_CONFIGS_KEY, mapPlacementsKey } from "./useAIEncountersContract";
import type { AiShipConfig, Archetype as NearArchetype, Position } from "../near/generated/voidTactics";

const ARCHETYPES: NearArchetype[] = ["Grunt", "Aggressor", "Sniper", "Support", "Turtle", "Rammer", "Runner", "Hunter"];

function toNearConfig(
  name: string,
  equipment: ShipEquipment,
  traits: AIEncountersTraits,
  archetype: Archetype,
  shiny: boolean,
  shipsDestroyed: number,
): AiShipConfig {
  return {
    name,
    equipment: fromEquipment(equipment),
    traits: {
      serial_number: Number(traits.serialNumber),
      colors: { ...traits.colors },
      variant: traits.variant,
      accuracy: traits.accuracy,
      hull: traits.hull,
      speed: traits.speed,
    },
    archetype: ARCHETYPES[archetype] ?? "Grunt",
    shiny,
    ships_destroyed: shipsDestroyed,
  };
}

/** AI fleet editing (MAP_EDITOR or owner). Running games keep their own copy of their AI fleet. */
export function useAIEncountersAdmin() {
  const { send } = useNearSession();
  const queryClient = useQueryClient();

  const createAIShipConfig = useCallback(
    async (
      name: string,
      equipment: ShipEquipment,
      traits: AIEncountersTraits,
      archetype: Archetype,
      shiny = false,
      shipsDestroyed = 0,
    ) => {
      const receipt = await send({
        method: "create_ai_ship_config",
        args: { config: toNearConfig(name, equipment, traits, archetype, shiny, shipsDestroyed) },
      });
      void queryClient.invalidateQueries({ queryKey: AI_CONFIGS_KEY });
      return { hash: receipt.hash, configId: toBig(receipt.returnValue as string) };
    },
    [send, queryClient],
  );

  const updateAIShipConfig = useCallback(
    async (
      configId: bigint,
      name: string,
      equipment: ShipEquipment,
      traits: AIEncountersTraits,
      archetype: Archetype,
      shiny = false,
      shipsDestroyed = 0,
    ) => {
      const receipt = await send({
        method: "update_ai_ship_config",
        args: {
          config_id: configId.toString(),
          config: toNearConfig(name, equipment, traits, archetype, shiny, shipsDestroyed),
        },
      });
      void queryClient.invalidateQueries({ queryKey: AI_CONFIGS_KEY });
      return receipt.hash;
    },
    [send, queryClient],
  );

  /** Grants or revokes MAP_EDITOR (keeps the account's other roles). Owner only. */
  const setEncounterEditor = useCallback(
    async (editor: string, allowed: boolean) => {
      const roles = await viewGame("get_roles", { account_id: editor });
      const next = allowed ? roles | ROLE.MAP_EDITOR : roles & ~ROLE.MAP_EDITOR;
      const receipt = await send({ method: "set_role", args: { account_id: editor, role_bits: next } });
      return receipt.hash;
    },
    [send],
  );

  const setMapPlacements = useCallback(
    async (mapId: bigint, positions: MapPosition[], configIds: bigint[]) => {
      const receipt = await send({
        method: "set_map_placements",
        args: {
          map_id: mapId.toString(),
          positions: positions.map((p) => ({ row: p.row, col: p.col })),
          config_ids: configIds.map(String),
        },
        gas: GAS_HEAVY,
      });
      void queryClient.invalidateQueries({ queryKey: mapPlacementsKey(mapId) });
      void queryClient.invalidateQueries({ queryKey: ["near-map-placements"] });
      return receipt.hash;
    },
    [send, queryClient],
  );

  /** One placement: the map's whole placement list is rewritten with this tile set (configId 0 clears it). */
  const setMapPlacement = useCallback(
    async (mapId: bigint, row: number, col: number, configId: bigint) => {
      const raw = (await viewGame("get_map_placements", { map_id: mapId.toString() })) as unknown as Array<
        [Position, string]
      >;
      const kept = raw.filter(([p]) => !(p.row === row && p.col === col));
      const positions = kept.map(([p]) => p);
      const ids = kept.map(([, id]) => toBig(id));
      if (configId > BigInt(0)) {
        positions.push({ row, col });
        ids.push(configId);
      }
      return setMapPlacements(mapId, positions, ids);
    },
    [setMapPlacements],
  );

  return {
    createAIShipConfig,
    updateAIShipConfig,
    setEncounterEditor,
    setMapPlacement,
    setMapPlacements,
  };
}
