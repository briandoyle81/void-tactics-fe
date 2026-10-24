"use client";

import { shipGrantToPreviewShip } from "../utils/previewShips";
import React from "react";
import { useAccount } from "wagmi";
import { toast } from "react-hot-toast";
import { MissionBriefing } from "./MissionBriefing";
import { MissionDossier } from "./MissionDossier";
import { navigateToGame } from "../utils/navigateToGame";
import { useRoguelikeVictoryEffects } from "../hooks/useRoguelikeVictoryEffects";
import { roguelikeCombatDossierRows, roguelikeResupplyDossierRows } from "../utils/missionDossierRows";
import { RoguelikeNodeKind, type RoguelikeRun } from "../types/roguelike";
import {
  useRoguelikeGraphWithContent,
  useCampaignAutoHealPercent,
  useRoguelikeCampaignRootNode,
  useIsRoguelikeNodeEditor,
  type RoguelikeNodeWithContent,
} from "../hooks/useRoguelikeNodeMap";
import { useRoguelikeRunView } from "../hooks/useGameLens";
import { useRoguelikeMatch } from "../hooks/useRoguelikeMatch";
import { useRoguelikeNodeMapAdmin } from "../hooks/useRoguelikeNodeMapAdmin";
import { useGetAllAIShipConfigs, useGetMapPlacements } from "../hooks/useAIEncountersContract";
import type { AIShipConfig, Ship } from "../types/types";
import { aiConfigToPreviewShip } from "../utils/aiShipConfig";
import { RoguelikeCombatModal } from "./RoguelikeCombatModal";
import { RoguelikeResupplyPanel } from "./RoguelikeResupplyPanel";
import { RoguelikeNodeEditPanel } from "./RoguelikeNodeEditPanel";
import { RoguelikeSettingsModal } from "./RoguelikeSettingsModal";
import { ShipImage } from "./ShipImage";
import { MissionDrawerContent } from "./operations/MissionDrawerContent";
import { RunMap, type RunMapNode } from "./operations/RunMap";
import { useOwnedShips } from "../hooks/useOwnedShips";
import { useRunRosterHullWeb3 } from "../hooks/useRunRosterHull";
import { trackRunRetreated } from "../utils/analytics/gameEvents";
import { usePresetMapState } from "../hooks/useMapsContract";
import { rememberNodeMaps, upcomingMissionNodeIds } from "../utils/missionMaps";

const NO_SHIP_IDS: bigint[] = [];
// Only campaign 1 exists today.
const DEFAULT_ROGUELIKE_CAMPAIGN_ID = 1n;

const missionEditModeKey = (address: string | undefined) => `mission-edit-mode-${address || "anonymous"}`;
const missionSelectedNodeKey = (address: string | undefined) => `mission-selected-node-${address || "anonymous"}`;

interface RoguelikeGraphProps {
  /** Null when the player has no run (a preview; see RunMap). */
  run: RoguelikeRun | null;
  onRunEnded: () => void;
  /** Run-less preview only: opens fleet selection to start a run. */
  onStartRun?: () => void;
  /** After enterResupplyNode: resupply keeps the player here, so the run needs a refetch to move on. */
  onRunAdvanced: () => void;
  tutorial?: { onStart: () => void; onSkip: () => void };
  tutorialDone?: boolean;
}

/** Loads a preset map into the cache ahead of its battle. */
function PresetMapPrefetch({ mapId }: { mapId: number }) {
  usePresetMapState(mapId);
  return null;
}

const toRunMapNode = (n: RoguelikeNodeWithContent): RunMapNode => ({
  id: Number(n.id),
  kind: n.kind,
  title: n.title,
  titleStatus: n.titleStatus,
  description: n.description,
  descriptionStatus: n.descriptionStatus,
  childIds: n.children.map((c) => Number(c)),
});

/**
 * Web3's Operations map (see RunMap): the campaign from RoguelikeNodeMap /
 * GameLens, the run from RoguelikeRun, actions as RoguelikeMatch
 * transactions. Bigints convert here.
 */
export function RoguelikeGraph({
  run,
  onRunEnded,
  onRunAdvanced,
  onStartRun,
  tutorial,
  tutorialDone = false,
}: RoguelikeGraphProps) {
  const { address } = useAccount();
  const { retreatRun, enterResupplyNode } = useRoguelikeMatch();
  const { data: isEditor = false } = useIsRoguelikeNodeEditor(address);
  const admin = useRoguelikeNodeMapAdmin();
  const isBrowseMode = run == null;
  const campaignId = run?.campaignId ?? DEFAULT_ROGUELIKE_CAMPAIGN_ID;

  const [editMode, setEditModeState] = React.useState(false);
  React.useEffect(() => {
    setEditModeState(localStorage.getItem(missionEditModeKey(address)) === "1");
  }, [address]);
  const setEditMode = React.useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setEditModeState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        const key = missionEditModeKey(address);
        if (next) localStorage.setItem(key, "1");
        else localStorage.removeItem(key);
        return next;
      });
    },
    [address],
  );

  const { nodes: campaignNodes, isLoading: nodesLoading, refetch: refetchNodes } =
    // Players only see nodes reachable from the root (one GameLens call);
    // the editor needs every node, linked or not.
    useRoguelikeGraphWithContent(campaignId, true, { reachableOnly: !editMode });
  const { data: rootNodeIdRaw } = useRoguelikeCampaignRootNode(campaignId);
  const { data: autoHealPercent, refetch: refetchAutoHeal } = useCampaignAutoHealPercent(campaignId);
  // Locked/defeated flags for every reachable node, in one GameLens call.
  const { lockedByNodeId, defeatedByNodeId } = useRoguelikeRunView(address, !isBrowseMode);

  const nodes = React.useMemo(() => campaignNodes.map(toRunMapNode), [campaignNodes]);
  const nodeById = React.useMemo(() => new Map(campaignNodes.map((n) => [Number(n.id), n])), [campaignNodes]);
  const isLocked = React.useCallback((id: number) => !!lockedByNodeId.get(String(id)), [lockedByNodeId]);
  const isDefeated = React.useCallback((id: number) => !!defeatedByNodeId.get(String(id)), [defeatedByNodeId]);

  // Action bar: the run roster with hull, and fleet cost against the cap.
  const { ships: ownedShips } = useOwnedShips();
  const rosterShipIds = run?.rosterShipIds ?? NO_SHIP_IDS;
  const hullByShipId = useRunRosterHullWeb3(address, rosterShipIds);
  const rosterShips = React.useMemo(() => {
    const byId = new Map(ownedShips.map((s) => [s.id.toString(), s]));
    return rosterShipIds.map((id) => ({ id, ship: byId.get(id.toString()) as Ship | undefined }));
  }, [ownedShips, rosterShipIds]);

  // A live combat match (run.activeGameId != 0) must be forfeited first:
  // retreatRun(0) alone reverts ActiveGameInProgress while one is open.
  // Forfeiting doesn't necessarily end the run, so retreatRun(0) follows; if
  // forfeiting already ended it, that call reverts NoActiveRun, which counts
  // as success. See docs/update/Frontend_Updates_2026-08-26.md.
  const handleRetreat = async () => {
    if (!run) return;
    try {
      if (run.activeGameId !== 0n) await retreatRun(run.activeGameId);
      try {
        await retreatRun(0n);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("NoActiveRun")) throw error;
      }
      trackRunRetreated({ appMode: "web3", midCombat: run.activeGameId !== 0n });
      toast.success("Run retreated.");
      onRunEnded();
    } catch (error) {
      console.error("Failed to retreat run:", error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error(
        message.includes("ActiveGameInProgress")
          ? "A match is still in progress — return to it or let it finish before retreating."
          : `Failed to retreat: ${message}`,
      );
    }
  };

  const handleEnterResupply = async (nodeId: number) => {
    try {
      await enterResupplyNode(BigInt(nodeId));
      onRunAdvanced();
    } catch (error) {
      console.error("Failed to enter resupply node:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("CannotAdvance")) toast.error("This node isn't reachable from your current position.");
      else if (message.includes("CurrentNodeNotCleared")) toast.error("Finish your current mission first.");
      else if (message.includes("WrongNodeKind")) toast.error("This node isn't a resupply node.");
      else if (message.includes("ActiveGameInProgress")) {
        toast.error("A match is still in progress — return to it or let it finish before entering resupply.");
      } else toast.error(`Failed to enter resupply node: ${message}`);
    }
  };

  // Battles know their node, not their map: remember each node's map, and
  // preload the maps of the missions coming up so their battles open on a
  // drawn board (GameDisplay reads the same cache; see missionMaps.ts).
  React.useEffect(() => {
    rememberNodeMaps(
      campaignNodes
        .filter((n) => n.kind === RoguelikeNodeKind.Combat)
        .map((n) => ({ nodeId: Number(n.id), mapId: Number(n.mapId) })),
    );
  }, [campaignNodes]);
  const upcomingMapIds = React.useMemo(() => {
    const ids = upcomingMissionNodeIds(
      nodes,
      run ? Number(run.currentNodeId) : null,
      rootNodeIdRaw != null ? Number(rootNodeIdRaw) : null,
    )
      .map((id) => nodeById.get(id))
      .filter((n) => n != null && n.kind === RoguelikeNodeKind.Combat && n.mapId > 0n)
      .map((n) => Number(n!.mapId));
    return [...new Set(ids)];
  }, [nodes, nodeById, run, rootNodeIdRaw]);

  return (
    <>
    {upcomingMapIds.map((mapId) => (
      <PresetMapPrefetch key={mapId} mapId={mapId} />
    ))}
    <RunMap
      run={run ? { currentNodeId: Number(run.currentNodeId), hasActiveGame: run.activeGameId !== 0n } : null}
      nodes={nodes}
      nodesLoading={nodesLoading}
      refetchNodes={refetchNodes}
      rootNodeId={rootNodeIdRaw != null ? Number(rootNodeIdRaw) : null}
      isLocked={isLocked}
      isDefeated={isDefeated}
      isEditor={isEditor}
      editMode={editMode}
      setEditMode={setEditMode}
      selectedNodeStorageKey={missionSelectedNodeKey(address)}
      roster={rosterShips.map(({ id, ship }) => ({
        key: id.toString(),
        name: ship?.name || `Ship #${id.toString()}`,
        image: ship ? <ShipImage ship={ship} className="h-full w-full" showLoadingState={false} /> : null,
        hullPercent: hullByShipId.get(id.toString()) ?? 100,
      }))}
      fleetCost={isBrowseMode ? null : rosterShips.reduce((sum, { ship }) => sum + (ship ? Number(ship.shipData.cost) : 0), 0)}
      costCap={isBrowseMode ? null : Number(run.currentCostCap)}
      onStartRun={onStartRun}
      tutorial={tutorial}
      tutorialDone={tutorialDone}
      onRetreat={handleRetreat}
      onEnterResupply={handleEnterResupply}
      onResume={() => run && navigateToGame(address, run.activeGameId)}
      onAddChild={(parent, child) => admin.addChild(BigInt(parent), BigInt(child))}
      renderDrawer={(node, { isCleared, isCompleted }) => {
        const full = nodeById.get(node.id);
        return full ? (
          <Web3MissionDrawer
            node={full}
            isCleared={isCleared}
            isCompleted={isCompleted}
            costCap={run ? Number(run.currentCostCap) : null}
            autoHealPercent={autoHealPercent ?? 0}
          />
        ) : null;
      }}
      renderNodeEditor={(args) => (
        <RoguelikeNodeEditPanel
          {...args}
          node={args.node ? (nodeById.get(args.node.id) ?? null) : null}
          campaignId={campaignId}
          onStartConnectMode={(id) => args.onStartConnectMode(Number(id))}
        />
      )}
      renderCombatModal={(nodeId, close) => {
        const target = nodeById.get(nodeId);
        return run && target ? <RoguelikeCombatModal run={run} targetNode={target} onClose={close} onLaunched={close} /> : null;
      }}
      renderResupplyPanel={(dismiss) => {
        const current = run ? nodeById.get(Number(run.currentNodeId)) : undefined;
        return run && current ? (
          <RoguelikeResupplyPanel
            run={run}
            node={current}
            onDone={() => {
              onRunAdvanced();
              dismiss();
            }}
          />
        ) : null;
      }}
      renderSettings={(close) => (
        <RoguelikeSettingsModal campaignId={campaignId} onClose={close} onSaved={() => void refetchAutoHeal()} />
      )}
    />
    </>
  );
}

/** The selected node's mission drawer: briefing, enemy fleet (AIEncounters) and dossier. */
function Web3MissionDrawer({
  node,
  isCleared,
  isCompleted,
  costCap,
  autoHealPercent,
}: {
  node: RoguelikeNodeWithContent;
  isCleared: boolean;
  isCompleted: boolean;
  costCap: number | null;
  autoHealPercent: number;
}) {
  const isCombat = node.kind === RoguelikeNodeKind.Combat;
  const victoryEffects = useRoguelikeVictoryEffects(isCombat ? node.id : undefined);
  const { data: placements, isLoading: placementsLoading } = useGetMapPlacements(isCombat ? node.mapId : undefined);
  const { data: allConfigs, isLoading: configsLoading } = useGetAllAIShipConfigs();
  const loading = placementsLoading || configsLoading;

  const enemyShipConfigs = React.useMemo(() => {
    if (!placements) return [];
    const byId = new Map<string, AIShipConfig>((allConfigs ?? []).map((c) => [c.id.toString(), c]));
    return placements.configIds.map((configId) => byId.get(configId.toString()));
  }, [placements, allConfigs]);
  const threat = React.useMemo(
    () => enemyShipConfigs.reduce((sum, c) => sum + (c ? aiConfigToPreviewShip(c).shipData.cost : 0), 0),
    [enemyShipConfigs],
  );

  return (
    <MissionDrawerContent
      title={node.title}
      titleStatus={node.titleStatus}
      completed={isCompleted}
      kindLabel={isCombat ? "Combat" : "Resupply"}
      briefing={
        <MissionBriefing
          mission={{ kind: "roguelike", nodeId: Number(node.id) }}
          text={node.description}
          status={node.descriptionStatus}
          compact
        />
      }
      enemyFleet={
        isCombat
          ? loading
            ? null
            : enemyShipConfigs.flatMap((config, i) => {
                if (!config) return [];
                const ship = aiConfigToPreviewShip(config);
                return [
                  {
                    key: `${config.id.toString()}-${i}`,
                    name: ship.name,
                    image: <ShipImage ship={ship} className="h-full w-full" showLoadingState={false} />,
                  },
                ];
              })
          : undefined
      }
      rewardShip={
        victoryEffects.shipGrant
          ? {
              reward: victoryEffects.shipGrant,
              image: <ShipImage ship={shipGrantToPreviewShip(victoryEffects.shipGrant.grant)} className="h-full w-full" showLoadingState={false} hideRankStars />,
            }
          : null
      }
      dossier={
        <MissionDossier
          forces={
            isCombat
              ? {
                  enemyShips: loading ? null : enemyShipConfigs.filter(Boolean).length,
                  enemy: loading ? null : threat,
                  yours: costCap,
                  yoursLabel: "Your cost cap",
                }
              : undefined
          }
          rows={
            isCombat
              ? roguelikeCombatDossierRows({
                  maxScore: Number(node.maxScore),
                  creatorGoesFirst: node.creatorGoesFirst,
                  autoHealPercent,
                  victoryEffects,
                  isCleared,
                })
              : roguelikeResupplyDossierRows({ costCapOverride: Number(node.costCapOverride) })
          }
        />
      }
    />
  );
}
