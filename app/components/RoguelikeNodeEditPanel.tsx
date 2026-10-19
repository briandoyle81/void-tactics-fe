"use client";

import React from "react";
import { toast } from "react-hot-toast";
import type { RoguelikeNode } from "../types/roguelike";
import { MapMode } from "../types/types";
import { useRoguelikeNodeMapAdmin } from "../hooks/useRoguelikeNodeMapAdmin";
import {
  useGetAllPresetMaps,
  useMapModes,
  useMapNames,
  useMapsCreatorZonePositions,
  useMapsImpassablePositions,
  useMapsJoinerZonePositions,
  mapTitleLabel,
} from "../hooks/useMapsContract";
import { useGetAllAIShipConfigs } from "../hooks/useAIEncountersContract";
import { useIsEncounterEditor } from "../hooks/useIsEncounterEditor";
import type { ResolvedNodeContent } from "../hooks/useNodeContent";
import { NodeContentReadOnly } from "./NodeContentReadOnly";
import {
  WIN_EFFECT_CATALOG,
  useWinEffectAddresses,
  useRoguelikeNodeWinEffects,
} from "../hooks/useWinEffects";
import type { MapPickerMap } from "./MapPickerModal";
import { RoguelikeNodeEditForm } from "./operations/RoguelikeNodeEditForm";
import { MapEditScreen } from "./MapEditScreen";
import { useAccount } from "wagmi";
import { MAP_ADMIN_ADDRESS } from "../config/alpha";
import { MapPlacementsEditor } from "./MapPlacementsEditor";
import { EnemyFleetPreview } from "./EnemyFleetPreview";
import { useGetMapPlacements } from "../hooks/useAIEncountersContract";
import { aiConfigToPreviewShip, ARCHETYPE_LABEL } from "../utils/aiShipConfig";
import { ShipImage } from "./ShipImage";
import ShipCard from "./ShipCard";
import { toShipCardData } from "../utils/toShipCardData";
import { SHIP_GRANT_ADDRESS, useShipGrants } from "../hooks/useShipGrants";
import { NodeRewardShipSummary } from "./rewardShips/NodeRewardShipSummary";

interface RoguelikeNodeEditPanelProps {
  mode: "create" | "edit";
  /** The graph passes its node with resolved title/description attached. */
  node: (RoguelikeNode & Partial<ResolvedNodeContent>) | null;
  campaignId: bigint;
  /** True while THIS node is the active connect-mode source (parent side of addChild). */
  connectModeActive: boolean;
  onStartConnectMode: (sourceNodeId: bigint) => void;
  onCancelConnectMode: () => void;
  onSaved: () => void;
  onCreated: () => void;
  onCancelCreate: () => void;
}

/**
 * Web3's node panel (see RoguelikeNodeEditForm): RoguelikeNodeMap
 * transactions, maps from the Maps contract, win effects by resolver
 * address, node text read-only (it ships with the app). Bigints convert here.
 */
export function RoguelikeNodeEditPanel({
  mode,
  node,
  campaignId,
  connectModeActive,
  onStartConnectMode,
  onCancelConnectMode,
  onSaved,
  onCreated,
  onCancelCreate,
}: RoguelikeNodeEditPanelProps) {
  const admin = useRoguelikeNodeMapAdmin();
  const { data: allMapsData, refetch: refetchAllMaps } = useGetAllPresetMaps();
  const { address } = useAccount();
  const isMapAdmin = address?.toLowerCase() === MAP_ADMIN_ADDRESS.toLowerCase();
  const { data: allConfigs } = useGetAllAIShipConfigs();
  const { isEditor: isEncounterEditor, isLoading: isEncounterEditorLoading } =
    useIsEncounterEditor();
  const winEffectAddresses = useWinEffectAddresses();
  const { data: currentWinEffects, refetch: refetchWinEffects } = useRoguelikeNodeWinEffects(node?.id);

  const grantNodeIds = React.useMemo(() => (node ? [Number(node.id)] : []), [node]);
  const { grantsByNodeId } = useShipGrants(grantNodeIds, mode === "edit");
  const [selectedWinEffects, setSelectedWinEffects] = React.useState<string[]>([]);
  const [isSavingWinEffects, setIsSavingWinEffects] = React.useState(false);
  React.useEffect(() => {
    setSelectedWinEffects((currentWinEffects ?? []).map((a) => a.toLowerCase()));
  }, [currentWinEffects]);

  const allMapIds = React.useMemo(() => {
    if (!allMapsData) return [];
    const [mapIds] = allMapsData as [bigint[], unknown[], unknown[]];
    return mapIds.map((id) => Number(id));
  }, [allMapsData]);
  const { nameByMapId } = useMapNames(allMapIds);
  const { modeByMapId } = useMapModes(allMapIds);
  const { impassableByMapId } = useMapsImpassablePositions(allMapIds);
  const { creatorZoneByMapId } = useMapsCreatorZonePositions(allMapIds);
  const { joinerZoneByMapId } = useMapsJoinerZonePositions(allMapIds);

  const maps: MapPickerMap[] = React.useMemo(() => {
    if (!allMapsData) return [];
    const [mapIds, blockedArr, scoringArr] = allMapsData as [bigint[], unknown[], unknown[]];
    return mapIds.map((id, i) => ({
      id: Number(id),
      titleLabel: mapTitleLabel(Number(id), nameByMapId),
      blockedPositions: (blockedArr[i] as MapPickerMap["blockedPositions"]) ?? [],
      scoringPositions: (scoringArr[i] as MapPickerMap["scoringPositions"]) ?? [],
      impassablePositions: impassableByMapId.get(Number(id)),
      creatorZonePositions: creatorZoneByMapId.get(Number(id)),
      joinerZonePositions: joinerZoneByMapId.get(Number(id)),
      modeLabel: MapMode[modeByMapId.get(Number(id)) ?? MapMode.Both],
    }));
  }, [allMapsData, nameByMapId, impassableByMapId, creatorZoneByMapId, joinerZoneByMapId, modeByMapId]);

  const pickerMaps = React.useMemo(
    () => maps.filter((m) => (modeByMapId.get(m.id) ?? MapMode.Both) !== MapMode.PvP),
    [maps, modeByMapId],
  );

  const toggleWinEffect = (addr: string) => {
    const lower = addr.toLowerCase();
    setSelectedWinEffects((prev) => (prev.includes(lower) ? prev.filter((a) => a !== lower) : [...prev, lower]));
  };

  const handleSaveWinEffects = async () => {
    if (!node) return;
    setIsSavingWinEffects(true);
    try {
      const hash = await admin.setNodeWinEffects(node.id, selectedWinEffects as `0x${string}`[]);
      await refetchWinEffects();
      toast.success(`Win effects updated. (tx: ${hash.slice(0, 10)}…)`);
    } catch (error) {
      console.error("Failed to save win effects:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save win effects");
    } finally {
      setIsSavingWinEffects(false);
    }
  };

  const formNode = React.useMemo(
    () =>
      node
        ? {
            id: Number(node.id),
            kind: node.kind,
            mapId: Number(node.mapId),
            turnTime: Number(node.turnTime),
            maxScore: Number(node.maxScore),
            creatorGoesFirst: node.creatorGoesFirst,
            costCapOverride: Number(node.costCapOverride),
            childIds: node.children.map((c) => Number(c)),
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
      canEditMap={isMapAdmin}
      contentSection={mode === "edit" ? <NodeContentReadOnly node={node} /> : undefined}
      winEffectsSection={
        <>
          <div className="flex flex-col gap-1">
            {WIN_EFFECT_CATALOG.map(({ key, label }) => {
              const addr = winEffectAddresses[key];
              const checked = !!addr && selectedWinEffects.includes(addr.toLowerCase());
              return (
                <label key={key} className="flex items-center gap-2 text-xs text-text-secondary">
                  <input type="checkbox" checked={checked} disabled={!addr} onChange={() => addr && toggleWinEffect(addr)} />
                  {label}
                  {!addr && <span className="text-warning-red">(not deployed on this chain)</span>}
                </label>
              );
            })}
          </div>
          <button
            type="button"
            disabled={isSavingWinEffects}
            onClick={() => void handleSaveWinEffects()}
            className="self-start border-2 border-cyan px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderRadius: 0 }}
          >
            {isSavingWinEffects ? "[SAVING...]" : "[SAVE WIN EFFECTS]"}
          </button>
          {node && (
            <NodeRewardShipSummary
              nodeId={Number(node.id)}
              grant={grantsByNodeId.get(Number(node.id))}
              hasGrantEffect={(currentWinEffects ?? []).some((a) => a.toLowerCase() === SHIP_GRANT_ADDRESS.toLowerCase())}
            />
          )}
        </>
      }
      renderEnemyFleetPreview={(mapId) => (
        <RoguelikeEnemyFleetPreviewFor mapId={BigInt(mapId)} configs={allConfigs ?? []} />
      )}
      renderMapEditor={(map, close) => (
        <MapEditScreen
          mapId={map.id}
          initialBlockedPositions={map.blockedPositions}
          initialScoringPositions={map.scoringPositions}
          onSaved={() => {
            close();
            void refetchAllMaps();
          }}
          onCancel={close}
        />
      )}
      renderFleetEditor={(mapId, close) =>
        isEncounterEditor ? (
          <MapPlacementsEditor mapId={BigInt(mapId)} configs={allConfigs ?? []} startOpen onClose={close} />
        ) : null
      }
      fleetEditorBlockedReason={() => {
        if (!address) return "Connect the Enemy Fleet Editor wallet to edit placements.";
        if (isEncounterEditorLoading) return "Checking Enemy Fleet Editor permission...";
        if (!isEncounterEditor) return "This wallet is not an Enemy Fleet Editor. Ask an admin to grant isEncounterEditor.";
        return null;
      }}
      onSubmit={async (f) => {
        const mapId = f.isCombat ? BigInt(f.mapId) : 0n;
        const costCap = f.isCombat ? 0n : BigInt(f.costCapOverride);
        if (mode === "create") {
          const hash = await admin.createNode(
            campaignId, f.kind, mapId, BigInt(f.turnTime), BigInt(f.maxScore), f.creatorGoesFirst, costCap,
          );
          return `Node created. (tx: ${hash.slice(0, 10)}…)`;
        }
        const hash = await admin.updateNode(
          node!.id, node!.campaignId, f.kind, mapId, BigInt(f.turnTime), BigInt(f.maxScore), f.creatorGoesFirst, costCap,
        );
        return `Node #${node!.id} updated. (tx: ${hash.slice(0, 10)}…)`;
      }}
      onRemoveChild={(childId) => admin.removeChild(node!.id, BigInt(childId))}
      connectModeActive={connectModeActive}
      onStartConnectMode={(id) => onStartConnectMode(BigInt(id))}
      onCancelConnectMode={onCancelConnectMode}
      onSaved={onSaved}
      onCreated={onCreated}
      onCancelCreate={onCancelCreate}
    />
  );
}

function RoguelikeEnemyFleetPreviewFor({
  mapId,
  configs,
}: {
  mapId: bigint;
  configs: ReturnType<typeof useGetAllAIShipConfigs>["data"];
}) {
  const placementsQuery = useGetMapPlacements(mapId);
  const configById = React.useMemo(() => {
    const map = new Map<string, NonNullable<typeof configs>[number]>();
    (configs ?? []).forEach((c) => map.set(c.id.toString(), c));
    return map;
  }, [configs]);

  const ships = React.useMemo(() => {
    if (!placementsQuery.data) return [];
    return placementsQuery.data.configIds.flatMap((configId, i) => {
      const config = configById.get(configId.toString());
      if (!config) return [];
      const previewShip = aiConfigToPreviewShip(config, BigInt(i));
      return [
        {
          key: `${configId.toString()}-${i}`,
          name: config.name || ARCHETYPE_LABEL[config.archetype],
          renderImage: () => (
            <ShipImage ship={previewShip} className="h-full w-full" showLoadingState={false} hideRankStars />
          ),
          renderHoverCard: () => (
            <ShipCard
              ship={toShipCardData(previewShip)}
              shipImage={<ShipImage ship={previewShip} className="h-full w-full" showLoadingState={false} />}
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
  }, [placementsQuery.data, configById]);

  const totalCost = React.useMemo(() => {
    if (!placementsQuery.data) return 0;
    return placementsQuery.data.configIds.reduce((sum: number, configId: bigint) => {
      const config = configById.get(configId.toString());
      return config ? sum + aiConfigToPreviewShip(config).shipData.cost : sum;
    }, 0);
  }, [placementsQuery.data, configById]);

  return (
    <EnemyFleetPreview ships={ships} totalCost={totalCost} isLoading={placementsQuery.isLoading} />
  );
}
