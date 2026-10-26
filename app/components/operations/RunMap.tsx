"use client";

import React from "react";
import { toast } from "react-hot-toast";
import { RoguelikeNodeKind } from "../../types/roguelike";
import type { NodeContentStatus } from "../../hooks/useNodeContent";
import { buildRoguelikePrerequisites } from "../../utils/roguelikeGraphLayout";
import { computeRouteVisibility } from "../../utils/routeChart";
import { CampaignGraphCanvas } from "../CampaignGraphCanvas";
import { RoguelikeNodeCard, type RoguelikeNodeCardNode } from "../RoguelikeNodeCard";
import { CampaignEditModeToggle } from "../CampaignEditModeToggle";
import { OperationsMap, type MissionPeek } from "./OperationsMap";
import { RunActionBar, type RosterShipChip } from "./RunActionBar";
import { NodeEditorModal } from "./NodeEditorModal";
import { RetreatRunConfirmModal } from "./RetreatRunConfirmModal";
import { TUTORIAL_PRELUDE_PEEK, TutorialPreludeDrawer } from "./TutorialPreludeDrawer";
import { ART_SLOTS } from "../../config/art";
import { getRunMapAction, isCurrentNodeCleared } from "../../utils/runMapAction";
import { useUrlSelectedNode } from "../../hooks/useUrlSelectedNode";
import { CLIENT_TAB_SLUGS } from "../../utils/clientNavigation";
import {
  TUTORIAL_PRELUDE_CANVAS_NODE,
  TUTORIAL_PRELUDE_NODE_ID,
  withTutorialPrelude,
} from "../../utils/tutorialPrelude";

// The Operations run map: the whole campaign as a star chart (depth-tiered
// rows/columns, prerequisite lanes inverted from the forward-only
// children edges), the selected mission's drawer, and the action bar with
// the primary action from getRunMapAction. Play mode only opens what's
// enterable: the current node or one of its children. Edit Mode (editors)
// layers node/edge/map/fleet editing onto the same screen. Shared by
// RoguelikeGraph (web3) and RoguelikeGraphWeb2, which load the campaign and
// run, own the Edit Mode flag (web3 loads every node only in Edit Mode),
// and supply the mode's calls and panels. Number ids.

export interface RunMapNode {
  id: number;
  kind: RoguelikeNodeKind;
  title: string;
  titleStatus: NodeContentStatus;
  description: string;
  descriptionStatus: NodeContentStatus | undefined;
  childIds: number[];
}

export interface RunMapRun {
  currentNodeId: number;
  /** A combat match is open on the run. */
  hasActiveGame: boolean;
}

export interface RunMapNodeEditorArgs {
  mode: "create" | "edit";
  node: RunMapNode | null;
  connectModeActive: boolean;
  onStartConnectMode: (sourceNodeId: number) => void;
  onCancelConnectMode: () => void;
  onSaved: () => void;
  onCreated: () => void;
  onCancelCreate: () => void;
}

interface RunMapCanvasNode extends RoguelikeNodeCardNode {
  prerequisites: number[];
  title: string;
  titleStatus: NodeContentStatus;
  editMode: boolean;
  connectHighlight: "source" | "candidate" | "invalid" | undefined;
}

const ADD_NODE_SENTINEL_ID = Number.MAX_SAFE_INTEGER;
const NO_IDS: ReadonlySet<number> = new Set();

// At a fork, the next missions whose briefs the player has opened, for the
// run's current node. Kept outside the component so leaving the map (a
// battle, another tab) and coming back doesn't make them look again.
let reviewedOptions: { from: number; ids: ReadonlySet<number> } | null = null;
const OPS_TOOLBAR_BUTTON =
  "border border-solid px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function RunMap({
  run,
  nodes,
  nodesLoading,
  refetchNodes,
  rootNodeId,
  isLocked,
  isDefeated,
  isEditor,
  editMode,
  setEditMode,
  selectedNodeStorageKey,
  roster,
  fleetCost,
  costCap,
  onStartRun,
  tutorial,
  tutorialDone = false,
  onRetreat,
  onEnterResupply,
  onResume,
  onAddChild,
  renderDrawer,
  renderNodeEditor,
  renderCombatModal,
  renderResupplyPanel,
  renderSettings,
}: {
  /** Null when the player has no run: a preview where only the root node (where a run starts) opens, and the action is Start run. */
  run: RunMapRun | null;
  nodes: RunMapNode[];
  nodesLoading: boolean;
  refetchNodes: () => unknown;
  rootNodeId: number | null;
  /** Locked out for this run (a branch not taken). */
  isLocked: (nodeId: number) => boolean;
  isDefeated: (nodeId: number) => boolean;
  isEditor: boolean;
  editMode: boolean;
  setEditMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  /** Where Edit Mode without a run remembers the selected node. */
  selectedNodeStorageKey: string;
  roster: RosterShipChip[];
  fleetCost: number | null;
  costCap: number | null;
  onStartRun?: () => void;
  /** Run-less preview, before the tutorial: First Contact is the first mission (tutorialPrelude.ts). */
  tutorial?: { onStart: () => void; onSkip: () => void };
  /** Played or skipped: First Contact stays on the map, cleared. */
  tutorialDone?: boolean;
  /** Resolves once the run has ended (the adapter shows its own errors and rethrows). */
  onRetreat: () => Promise<void>;
  /** Resolves once the run is at the resupply node (errors handled by the adapter). */
  onEnterResupply: (nodeId: number) => Promise<void>;
  /** Opens the run's open match; without it the action bar never offers Resume. */
  onResume?: () => void;
  onAddChild: (parentId: number, childId: number) => Promise<unknown>;
  /** The selected node's mission drawer (enemy fleet, dossier). */
  renderDrawer: (node: RunMapNode, ctx: { isCleared: boolean; isCompleted: boolean }) => React.ReactNode;
  renderNodeEditor: (args: RunMapNodeEditorArgs) => React.ReactNode;
  renderCombatModal: (nodeId: number, close: () => void) => React.ReactNode;
  /** Shown instead of the map while the run is at a resupply node. */
  /** Call `dismiss` after the player confirms so the map comes back. */
  renderResupplyPanel: (dismiss: () => void) => React.ReactNode;
  renderSettings: (close: () => void) => React.ReactNode;
}) {
  const [combatTargetNodeId, setCombatTargetNodeId] = React.useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState<number | null>(null);
  const [enteringResupply, setEnteringResupply] = React.useState<number | null>(null);
  const [isRetreating, setIsRetreating] = React.useState(false);
  const [connectMode, setConnectMode] = React.useState<{ sourceNodeId: number } | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  // Edit Mode opens the selected node in a full-screen editor instead.
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [showRetreatConfirm, setShowRetreatConfirm] = React.useState(false);
  const [dismissedResupplyNodeId, setDismissedResupplyNodeId] = React.useState<number | null>(null);

  const isBrowseMode = run == null;
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const currentNode = isBrowseMode ? undefined : byId.get(run.currentNodeId);

  // Next missions open only once the current one is won.
  const currentCleared =
    !isBrowseMode &&
    !!currentNode &&
    isCurrentNodeCleared({
      kind: currentNode.kind === RoguelikeNodeKind.Combat ? "combat" : "resupply",
      isDefeated: isDefeated(currentNode.id),
      hasActiveGame: run.hasActiveGame,
    });

  const prerequisitesById = React.useMemo(
    () => buildRoguelikePrerequisites(nodes.map((n) => ({ id: n.id, children: n.childIds.map((childId) => ({ childId })) }))),
    [nodes],
  );

  // Resupply stops have no defeated flag, so the ones the run has passed
  // are worked out for the star chart: the current stop once it's cleared,
  // and an earlier stop whose next node the run reached (defeated or
  // current) with no defeated combat node beside it leading there.
  const passedResupplyIds = React.useMemo(() => {
    const passed = new Set<number>();
    if (isBrowseMode) return passed;
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    if (currentCleared && currentNode?.kind === RoguelikeNodeKind.Resupply) passed.add(currentNode.id);
    for (const n of nodes) {
      if (n.kind !== RoguelikeNodeKind.Resupply) continue;
      const reachedChild = n.childIds.some((childId) => {
        if (childId !== run.currentNodeId && !isDefeated(childId)) return false;
        return !(prerequisitesById.get(childId) ?? []).some((pid) => {
          if (pid === n.id) return false;
          const prereq = nodeById.get(pid);
          return prereq?.kind === RoguelikeNodeKind.Combat && isDefeated(pid);
        });
      });
      if (reachedChild) passed.add(n.id);
    }
    return passed;
  }, [nodes, isBrowseMode, run, currentNode, currentCleared, isDefeated, prerequisitesById]);

  const isCreatingNode = selectedNodeId === ADD_NODE_SENTINEL_ID;

  // Where the run can go next once the current mission is won, top first
  // (the chart orders a step by id).
  const nextStopIds = React.useMemo(
    () =>
      !isBrowseMode && currentCleared && currentNode
        ? currentNode.childIds.filter((id) => byId.has(id) && !isLocked(id)).sort((a, b) => a - b)
        : [],
    [isBrowseMode, currentCleared, currentNode, byId, isLocked],
  );

  const canvasNodes: RunMapCanvasNode[] = React.useMemo(
    () =>
      nodes.map((n) => {
        const isCurrent = !isBrowseMode && n.id === run.currentNodeId;
        const isCompleted =
          !isBrowseMode &&
          (n.kind === RoguelikeNodeKind.Combat ? isDefeated(n.id) : passedResupplyIds.has(n.id));
        const isNextStop = currentCleared && !!currentNode?.childIds.includes(n.id) && !isLocked(n.id);
        return {
          id: n.id,
          kind: n.kind,
          prerequisites: prerequisitesById.get(n.id) ?? [],
          // Completed turns the lane into it solid green and the lanes out
          // of it into the open path (CampaignGraphCanvas JumpLanes).
          completed: isCompleted,
          // With no run there's no current position: the root renders
          // unlocked, or every node in Edit Mode so an editor can edit any.
          unlocked: isBrowseMode ? editMode || n.id === rootNodeId : isCurrent ? true : !isLocked(n.id),
          isCurrent,
          // Only nodes the player has reached open the mission drawer.
          selectable: isBrowseMode
            ? editMode || n.id === rootNodeId
            : editMode || isCurrent || isCompleted || isNextStop,
          title: n.title,
          titleStatus: n.titleStatus,
          editMode,
          connectHighlight: !connectMode ? undefined : connectMode.sourceNodeId === n.id ? "source" : "candidate",
        };
      }),
    [nodes, isBrowseMode, run, currentNode, rootNodeId, isDefeated, isLocked, currentCleared, passedResupplyIds, prerequisitesById, editMode, connectMode],
  );
  // First Contact on the map: the pending first mission (no run yet), or
  // cleared once played or skipped. Not in Edit Mode (the real graph only).
  const showTutorialPrelude = isBrowseMode && !editMode && !!tutorial;
  const showClearedPrelude = !editMode && !showTutorialPrelude && tutorialDone;
  const mapNodes: RunMapCanvasNode[] = React.useMemo(
    () =>
      editMode
        ? [
            ...canvasNodes,
            {
              id: ADD_NODE_SENTINEL_ID,
              kind: RoguelikeNodeKind.Combat,
              prerequisites: [],
              completed: false,
              unlocked: true,
              isCurrent: false,
              selectable: true,
              title: "+ ADD NODE",
              titleStatus: "ok",
              editMode: true,
              connectHighlight: connectMode ? "invalid" : undefined,
            },
          ]
        : showTutorialPrelude || showClearedPrelude
          ? withTutorialPrelude<RunMapCanvasNode>(canvasNodes, rootNodeId, TUTORIAL_PRELUDE_CANVAS_NODE, {
              done: showClearedPrelude,
            })
          : canvasNodes,
    [editMode, canvasNodes, connectMode, showTutorialPrelude, showClearedPrelude, rootNodeId],
  );
  // Play mode charts only the route reached so far (app/utils/routeChart.ts):
  // cleared missions, where the run is and what comes next, plus the
  // branches it didn't take, dimmed. Edit Mode charts every node.
  const routeVisibility = React.useMemo(
    () => (editMode ? null : computeRouteVisibility(mapNodes)),
    [editMode, mapNodes],
  );
  const chartNodes: RunMapCanvasNode[] = React.useMemo(
    () =>
      routeVisibility
        ? mapNodes.map((n) => (routeVisibility.skippedIds.has(n.id) ? { ...n, skipped: true, selectable: false } : n))
        : mapNodes,
    [mapNodes, routeVisibility],
  );
  const isTutorialPreludeSelected =
    (showTutorialPrelude || showClearedPrelude) && selectedNodeId === TUTORIAL_PRELUDE_NODE_ID;

  // Play mode snaps to the current run node, and the run-less preview to the
  // root, only when that position (or the mode) changes, never on the
  // player's own selection (or picking the next mission would snap back).
  const currentRunNodeId = run ? run.currentNodeId : null;
  // The first snap after a load takes the node the URL names instead (a
  // refresh keeps the selection; see useUrlSelectedNode). The tutorial
  // prelude isn't a real node, so it stays out of the URL.
  const takeInitialUrlNode = useUrlSelectedNode(
    selectedNodeId === TUTORIAL_PRELUDE_NODE_ID ? null : selectedNodeId,
    CLIENT_TAB_SLUGS.Mission,
  );
  React.useEffect(() => {
    if (currentRunNodeId != null) {
      setSelectedNodeId(takeInitialUrlNode() ?? currentRunNodeId);
      return;
    }
    if (showTutorialPrelude) {
      takeInitialUrlNode();
      setSelectedNodeId(TUTORIAL_PRELUDE_NODE_ID);
      return;
    }
    if (!editMode && rootNodeId != null) setSelectedNodeId(takeInitialUrlNode() ?? rootNodeId);
  }, [currentRunNodeId, editMode, rootNodeId, takeInitialUrlNode, showTutorialPrelude]);
  // Back on the map with the current mission won: select the next one (the
  // first, at a fork). Once per current node per visit, so the player can
  // still pick the mission they just won to read its debrief.
  const advancedFromRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (editMode || currentRunNodeId == null || nextStopIds.length === 0) return;
    if (advancedFromRef.current === currentRunNodeId || selectedNodeId !== currentRunNodeId) return;
    advancedFromRef.current = currentRunNodeId;
    setSelectedNodeId(nextStopIds[0]!);
  }, [editMode, currentRunNodeId, nextStopIds, selectedNodeId]);

  // At a fork, remember each option the player opens; entering one waits
  // until they've seen them all.
  const [reviewedIds, setReviewedIds] = React.useState<ReadonlySet<number>>(() =>
    reviewedOptions && reviewedOptions.from === currentRunNodeId ? reviewedOptions.ids : NO_IDS,
  );
  const reviewedFrom = reviewedOptions?.from ?? null;
  React.useEffect(() => {
    if (currentRunNodeId == null) return;
    if (reviewedFrom !== currentRunNodeId) {
      reviewedOptions = { from: currentRunNodeId, ids: NO_IDS };
      setReviewedIds(NO_IDS);
    }
  }, [currentRunNodeId, reviewedFrom]);
  React.useEffect(() => {
    if (currentRunNodeId == null || selectedNodeId == null || !nextStopIds.includes(selectedNodeId)) return;
    setReviewedIds((prev) => {
      if (prev.has(selectedNodeId)) return prev;
      const ids = new Set(prev).add(selectedNodeId);
      reviewedOptions = { from: currentRunNodeId, ids };
      return ids;
    });
  }, [currentRunNodeId, selectedNodeId, nextStopIds]);
  const unreviewedOptions =
    nextStopIds.length > 1 ? nextStopIds.filter((id) => !reviewedIds.has(id)).length : 0;

  // A URL node that isn't on this map (stale link, another campaign): fall
  // back to the snap target.
  React.useEffect(() => {
    if (editMode || nodes.length === 0 || selectedNodeId == null) return;
    if (byId.has(selectedNodeId) || selectedNodeId === TUTORIAL_PRELUDE_NODE_ID) return;
    const fallback = currentRunNodeId ?? rootNodeId;
    if (fallback != null && fallback !== selectedNodeId) setSelectedNodeId(fallback);
  }, [editMode, nodes, selectedNodeId, byId, currentRunNodeId, rootNodeId]);

  // Edit Mode without a run restores the last selected node, so leaving
  // Mission and coming back keeps the panel (only fills an empty selection).
  React.useEffect(() => {
    if (!isBrowseMode || !editMode) return;
    if (selectedNodeId !== null || nodes.length === 0) return;
    const saved = localStorage.getItem(selectedNodeStorageKey);
    const savedId = saved ? Number(saved) : NaN;
    if (Number.isFinite(savedId) && byId.has(savedId)) setSelectedNodeId(savedId);
  }, [isBrowseMode, editMode, nodes, selectedNodeId, selectedNodeStorageKey, byId]);

  React.useEffect(() => {
    if (!editMode) {
      setConnectMode(null);
      if (isCreatingNode) setSelectedNodeId(isBrowseMode ? rootNodeId : run!.currentNodeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  const selectedNode = !isCreatingNode && selectedNodeId != null ? byId.get(selectedNodeId) : undefined;
  const isSelectedCurrentNode = !isBrowseMode && !!selectedNode && selectedNode.id === run.currentNodeId;
  // Connected and not locked out; currentCleared (passed to
  // getRunMapAction) decides whether it can be entered yet.
  const isSelectedReachableChild =
    !isBrowseMode &&
    !!selectedNode &&
    !!currentNode &&
    currentNode.childIds.includes(selectedNode.id) &&
    !isLocked(selectedNode.id);
  const isSelectedNodeDefeated = !!selectedNode && isDefeated(selectedNode.id);

  const handleEnterResupply = async (nodeId: number) => {
    setEnteringResupply(nodeId);
    try {
      await onEnterResupply(nodeId);
    } finally {
      setEnteringResupply(null);
    }
  };

  const handleRetreat = async () => {
    if (isBrowseMode) return;
    setIsRetreating(true);
    try {
      await onRetreat();
    } catch {
      // The adapter reported it.
    } finally {
      setIsRetreating(false);
    }
  };

  // While connect mode is active, clicking a node adds it as a CHILD of
  // connectMode.sourceNodeId (the node being edited is the parent side).
  const handleConnectTarget = async (targetId: number, sourceNodeId: number) => {
    try {
      await onAddChild(sourceNodeId, targetId);
      toast.success(`Node #${targetId} linked as a child.`);
      await refetchNodes();
    } catch (error) {
      console.error("Failed to add child edge:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add child edge");
    } finally {
      setConnectMode(null);
    }
  };

  const handleSelectNode = (id: number) => {
    if (connectMode) {
      if (id === connectMode.sourceNodeId || id === ADD_NODE_SENTINEL_ID) return;
      if (byId.has(id)) void handleConnectTarget(id, connectMode.sourceNodeId);
      return;
    }
    if (id === ADD_NODE_SENTINEL_ID) {
      setSelectedNodeId(ADD_NODE_SENTINEL_ID);
      setEditorOpen(true);
      return;
    }
    setSelectedNodeId(id);
    setEditorOpen(true);
    if (isBrowseMode && editMode) localStorage.setItem(selectedNodeStorageKey, String(id));
  };

  if (nodesLoading || (!isBrowseMode && !currentNode)) {
    return (
      <div className="border-2 border-cyan p-6 font-mono text-sm text-text-muted" style={{ borderRadius: 0 }}>
        Loading run position…
      </div>
    );
  }

  if (
    !isBrowseMode &&
    !editMode &&
    currentNode!.kind === RoguelikeNodeKind.Resupply &&
    dismissedResupplyNodeId !== currentNode!.id
  ) {
    return <>{renderResupplyPanel(() => setDismissedResupplyNodeId(currentNode!.id))}</>;
  }

  const mapAction = getRunMapAction({
    isBrowseMode,
    canStartRun: isBrowseMode && !editMode && !!onStartRun,
    tutorialPending: showTutorialPrelude,
    isTutorialPrelude: isTutorialPreludeSelected,
    selectedKind: !selectedNode ? null : selectedNode.kind === RoguelikeNodeKind.Combat ? "combat" : "resupply",
    isCurrentNode: isSelectedCurrentNode,
    isReachableChild: isSelectedReachableChild,
    isDefeated: isSelectedNodeDefeated,
    // Resume is only offered where the mode can reopen the match (web2's
    // launch resumes it instead).
    hasActiveGame: !isBrowseMode && run.hasActiveGame && !!onResume,
    currentCleared,
    isEnteringResupply: !!selectedNode && enteringResupply === selectedNode.id,
    unreviewedOptions,
  });

  const handleMapAction = () => {
    if (mapAction.type === "start") {
      onStartRun?.();
      return;
    }
    if (mapAction.type === "tutorial") {
      tutorial?.onStart();
      return;
    }
    if (!selectedNode || isBrowseMode) return;
    if (mapAction.type === "resume") onResume?.();
    else if (mapAction.type === "warp") setCombatTargetNodeId(selectedNode.id);
    else if (mapAction.type === "resupply") {
      // The stop the run is at: reopen its panel. Otherwise enter the new one.
      if (selectedNode.id === currentNode?.id) setDismissedResupplyNodeId(null);
      else void handleEnterResupply(selectedNode.id);
    }
  };

  const isSelectedConnectSource = !!selectedNode && connectMode?.sourceNodeId === selectedNode.id;
  const backToSnapTarget = () => setSelectedNodeId(isBrowseMode ? rootNodeId : run!.currentNodeId);

  const drawer = editMode ? null : isTutorialPreludeSelected ? (
    <TutorialPreludeDrawer completed={showClearedPrelude} />
  ) : selectedNode ? (
    renderDrawer(selectedNode, {
      isCleared: isSelectedNodeDefeated,
      isCompleted: selectedNode.kind === RoguelikeNodeKind.Combat ? isSelectedNodeDefeated : passedResupplyIds.has(selectedNode.id),
    })
  ) : null;

  const missionPeek: MissionPeek | null = editMode
    ? null
    : isTutorialPreludeSelected
      ? TUTORIAL_PRELUDE_PEEK
      : selectedNode
        ? {
            title: selectedNode.title,
            kindLabel: selectedNode.kind === RoguelikeNodeKind.Combat ? "Combat" : "Resupply",
            teaser: selectedNode.descriptionStatus === "ok" ? selectedNode.description : undefined,
          }
        : null;

  return (
    <>
      <OperationsMap
        toolbar={
          isEditor || !isBrowseMode ? (
            <>
              <CampaignEditModeToggle isEditor={isEditor} editMode={editMode} onToggle={() => setEditMode((v) => !v)} />
              {editMode && (
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className={`${OPS_TOOLBAR_BUTTON} border-amber text-amber hover:bg-amber/10`}
                >
                  Campaign settings
                </button>
              )}
              {!isBrowseMode && (
                <button
                  type="button"
                  disabled={isRetreating}
                  onClick={() => setShowRetreatConfirm(true)}
                  className={`${OPS_TOOLBAR_BUTTON} border-warning-red text-warning-red hover:bg-warning-red/10`}
                >
                  {isRetreating ? "Retreating…" : "Retreat run"}
                </button>
              )}
            </>
          ) : null
        }
        banner={
          connectMode && (
            <div className="flex items-center justify-between border-b-2 border-amber px-4 py-3 font-mono text-sm text-amber">
              <span>Click the node this one leads to (node #{connectMode.sourceNodeId}).</span>
              <button
                type="button"
                onClick={() => setConnectMode(null)}
                className="border border-amber px-3 py-1 text-xs uppercase tracking-wider hover:bg-amber/10"
              >
                Cancel
              </button>
            </div>
          )
        }
        canvas={
          <CampaignGraphCanvas
            bare
            backdropSrc={ART_SLOTS.runMapBackdrop.src}
            nodes={chartNodes}
            route={routeVisibility}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            renderNode={(node, isSelected, onSelect) => (
              <RoguelikeNodeCard
                node={node}
                isSelected={isSelected}
                onSelect={onSelect}
                title={node.title}
                titleStatus={node.titleStatus}
                editMode={node.editMode}
                connectHighlight={node.connectHighlight}
              />
            )}
          />
        }
        drawer={drawer}
        peek={missionPeek}
        actionBar={
          editMode ? undefined : (
            <RunActionBar
              roster={roster}
              fleetCost={fleetCost}
              costCap={costCap}
              action={mapAction}
              onAction={handleMapAction}
              onSecondaryAction={tutorial?.onSkip}
            />
          )
        }
      />

      {/* Hidden while connecting so the target node can be clicked on the
          map; it reopens on the same node once the link is made. */}
      {editMode && editorOpen && !connectMode && (isCreatingNode || selectedNode) && (
        <NodeEditorModal
          title={isCreatingNode ? "New node" : `Node #${selectedNode!.id} · ${selectedNode!.title}`}
          onClose={() => setEditorOpen(false)}
        >
          {renderNodeEditor({
            mode: isCreatingNode ? "create" : "edit",
            node: selectedNode ?? null,
            connectModeActive: isSelectedConnectSource,
            onStartConnectMode: (sourceNodeId) => setConnectMode({ sourceNodeId }),
            onCancelConnectMode: () => setConnectMode(null),
            onSaved: () => void refetchNodes(),
            onCreated: () => {
              setEditorOpen(false);
              backToSnapTarget();
              void refetchNodes();
            },
            onCancelCreate: () => {
              setEditorOpen(false);
              backToSnapTarget();
            },
          })}
        </NodeEditorModal>
      )}

      {showRetreatConfirm && !isBrowseMode && (
        <RetreatRunConfirmModal
          isRetreating={isRetreating}
          onCancel={() => setShowRetreatConfirm(false)}
          onConfirm={() => {
            void handleRetreat().finally(() => setShowRetreatConfirm(false));
          }}
        />
      )}

      {combatTargetNodeId != null &&
        byId.has(combatTargetNodeId) &&
        !isBrowseMode &&
        renderCombatModal(combatTargetNodeId, () => setCombatTargetNodeId(null))}

      {showSettings && renderSettings(() => setShowSettings(false))}
    </>
  );
}
