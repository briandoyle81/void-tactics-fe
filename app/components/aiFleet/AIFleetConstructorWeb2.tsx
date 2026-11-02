"use client";

import React, { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiFetch";
import { apiMutate } from "../../lib/apiMutate";
import { useWeb2Admin } from "../../hooks/useWeb2Admin";
import type { AIShipConfigWeb2 } from "../../utils/aiShipConfigWeb2";
import { ARCHETYPE_LABEL } from "../../utils/aiShipConfig";
import { aiFleetShipFromWeb2, aiFleetShipToWeb2 } from "../../utils/aiFleet";
import { AIFleetConstructorView, type AIFleetWrite } from "./AIFleetConstructorView";

// Web2 AI fleet constructor: the AIShipConfig rows through
// /api/admin/ai-ship-configs (the same query as AIEncountersAdminPanelWeb2),
// written with POST / PUT. Like web3, a
// removed ship isn't deleted (the contract can't), only left out.

const COLOR_SETS = [1, 2] as const;
const QUERY_KEY = ["ai-ship-configs"];

export function AIFleetConstructorWeb2() {
  const isAdmin = useWeb2Admin();
  const queryClient = useQueryClient();
  const { data: configs } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<AIShipConfigWeb2[]>("/api/admin/ai-ship-configs"),
    enabled: isAdmin,
  });
  const saved = useMemo(() => configs?.map(aiFleetShipFromWeb2), [configs]);

  const onWrite = useCallback(
    async (
      { creates, updates }: { creates: AIFleetWrite[]; updates: AIFleetWrite[] },
      onCreated: (key: string, configId: number) => void,
    ) => {
      const body = (ship: AIFleetWrite) => {
        const { name, equipment, traits, archetype, shiny, shipsDestroyed } = aiFleetShipToWeb2(ship);
        // The API requires a name; an unnamed ship is called by its archetype.
        return { name: name || ARCHETYPE_LABEL[archetype], equipment, traits, archetype, shiny, shipsDestroyed };
      };
      let created = 0;
      let updated = 0;
      try {
        for (const ship of creates) {
          const row = await apiMutate<AIShipConfigWeb2>("/api/admin/ai-ship-configs", "POST", body(ship));
          if (row?.id != null) onCreated(ship.key, row.id);
          created += 1;
        }
        for (const ship of updates) {
          await apiMutate(`/api/admin/ai-ship-configs/${ship.configId}`, "PUT", body(ship));
          updated += 1;
        }
      } catch (e) {
        const done = created + updated;
        const message = e instanceof Error ? e.message : "Save failed";
        throw new Error(
          done > 0
            ? `Stopped after ${done} of ${creates.length + updates.length} (${message}). Write again for the rest.`
            : message,
        );
      } finally {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }
      return { created, updated };
    },
    [queryClient],
  );

  return (
    <AIFleetConstructorView
      saved={saved}
      canWrite={isAdmin}
      destination="database"
      colorSets={COLOR_SETS}
      onWrite={onWrite}
    />
  );
}
