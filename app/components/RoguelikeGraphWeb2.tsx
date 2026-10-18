"use client";

import React from "react";
import { toast } from "react-hot-toast";
import { MissionBriefing } from "./MissionBriefing";
import { MissionDossier } from "./MissionDossier";
import { useRoguelikeVictoryEffectsWeb2 } from "../hooks/useRoguelikeVictoryEffects";
import { roguelikeCombatDossierRows, roguelikeResupplyDossierRows } from "../utils/missionDossierRows";
import { RoguelikeNodeKind } from "../types/roguelike";
import {
  useRoguelikeCampaignNodesWeb2WithContent,
  useRoguelikeCampaignWeb2,
  useRoguelikeMatchWeb2,
  type RoguelikeNodeWeb2WithContent,
  type RoguelikeRosterEntryWeb2,
  type RoguelikeRunWeb2,
} from "../hooks/useRoguelikeWeb2";
import { useRoguelikeAdminWeb2 } from "../hooks/useRoguelikeAdminWeb2";
import { useWeb2Admin } from "../hooks/useWeb2Admin";
import { useMapEnemyThreatWeb2 } from "../hooks/useMapEnemyThreatWeb2";
import { RoguelikeCombatModalWeb2 } from "./RoguelikeCombatModalWeb2";
import { RoguelikeResupplyPanelWeb2 } from "./RoguelikeResupplyPanelWeb2";
import { RoguelikeNodeEditPanelWeb2 } from "./RoguelikeNodeEditPanelWeb2";
import { RoguelikeSettingsModalWeb2 } from "./RoguelikeSettingsModalWeb2";
import { ShipImageWeb2 } from "./ShipImageWeb2";
import { MissionDrawerContent } from "./operations/MissionDrawerContent";
import { RunMap, type RunMapNode } from "./operations/RunMap";
import { useRunRosterHullWeb2 } from "../hooks/useRunRosterHull";
import { aiConfigToPreviewShipWeb2 } from "../utils/aiShipConfigWeb2";
import { trackRunRetreated } from "../utils/analytics/gameEvents";

const DEFAULT_ROGUELIKE_CAMPAIGN_ID = 1;
const MISSION_EDIT_MODE_KEY = "mission-edit-mode-web2";
const MISSION_SELECTED_NODE_KEY = "mission-selected-node-web2";
const NO_ROSTER: RoguelikeRosterEntryWeb2[] = [];

const toRunMapNode = (n: RoguelikeNodeWeb2WithContent): RunMapNode => ({
  id: n.id,
  kind: n.kind as RoguelikeNodeKind,
  title: n.title,
  titleStatus: n.titleStatus,
  description: n.description,
  descriptionStatus: n.descriptionStatus,
  childIds: n.childEdges.map((e) => e.childId),
});

/**
 * Web2's Operations map (see RunMap): the campaign and run from the API.
 * Web2 keeps no branch lockout on the run, so a node is open when it's the
 * current node or one of its children.
 */
export function RoguelikeGraphWeb2({
  run,
  onRunEnded,
  onStartRun,
  tutorial,
  tutorialDone = false,
}: {
  /** Null when the player has no run (a preview; see RunMap). */
  run: RoguelikeRunWeb2 | null;
  onRunEnded: () => void;
  onStartRun?: () => void;
  tutorial?: { onStart: () => void; onSkip: () => void };
  tutorialDone?: boolean;
}) {
  const { retreatRun, enterResupplyNode } = useRoguelikeMatchWeb2();
  const isEditor = useWeb2Admin();
  const admin = useRoguelikeAdminWeb2();
  const isBrowseMode = run == null;
  const campaignId = run?.campaignId ?? DEFAULT_ROGUELIKE_CAMPAIGN_ID;

  const [editMode, setEditModeState] = React.useState(false);
  React.useEffect(() => {
    setEditModeState(localStorage.getItem(MISSION_EDIT_MODE_KEY) === "1");
  }, []);
  const setEditMode = React.useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setEditModeState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (next) localStorage.setItem(MISSION_EDIT_MODE_KEY, "1");
      else localStorage.removeItem(MISSION_EDIT_MODE_KEY);
      return next;
    });
  }, []);

  const { nodes: campaignNodes, isLoading: nodesLoading, refetch: refetchNodes } =
    useRoguelikeCampaignNodesWeb2WithContent(campaignId);
  const { campaign, refetch: refetchCampaign } = useRoguelikeCampaignWeb2(campaignId);

  const nodes = React.useMemo(() => campaignNodes.map(toRunMapNode), [campaignNodes]);
  const nodeById = React.useMemo(() => new Map(campaignNodes.map((n) => [n.id, n])), [campaignNodes]);
  const currentNode = run ? nodeById.get(run.currentNodeId) : undefined;
  const isLocked = React.useCallback(
    (id: number) =>
      !!run && id !== run.currentNodeId && !currentNode?.childEdges.some((e) => e.childId === id),
    [run, currentNode],
  );
  const defeated = React.useMemo(() => new Set(run?.defeatedNodeIds ?? []), [run]);
  const isDefeated = React.useCallback((id: number) => defeated.has(id), [defeated]);

  const roster = run?.roster ?? NO_ROSTER;
  const hullByShipId = useRunRosterHullWeb2(roster);

  const handleRetreat = async () => {
    if (!run) return;
    try {
      // Read before the call: retreating clears the run's open match.
      const midCombat = run.activeLobbyId != null;
      await retreatRun();
      trackRunRetreated({ appMode: "web2", midCombat });
      toast.success("Run retreated.");
      onRunEnded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to retreat");
    }
  };

  const handleEnterResupply = async (nodeId: number) => {
    try {
      await enterResupplyNode(nodeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to enter resupply node");
    }
  };

  return (
    <RunMap
      run={run ? { currentNodeId: run.currentNodeId, hasActiveGame: run.activeLobbyId != null } : null}
      nodes={nodes}
      nodesLoading={nodesLoading}
      refetchNodes={refetchNodes}
      rootNodeId={campaign?.rootNodeId ?? null}
      isLocked={isLocked}
      isDefeated={isDefeated}
      isEditor={isEditor}
      editMode={editMode}
      setEditMode={setEditMode}
      selectedNodeStorageKey={MISSION_SELECTED_NODE_KEY}
      roster={roster.map((entry) => ({
        key: String(entry.shipId),
        name: entry.ship.name || `Ship #${entry.shipId}`,
        image: <ShipImageWeb2 ship={entry.ship} className="h-full w-full" showLoadingState={false} />,
        hullPercent: hullByShipId.get(String(entry.shipId)) ?? 100,
      }))}
      fleetCost={isBrowseMode ? null : roster.reduce((sum, entry) => sum + entry.ship.shipData.cost, 0)}
      costCap={isBrowseMode ? null : run.currentCostCap}
      onStartRun={onStartRun}
      tutorial={tutorial}
      tutorialDone={tutorialDone}
      onRetreat={handleRetreat}
      onEnterResupply={handleEnterResupply}
      onAddChild={(parent, child) => admin.addChild(parent, child)}
      renderDrawer={(node, { isCleared }) => {
        const full = nodeById.get(node.id);
        return full ? (
          <Web2MissionDrawer
            node={full}
            isCleared={isCleared}
            costCap={run ? run.currentCostCap : null}
            autoHealPercent={campaign?.autoHealPercent ?? 0}
          />
        ) : null;
      }}
      renderNodeEditor={(args) => (
        <RoguelikeNodeEditPanelWeb2
          {...args}
          node={args.node ? (nodeById.get(args.node.id) ?? null) : null}
          campaignId={campaignId}
        />
      )}
      renderCombatModal={(nodeId, close) => {
        const target = nodeById.get(nodeId);
        return run && target ? <RoguelikeCombatModalWeb2 run={run} targetNode={target} onClose={close} onLaunched={close} /> : null;
      }}
      renderResupplyPanel={() =>
        run && currentNode ? <RoguelikeResupplyPanelWeb2 run={run} node={currentNode} onDone={() => {}} /> : null
      }
      renderSettings={(close) =>
        campaign ? (
          <RoguelikeSettingsModalWeb2 campaign={campaign} onClose={close} onSaved={() => void refetchCampaign()} />
        ) : null
      }
    />
  );
}

/** The selected node's mission drawer: briefing, enemy fleet and dossier. */
function Web2MissionDrawer({
  node,
  isCleared,
  costCap,
  autoHealPercent,
}: {
  node: RoguelikeNodeWeb2WithContent;
  isCleared: boolean;
  costCap: number | null;
  autoHealPercent: number;
}) {
  const isCombat = node.kind === RoguelikeNodeKind.Combat;
  const victoryEffects = useRoguelikeVictoryEffectsWeb2(isCombat ? node.winEffects : undefined);
  const { totalThreat, placements, isLoading } = useMapEnemyThreatWeb2(isCombat ? node.mapId : undefined);

  return (
    <MissionDrawerContent
      title={node.title}
      titleStatus={node.titleStatus}
      kindLabel={isCombat ? "Combat" : "Resupply"}
      briefing={
        <MissionBriefing
          mission={{ kind: "roguelike", nodeId: node.id }}
          text={node.description}
          status={node.descriptionStatus}
          compact
        />
      }
      enemyFleet={
        isCombat
          ? isLoading
            ? null
            : placements.map((placement) => {
                const ship = aiConfigToPreviewShipWeb2(placement.config);
                return {
                  key: String(placement.id),
                  name: ship.name,
                  image: <ShipImageWeb2 ship={ship} className="h-full w-full" showLoadingState={false} />,
                };
              })
          : undefined
      }
      dossier={
        <MissionDossier
          forces={
            isCombat
              ? {
                  enemyShips: isLoading ? null : placements.length,
                  enemy: isLoading ? null : totalThreat,
                  yours: costCap,
                  yoursLabel: "Your cost cap",
                }
              : undefined
          }
          rows={
            isCombat
              ? roguelikeCombatDossierRows({
                  maxScore: node.maxScore ?? 0,
                  creatorGoesFirst: node.creatorGoesFirst ?? true,
                  autoHealPercent,
                  victoryEffects,
                  isCleared,
                })
              : roguelikeResupplyDossierRows({ costCapOverride: node.costCapOverride ?? 0 })
          }
        />
      }
    />
  );
}
