"use client";

import React from "react";
import { toast } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { RoguelikeNodeKind } from "../types/roguelike";
import type { RoguelikeNodeWeb2 } from "../hooks/useRoguelikeWeb2";
import { useRoguelikeAdminWeb2, type RoguelikeNodeWeb2Input } from "../hooks/useRoguelikeAdminWeb2";
import { useWeb2Admin } from "../hooks/useWeb2Admin";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { WinEffectsPickerWeb2 } from "./WinEffectsPickerWeb2";
import type { WinEffectKey } from "../lib/winEffectsCatalog";
import { useNodeContentWeb2, useSaveNodeContentWeb2 } from "../hooks/useNodeContent";
import type { MapPickerMap } from "./MapPickerModal";
import { RoguelikeNodeEditForm } from "./operations/RoguelikeNodeEditForm";
import { MapEditScreenWeb2 } from "./MapEditScreenWeb2";
import { MapMode } from "../types/types";
import { MapPlacementsEditorWeb2 } from "./MapPlacementsEditorWeb2";
import { EnemyFleetPreview } from "./EnemyFleetPreview";
import { aiConfigToPreviewShipWeb2, type AIShipConfigWeb2 } from "../utils/aiShipConfigWeb2";
import { ARCHETYPE_LABEL } from "../utils/aiShipConfig";
import { ShipImageWeb2 } from "./ShipImageWeb2";
import ShipCard from "./ShipCard";
import { toShipCardDataWeb2 } from "../utils/toShipCardData";
import { parseZoneTiles } from "../utils/deploymentZone";

interface Web2Map {
  id: number;
  name: string;
  blockedTiles: MapPickerMap["blockedPositions"];
  scoringTiles: MapPickerMap["scoringPositions"];
  impassableTiles?: NonNullable<MapPickerMap["impassablePositions"]>;
  creatorZone?: unknown;
  joinerZone?: unknown;
  mode: MapMode;
}

interface AIMapPlacementWeb2 {
  configId: number;
}

const INPUT_CLASS = "px-3 py-2 bg-near-black border text-cyan focus:outline-none focus:ring-2 focus:ring-cyan";
const INPUT_STYLE = { borderRadius: 0, borderColor: "var(--color-cyan)" } as const;

/**
 * Web2's node panel (see RoguelikeNodeEditForm): the admin API, maps from
 * /api/maps, and node text editable here (web2 keeps it in Postgres).
 */
export function RoguelikeNodeEditPanelWeb2({
  mode,
  node,
  campaignId,
  connectModeActive,
  onStartConnectMode,
  onCancelConnectMode,
  onSaved,
  onCreated,
  onCancelCreate,
}: {
  mode: "create" | "edit";
  node: RoguelikeNodeWeb2 | null;
  campaignId: number;
  connectModeActive: boolean;
  onStartConnectMode: (sourceNodeId: number) => void;
  onCancelConnectMode: () => void;
  onSaved: () => void;
  onCreated: () => void;
  onCancelCreate: () => void;
}) {
  const admin = useRoguelikeAdminWeb2();
  const isWeb2Admin = useWeb2Admin();
  const { email, isLoggedIn, isLoading: isUserLoading } = useCurrentUser();
  const { data: web2Maps, refetch: refetchWeb2Maps } = useQuery({
    queryKey: ["maps", "web2"],
    queryFn: () => apiFetch<Web2Map[]>("/api/maps"),
  });
  const { data: configs } = useQuery({
    queryKey: ["ai-ship-configs"],
    queryFn: () => apiFetch<AIShipConfigWeb2[]>("/api/admin/ai-ship-configs"),
  });
  const { contentById, refetch: refetchContent } = useNodeContentWeb2("ROGUELIKE");
  const saveContent = useSaveNodeContentWeb2();

  // The node's text, reseeded when a different node is selected.
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const seededNodeIdRef = React.useRef<number | null | undefined>(undefined);
  React.useEffect(() => {
    const key = node?.id ?? null;
    if (seededNodeIdRef.current === key) return;
    seededNodeIdRef.current = key;
    const c = node ? contentById.get(Number(node.id)) : undefined;
    setTitle(c?.title ?? "");
    setDescription(c?.description ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);

  const maps: MapPickerMap[] = React.useMemo(
    () =>
      (web2Maps ?? []).map((m) => ({
        id: m.id,
        titleLabel: `Map #${m.id} - ${m.name}`,
        blockedPositions: m.blockedTiles,
        scoringPositions: m.scoringTiles,
        impassablePositions: m.impassableTiles ?? [],
        creatorZonePositions: parseZoneTiles(m.creatorZone) ?? [],
        joinerZonePositions: parseZoneTiles(m.joinerZone) ?? [],
        modeLabel: MapMode[m.mode],
      })),
    [web2Maps],
  );
  const pickerMaps = React.useMemo(
    () => maps.filter((m) => (web2Maps?.find((w) => w.id === m.id)?.mode ?? MapMode.Both) !== MapMode.PvP),
    [maps, web2Maps],
  );

  const handleSaveContent = async () => {
    if (node == null) return;
    try {
      await saveContent("ROGUELIKE", node.id, { title, description });
      await refetchContent();
      toast.success("Node content saved.");
    } catch (error) {
      console.error("Failed to save node content:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save node content");
    }
  };

  const formNode = React.useMemo(
    () =>
      node
        ? {
            id: node.id,
            kind: node.kind as RoguelikeNodeKind,
            mapId: node.mapId ?? 0,
            turnTime: node.turnTimeSeconds ?? 120,
            maxScore: node.maxScore ?? 1000,
            creatorGoesFirst: node.creatorGoesFirst ?? true,
            costCapOverride: node.costCapOverride ?? 700,
            childIds: node.childEdges.map((e) => e.childId),
          }
        : null,
    [node],
  );

  return (
    <RoguelikeNodeEditForm
      mode={mode}
      node={formNode}
      maps={maps}
      pickerMaps={pickerMaps}
      canEditMap={isWeb2Admin}
      contentSection={
        <>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Title
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
            />
          </label>
          {mode === "edit" && (
            <button
              type="button"
              onClick={() => void handleSaveContent()}
              className="self-start border-2 border-cyan px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan hover:bg-cyan/10"
              style={{ borderRadius: 0 }}
            >
              [SAVE CONTENT]
            </button>
          )}
        </>
      }
      winEffectsSection={
        node ? (
          <WinEffectsPickerWeb2
            currentEffects={node.winEffects}
            onSave={async (effects: WinEffectKey[]) => {
              try {
                await admin.setNodeWinEffects(node.id, effects);
                toast.success("Win effects updated.");
                onSaved();
              } catch (error) {
                console.error("Failed to save win effects:", error);
                toast.error(error instanceof Error ? error.message : "Failed to save win effects");
              }
            }}
          />
        ) : null
      }
      renderEnemyFleetPreview={(mapId) => <RoguelikeEnemyFleetPreviewWeb2For mapId={mapId} configs={configs ?? []} />}
      renderMapEditor={(map, close) => {
        const editing = (web2Maps ?? []).find((m) => m.id === map.id);
        if (!editing) return null;
        return (
          <MapEditScreenWeb2
            key={editing.id}
            map={{ ...editing, impassableTiles: editing.impassableTiles ?? [] }}
            onSaved={() => {
              close();
              void refetchWeb2Maps();
            }}
            onCancel={close}
            onMapChanged={() => void refetchWeb2Maps()}
          />
        );
      }}
      renderFleetEditor={(mapId, close) =>
        isWeb2Admin ? <MapPlacementsEditorWeb2 mapId={mapId} configs={configs ?? []} startOpen onClose={close} /> : null
      }
      fleetEditorBlockedReason={() => {
        if (isUserLoading) return "Checking admin permission...";
        if (!isLoggedIn || !email) return "Log in as an admin to edit the enemy fleet.";
        if (!isWeb2Admin) return "This account is not an admin. Log in with an admin email to edit the enemy fleet.";
        return null;
      }}
      onSubmit={async (f) => {
        const input: RoguelikeNodeWeb2Input = {
          campaignId,
          kind: f.kind,
          mapId: f.isCombat ? f.mapId : null,
          turnTimeSeconds: f.isCombat ? f.turnTime : null,
          maxScore: f.isCombat ? f.maxScore : null,
          creatorGoesFirst: f.isCombat ? f.creatorGoesFirst : null,
          costCapOverride: f.isCombat ? null : f.costCapOverride,
        };
        if (mode === "create") {
          await admin.createNode(input);
          return "Node created.";
        }
        await admin.updateNode(node!.id, input);
        return `Node #${node!.id} updated.`;
      }}
      onRemoveChild={(childId) => admin.removeChild(node!.id, childId)}
      connectModeActive={connectModeActive}
      onStartConnectMode={onStartConnectMode}
      onCancelConnectMode={onCancelConnectMode}
      onSaved={onSaved}
      onCreated={onCreated}
      onCancelCreate={onCancelCreate}
    />
  );
}

function RoguelikeEnemyFleetPreviewWeb2For({
  mapId,
  configs,
}: {
  mapId: number;
  configs: AIShipConfigWeb2[];
}) {
  const { data: placements, isLoading } = useQuery({
    queryKey: ["ai-map-placements", mapId],
    queryFn: () => apiFetch<AIMapPlacementWeb2[]>(`/api/ai-map-placements?mapId=${mapId}`),
  });
  const configById = React.useMemo(() => {
    const map = new Map<number, AIShipConfigWeb2>();
    configs.forEach((c) => map.set(c.id, c));
    return map;
  }, [configs]);

  const ships = React.useMemo(() => {
    if (!placements) return [];
    return placements.flatMap((p, i) => {
      const config = configById.get(p.configId);
      if (!config) return [];
      const previewShip = aiConfigToPreviewShipWeb2(config, i);
      return [
        {
          key: `${p.configId}-${i}`,
          name: config.name || ARCHETYPE_LABEL[config.archetype],
          renderImage: () => (
            <ShipImageWeb2 ship={previewShip} className="h-full w-full" showLoadingState={false} hideRankStars />
          ),
          renderHoverCard: () => (
            <ShipCard
              ship={toShipCardDataWeb2(previewShip)}
              shipImage={<ShipImageWeb2 ship={previewShip} className="h-full w-full" showLoadingState={false} />}
              isStarred={false}
              onToggleStar={() => {}}
              isSelected={false}
              onToggleSelection={() => {}}
              onRecycleClick={() => {}}
              showInGameProperties={false}
              hideRecycle
              hideCheckbox
              tooltipMode
            />
          ),
        },
      ];
    });
  }, [placements, configById]);

  const totalCost = React.useMemo(() => {
    if (!placements) return 0;
    return placements.reduce((sum, p) => {
      const config = configById.get(p.configId);
      return config ? sum + aiConfigToPreviewShipWeb2(config).shipData.cost : sum;
    }, 0);
  }, [placements, configById]);

  return <EnemyFleetPreview ships={ships} totalCost={totalCost} isLoading={isLoading} />;
}
