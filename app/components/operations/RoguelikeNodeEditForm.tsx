"use client";

import React from "react";
import { toast } from "react-hot-toast";
import { RoguelikeNodeKind } from "../../types/roguelike";
import { MapPickerModal, type MapPickerMap } from "../MapPickerModal";
import { MapPreviewCard } from "../MapPreviewCard";

// Edit Mode's node panel on the Operations map: kind, map, max score and
// first player for a combat node, cost cap override for a resupply node, the
// node's children (link/unlink), the enemy fleet and the map. Shared by
// RoguelikeNodeEditPanel (web3: RoguelikeNodeMap transactions) and
// RoguelikeNodeEditPanelWeb2 (the admin API), which supply the maps, the
// save and unlink calls, and the mode-specific sections (node text, win
// effects, enemy fleet preview, map and fleet editors). Number ids.

/** Placeholder values for a freshly created node. */
const NEW_NODE_DEFAULTS = { turnTime: 120, maxScore: 1000, costCapOverride: 700 };

export interface RoguelikeNodeFormNode {
  id: number;
  kind: RoguelikeNodeKind;
  /** 0 for none. */
  mapId: number;
  turnTime: number;
  maxScore: number;
  creatorGoesFirst: boolean;
  costCapOverride: number;
  childIds: number[];
}

/** What Save sends: a resupply node has no map, a combat node no cost cap override. */
export interface RoguelikeNodeFormFields {
  kind: RoguelikeNodeKind;
  isCombat: boolean;
  mapId: number;
  turnTime: number;
  maxScore: number;
  creatorGoesFirst: boolean;
  costCapOverride: number;
}

export function RoguelikeNodeEditForm({
  mode,
  node,
  maps,
  pickerMaps,
  canEditMap,
  contentSection,
  winEffectsSection,
  renderEnemyFleetPreview,
  renderMapEditor,
  renderFleetEditor,
  fleetEditorBlockedReason,
  onSubmit,
  onRemoveChild,
  connectModeActive,
  onStartConnectMode,
  onCancelConnectMode,
  onSaved,
  onCreated,
  onCancelCreate,
}: {
  mode: "create" | "edit";
  node: RoguelikeNodeFormNode | null;
  /** Every map, for the preview card. */
  maps: MapPickerMap[];
  /** The maps the picker offers (PvE-capable). */
  pickerMaps: MapPickerMap[];
  canEditMap: boolean;
  /** The node's title/description (read-only or editable), under Kind. */
  contentSection?: React.ReactNode;
  /** Edit mode, combat nodes: the win-effects picker. */
  winEffectsSection?: React.ReactNode;
  renderEnemyFleetPreview: (mapId: number) => React.ReactNode;
  renderMapEditor: (map: MapPickerMap, close: () => void) => React.ReactNode;
  renderFleetEditor: (mapId: number, close: () => void) => React.ReactNode;
  /** Why the enemy-fleet editor can't open (permission), or null. */
  fleetEditorBlockedReason: () => string | null;
  /** Creates or updates the node; resolves to the success message. */
  onSubmit: (fields: RoguelikeNodeFormFields) => Promise<string>;
  onRemoveChild: (childId: number) => Promise<unknown>;
  /** True while THIS node is the active connect-mode source (parent side of addChild). */
  connectModeActive: boolean;
  onStartConnectMode: (sourceNodeId: number) => void;
  onCancelConnectMode: () => void;
  onSaved: () => void;
  onCreated: () => void;
  onCancelCreate: () => void;
}) {
  const [kind, setKind] = React.useState<RoguelikeNodeKind>(node?.kind ?? RoguelikeNodeKind.Combat);
  const [mapId, setMapId] = React.useState(node?.mapId ?? 0);
  const [turnTime, setTurnTime] = React.useState(node?.turnTime ?? NEW_NODE_DEFAULTS.turnTime);
  const [maxScore, setMaxScore] = React.useState(node?.maxScore ?? NEW_NODE_DEFAULTS.maxScore);
  const [creatorGoesFirst, setCreatorGoesFirst] = React.useState(node?.creatorGoesFirst ?? true);
  const [costCapOverride, setCostCapOverride] = React.useState(
    node?.costCapOverride ?? NEW_NODE_DEFAULTS.costCapOverride,
  );
  const [showMapPicker, setShowMapPicker] = React.useState(false);
  const [showMapEditor, setShowMapEditor] = React.useState(false);
  const [showFleetEditor, setShowFleetEditor] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Reseed the draft when a different node is selected.
  const seededNodeIdRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const key = node?.id ?? null;
    if (seededNodeIdRef.current === key) return;
    seededNodeIdRef.current = key;
    setKind(node?.kind ?? RoguelikeNodeKind.Combat);
    setMapId(node?.mapId ?? 0);
    setTurnTime(node?.turnTime ?? NEW_NODE_DEFAULTS.turnTime);
    setMaxScore(node?.maxScore ?? NEW_NODE_DEFAULTS.maxScore);
    setCreatorGoesFirst(node?.creatorGoesFirst ?? true);
    setCostCapOverride(node?.costCapOverride ?? NEW_NODE_DEFAULTS.costCapOverride);
  }, [node]);

  const isCombat = kind === RoguelikeNodeKind.Combat;
  const selectedMapPreview = React.useMemo(
    () => (mapId === 0 ? undefined : maps.find((m) => m.id === mapId)),
    [maps, mapId],
  );

  const handleEditEnemyFleet = () => {
    if (mapId === 0) {
      toast.error("Select a map before editing the enemy fleet.");
      return;
    }
    const blocked = fleetEditorBlockedReason();
    if (blocked) {
      toast.error(blocked);
      return;
    }
    setShowFleetEditor(true);
  };

  const handleSaveDetails = async () => {
    if (isCombat && mapId === 0) {
      toast.error("Select a map before saving.");
      return;
    }
    setIsSaving(true);
    try {
      const message = await onSubmit({ kind, isCombat, mapId, turnTime, maxScore, creatorGoesFirst, costCapOverride });
      toast.success(message);
      if (mode === "create") onCreated();
      else onSaved();
    } catch (error) {
      console.error("Failed to save node:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save node");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveChild = async (childId: number) => {
    try {
      await onRemoveChild(childId);
      onSaved();
    } catch (error) {
      console.error("Failed to remove child edge:", error);
      toast.error(error instanceof Error ? error.message : "Failed to remove child edge");
    }
  };

  if (!node && mode === "edit") return null;

  return (
    <div
      className="grid grid-cols-1 gap-8 border-2 border-amber p-6 font-mono md:grid-cols-2"
      style={{ borderRadius: 0 }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-amber">
            {mode === "create" ? "[NEW NODE]" : `[EDIT NODE #${node!.id}]`}
          </h3>
          {mode === "create" && (
            <button
              type="button"
              onClick={onCancelCreate}
              className="text-amber hover:text-amber/80 text-xl font-bold leading-none"
              aria-label="Cancel"
            >
              ×
            </button>
          )}
        </div>

        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Kind
          <select
            value={kind}
            onChange={(e) => setKind(Number(e.target.value) as RoguelikeNodeKind)}
            className="px-3 py-2 bg-near-black border text-cyan focus:outline-none focus:ring-2 focus:ring-cyan"
            style={{ borderRadius: 0, borderColor: "var(--color-cyan)" }}
          >
            <option value={RoguelikeNodeKind.Combat}>Combat</option>
            <option value={RoguelikeNodeKind.Resupply}>Resupply</option>
          </select>
        </label>

        {contentSection}

        {isCombat ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Map
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="self-start border-2 border-cyan px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan hover:bg-cyan/10"
                style={{ borderRadius: 0 }}
              >
                {mapId === 0
                  ? "[SELECT MAP]"
                  : `[CHANGE MAP] ${selectedMapPreview?.titleLabel ?? `#${mapId}`}`}
              </button>
              <span className="text-[10px] text-text-muted">Draft until you Save Details.</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                Max Score
                <input
                  type="number"
                  value={maxScore}
                  onChange={(e) => setMaxScore(Math.max(0, Number(e.target.value) || 0))}
                  className="px-3 py-2 bg-near-black border text-cyan focus:outline-none focus:ring-2 focus:ring-cyan"
                  style={{ borderRadius: 0, borderColor: "var(--color-cyan)" }}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-text-muted self-end pb-2">
                <input
                  type="checkbox"
                  checked={creatorGoesFirst}
                  onChange={(e) => setCreatorGoesFirst(e.target.checked)}
                />
                Creator goes first
              </label>
            </div>
          </>
        ) : (
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Cost Cap Override (0 = no change)
            <input
              type="number"
              value={costCapOverride}
              onChange={(e) => setCostCapOverride(Math.max(0, Number(e.target.value) || 0))}
              className="px-3 py-2 bg-near-black border text-cyan focus:outline-none focus:ring-2 focus:ring-cyan"
              style={{ borderRadius: 0, borderColor: "var(--color-cyan)" }}
            />
          </label>
        )}

        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSaveDetails()}
          className="self-start border-2 border-phosphor-green px-4 py-2 text-sm font-bold uppercase tracking-wider text-phosphor-green hover:bg-phosphor-green/10 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderRadius: 0 }}
        >
          {isSaving ? "[SAVING...]" : mode === "create" ? "[CREATE NODE]" : "[SAVE DETAILS]"}
        </button>

        {isCombat && (
          <button
            type="button"
            onClick={handleEditEnemyFleet}
            className="self-start border-2 border-warning-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-warning-red hover:bg-warning-red/10"
            style={{ borderRadius: 0 }}
          >
            [EDIT ENEMY FLEET]
          </button>
        )}

        {mode === "edit" && node && isCombat && winEffectsSection && (
          <div className="flex flex-col gap-2 border-t border-steel pt-4">
            <label className="text-xs text-text-muted">
              Win effects — run in order after every win at this node, on top of the
              campaign&apos;s ordinary auto-heal floor
            </label>
            {winEffectsSection}
          </div>
        )}
      </div>

      {mode === "edit" && node && (
        <div className="border-t border-steel pt-4 md:border-t-0 md:border-l md:pl-8 md:pt-0">
          <h4 className="text-xs uppercase tracking-wider text-text-muted mb-2">Children</h4>
          <div className="flex flex-wrap gap-2 mb-3">
            {node.childIds.length === 0 && (
              <span className="text-xs text-text-muted">None — clearing this node ends the run.</span>
            )}
            {node.childIds.map((childId) => (
              <span
                key={childId}
                className="flex items-center gap-1.5 px-2 py-1 text-xs border border-cyan/40 text-cyan"
              >
                #{childId} →
                <button
                  type="button"
                  onClick={() => void handleRemoveChild(childId)}
                  className="text-warning-red hover:text-warning-red/70"
                  aria-label={`Remove child ${childId}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {connectModeActive ? (
            <button
              type="button"
              onClick={onCancelConnectMode}
              className="border-2 border-warning-red px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-warning-red hover:bg-warning-red/10"
              style={{ borderRadius: 0 }}
            >
              [CANCEL LINKING]
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStartConnectMode(node.id)}
              className="self-start border-2 border-cyan px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan hover:bg-cyan/10"
              style={{ borderRadius: 0 }}
            >
              [+ LINK CHILD]
            </button>
          )}

          {isCombat && mapId !== 0 && <div className="mt-6">{renderEnemyFleetPreview(mapId)}</div>}

          {isCombat && selectedMapPreview && (
            <div className="mt-6 border-t border-steel pt-4">
              <MapPreviewCard
                map={selectedMapPreview}
                modeLabel={selectedMapPreview.modeLabel}
                onSelect={() => setShowMapPicker(true)}
                onEdit={canEditMap ? () => setShowMapEditor(true) : undefined}
              />
            </div>
          )}
        </div>
      )}

      {showMapEditor && selectedMapPreview && (
        // Full-screen so the grid editor has room; same screen as the Maps tab.
        <div className="fixed inset-0 z-[600] overflow-y-auto bg-near-black/95 p-4">
          <div className="mx-auto max-w-5xl">{renderMapEditor(selectedMapPreview, () => setShowMapEditor(false))}</div>
        </div>
      )}

      {showMapPicker && (
        <MapPickerModal
          maps={pickerMaps}
          selectedMapId={mapId === 0 ? null : mapId}
          onSelect={(id) => {
            setMapId(id);
            setShowMapPicker(false);
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {showFleetEditor && isCombat && mapId !== 0 && renderFleetEditor(mapId, () => setShowFleetEditor(false))}
    </div>
  );
}
