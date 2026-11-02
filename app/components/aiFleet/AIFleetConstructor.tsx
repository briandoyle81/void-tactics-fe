"use client";

import React, { useCallback, useMemo } from "react";
import type { AIShipConfig } from "../../types/types";
import { useGetAllAIShipConfigs } from "../../hooks/useAIEncountersContract";
import { useAIEncountersAdmin } from "../../hooks/useAIEncountersAdmin";
import { useIsEncounterEditor } from "../../hooks/useIsEncounterEditor";
import { useMaxSpecialSlot } from "../../hooks/useGameContract";
import type { AIFleetShipData } from "../../utils/aiFleet";
import { AIFleetConstructorView, type AIFleetWrite } from "./AIFleetConstructorView";

// Web3 AI fleet constructor: the AIEncounters contract's ship configs
// (getAllAIShipConfigs), written with createAIShipConfig /
// updateAIShipConfig, one transaction each. Writes need isEncounterEditor.
// Ids and serials become bigint only at the contract calls.

const COLOR_SETS = [1, 2] as const;

function fromChain(c: AIShipConfig): AIFleetShipData {
  const colors = c.traits.colors;
  return {
    configId: Number(c.id),
    name: c.name,
    equipment: {
      mainWeapon: Number(c.equipment.mainWeapon),
      armor: Number(c.equipment.armor),
      shields: Number(c.equipment.shields),
      special: Number(c.equipment.special),
    },
    traits: {
      serialNumber: Number(c.traits.serialNumber),
      colors: {
        h1: Number(colors.h1),
        s1: Number(colors.s1),
        l1: Number(colors.l1),
        h2: Number(colors.h2),
        s2: Number(colors.s2),
        l2: Number(colors.l2),
      },
      variant: Number(c.traits.variant),
      accuracy: Number(c.traits.accuracy),
      hull: Number(c.traits.hull),
      speed: Number(c.traits.speed),
    },
    archetype: Number(c.archetype),
    shiny: c.shiny,
    shipsDestroyed: Number(c.shipsDestroyed),
  };
}

export function AIFleetConstructor() {
  const { data: configs, refetch } = useGetAllAIShipConfigs();
  const { isEditor } = useIsEncounterEditor();
  const admin = useAIEncountersAdmin();
  const { maxSlot: maxSlotV1 } = useMaxSpecialSlot(1);
  const { maxSlot: maxSlotV2 } = useMaxSpecialSlot(2);

  const saved = useMemo(() => configs?.map(fromChain), [configs]);
  const chainById = useMemo(() => new Map((configs ?? []).map((c) => [Number(c.id), c])), [configs]);
  const maxSpecialSlot = useCallback(
    (variant: number) => (variant === 1 ? maxSlotV1 : variant === 2 ? maxSlotV2 : undefined),
    [maxSlotV1, maxSlotV2],
  );

  const onWrite = useCallback(
    async (
      { creates, updates }: { creates: AIFleetWrite[]; updates: AIFleetWrite[] },
      onCreated: (key: string, configId: number) => void,
    ) => {
      const toTraits = (ship: AIFleetWrite) => {
        // Keep a saved config's exact serial (a uint256 can be past 2^53).
        const existing = ship.configId != null ? chainById.get(ship.configId) : undefined;
        const serialNumber =
          existing && Number(existing.traits.serialNumber) === ship.traits.serialNumber
            ? existing.traits.serialNumber
            : BigInt(ship.traits.serialNumber);
        return { ...ship.traits, serialNumber };
      };
      let created = 0;
      let updated = 0;
      try {
        for (const ship of creates) {
          const { configId } = await admin.createAIShipConfig(
            ship.name,
            ship.equipment,
            toTraits(ship),
            ship.archetype,
            ship.shiny,
            ship.shipsDestroyed,
          );
          if (configId != null) onCreated(ship.key, Number(configId));
          created += 1;
        }
        for (const ship of updates) {
          await admin.updateAIShipConfig(
            BigInt(ship.configId!),
            ship.name,
            ship.equipment,
            toTraits(ship),
            ship.archetype,
            ship.shiny,
            ship.shipsDestroyed,
          );
          updated += 1;
        }
      } catch (e) {
        const done = created + updated;
        const message = e instanceof Error ? e.message.split("\n")[0] : "Transaction failed";
        throw new Error(
          done > 0
            ? `Stopped after ${done} of ${creates.length + updates.length} (${message}). Write again for the rest.`
            : message,
        );
      } finally {
        await refetch();
      }
      return { created, updated };
    },
    [admin, chainById, refetch],
  );

  return (
    <AIFleetConstructorView
      saved={saved}
      canWrite={isEditor}
      destination="chain"
      colorSets={COLOR_SETS}
      maxSpecialSlot={maxSpecialSlot}
      onWrite={onWrite}
    />
  );
}
