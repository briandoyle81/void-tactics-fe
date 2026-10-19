"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { FleetShipListPanel, type FleetShipListItemData } from "./FleetShipListPanel";
import { getFactionName } from "../config/factions";
import { isDeploymentTile, type ZoneTile } from "../utils/deploymentZone";

// The enemy-placement editor for one map: a roster of AI ship configs on the
// left, the map on the right; drag (or tap then tap a tile) to place, drag to
// move, Remove/Reset/Save. Shared by MapPlacementsEditor (web3: contract
// reads and setMapPlacements) and MapPlacementsEditorWeb2 (API), which supply
// the saved placements, the save call, the roster cards and the map. Number
// ids.

export interface PlacementRosterEntry {
  /** The AI ship config id. */
  id: number;
  variant: number;
  /** Threat cost, for the total. */
  cost: number;
  /** Its card in the roster; `onPick` arms it for tap-to-place. */
  renderCard: (onPick: () => void) => React.ReactNode;
}

export interface WorkingPlacement {
  /**
   * Synthetic, rendering-only id (never saved: only row/col/configId are) so
   * the map can key and select each placed ship even when the same config is
   * placed more than once.
   */
  shipId: number;
  configId: number;
  row: number;
  col: number;
}

export interface PlacementsMapProps {
  placements: WorkingPlacement[];
  selectedShipId: number | null;
  onShipSelect: (shipId: number) => void;
  onShipMove: (shipId: number, row: number, col: number) => void;
  selectableShipIds: number[];
  pendingPlacementShipId: number | null;
  onDragOver: (row: number, col: number, e: React.DragEvent) => void;
  onDrop: (row: number, col: number, e?: React.DragEvent) => void;
  dragOverPosition: { row: number; col: number } | null;
}

// Rendering-only id namespace for placed ships, distinct from real config ids.
const PLACEMENT_ID_BASE = 500_000_000;

export function MapPlacementsEditorCore({
  mapId,
  roster,
  savedPlacements,
  joinerZone,
  maxPlacements,
  onSave,
  renderMap,
  startOpen = false,
  onClose,
}: {
  mapId: number;
  roster: PlacementRosterEntry[];
  /** The map's saved placements; undefined while loading. */
  savedPlacements: { configId: number; row: number; col: number }[] | undefined;
  /**
   * The map's custom joiner-zone tiles (empty = the default columns 13–16),
   * or undefined while loading. AI ships may only be placed there: the
   * contract's setMapPlacement(s) and Fleets.createFleet both check it.
   */
  joinerZone: readonly ZoneTile[] | undefined;
  maxPlacements: number;
  /** Saves and resolves to the success message (rejects to show an error). */
  onSave: (placements: { configId: number; row: number; col: number }[]) => Promise<string>;
  renderMap: (props: PlacementsMapProps) => React.ReactNode;
  startOpen?: boolean;
  onClose?: () => void;
}) {
  const [placements, setPlacements] = useState<WorkingPlacement[]>([]);
  const seededMapIdRef = useRef<number | null>(null);
  const nextSyntheticIdRef = useRef(1);
  const freshShipId = () => PLACEMENT_ID_BASE + nextSyntheticIdRef.current++;

  const seedFromSaved = React.useCallback(() => {
    seededMapIdRef.current = mapId;
    setPlacements(
      (savedPlacements ?? []).map((p) => ({
        shipId: PLACEMENT_ID_BASE + nextSyntheticIdRef.current++,
        configId: p.configId,
        row: p.row,
        col: p.col,
      })),
    );
  }, [mapId, savedPlacements]);

  useEffect(() => {
    if (!savedPlacements) return;
    if (seededMapIdRef.current === mapId) return; // don't clobber in-progress edits on unrelated re-renders
    seedFromSaved();
  }, [savedPlacements, mapId, seedFromSaved]);

  const [selectedShipId, setSelectedShipId] = useState<number | null>(null);
  const [draggedShipId, setDraggedShipId] = useState<number | null>(null);
  const [draggedConfigId, setDraggedConfigId] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<{ row: number; col: number } | null>(null);
  const [pendingPlacementShipId, setPendingPlacementShipId] = useState<number | null>(null);
  const [armedConfigId, setArmedConfigId] = useState<number | null>(null);
  const pendingConfigForIdRef = useRef(new Map<number, number>());
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const rosterById = useMemo(() => new Map(roster.map((r) => [r.id, r])), [roster]);

  const handleMove = (shipId: number, row: number, col: number) => {
    setPlacements((prev) => {
      const occupiedIdx = prev.findIndex((p) => p.row === row && p.col === col && p.shipId !== shipId);
      const next = occupiedIdx === -1 ? prev : prev.filter((_, i) => i !== occupiedIdx);

      const existingIdx = next.findIndex((p) => p.shipId === shipId);
      if (existingIdx !== -1) {
        return next.map((p) => (p.shipId === shipId ? { ...p, row, col } : p));
      }

      const configId = pendingConfigForIdRef.current.get(shipId) ?? draggedConfigId;
      pendingConfigForIdRef.current.delete(shipId);
      if (configId == null) return next;
      if (next.length >= maxPlacements) {
        toast.error(`This map already has the max ${maxPlacements} enemy ships.`);
        return next;
      }
      return [...next, { shipId, configId, row, col }];
    });
    setIsDirty(true);
    setPendingPlacementShipId(null);
    setArmedConfigId(null);
  };

  const armRosterForTapToPlace = (configId: number) => {
    const id = freshShipId();
    pendingConfigForIdRef.current.set(id, configId);
    setPendingPlacementShipId(id);
    setArmedConfigId(configId);
  };

  const handleDrop = (row: number, col: number, e?: React.DragEvent) => {
    let shipIdToMove = draggedShipId;
    if (shipIdToMove == null && draggedConfigId == null && e) {
      const parsed = Number(e.dataTransfer.getData("text/plain"));
      if (e.dataTransfer.getData("text/plain") && !Number.isNaN(parsed)) shipIdToMove = parsed;
    }
    if (shipIdToMove != null) {
      handleMove(shipIdToMove, row, col);
    } else if (draggedConfigId != null) {
      handleMove(freshShipId(), row, col);
    }
    setDraggedShipId(null);
    setDraggedConfigId(null);
    setDragOverPosition(null);
  };

  const handleRemoveSelected = () => {
    if (selectedShipId == null) return;
    setPlacements((prev) => prev.filter((p) => p.shipId !== selectedShipId));
    setSelectedShipId(null);
    setIsDirty(true);
  };

  const handleReset = () => {
    seedFromSaved();
    setSelectedShipId(null);
    setIsDirty(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const message = await onSave(placements.map((p) => ({ row: p.row, col: p.col, configId: p.configId })));
      setIsDirty(false);
      toast.success(message);
    } catch (e) {
      console.error("Failed to save map placements:", e);
      toast.error(e instanceof Error ? e.message : "Failed to save placements");
    } finally {
      setSaving(false);
    }
  };

  // Placements outside the joiner zone: saved before the map's zone was
  // edited. Saving them reverts, and the mission can't start until they're
  // moved or removed.
  const outOfZoneCount = useMemo(
    () =>
      joinerZone
        ? placements.filter((p) => !isDeploymentTile(p.row, p.col, false, joinerZone)).length
        : 0,
    [placements, joinerZone],
  );

  const totalThreat = useMemo(
    () => placements.reduce((sum, p) => sum + (rosterById.get(p.configId)?.cost ?? 0), 0),
    [placements, rosterById],
  );

  const [showEditor, setShowEditor] = useState(startOpen);
  const closeEditor = () => {
    setShowEditor(false);
    onClose?.();
  };
  // A variant filter keeps the roster (both factions' configs) scannable
  // when placing a fleet for one faction.
  const [rosterVariantFilter, setRosterVariantFilter] = useState<"all" | number>("all");
  const rosterItems: FleetShipListItemData[] = roster
    .filter((r) => rosterVariantFilter === "all" || r.variant === rosterVariantFilter)
    .map((r) => ({
      key: String(r.id),
      canSelect: true,
      isPending: armedConfigId === r.id,
      isTouchDevice: false,
      onDragStart: () => setDraggedConfigId(r.id),
      onDragEnd: () => setDraggedConfigId(null),
      card: r.renderCard(() => armRosterForTapToPlace(r.id)),
    }));

  return (
    <>
      {!startOpen && (
        <div className="space-y-2 border border-gunmetal bg-black/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              {placements.length}/{maxPlacements} ships placed — total threat {totalThreat}
            </span>
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="px-4 py-2 rounded-none font-mono text-xs border border-cyan text-cyan hover:bg-cyan/10"
            >
              [EDIT PLACEMENTS]
            </button>
          </div>
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[600]">
          <div className="bg-near-black border border-cyan rounded-none p-6 w-[100vw] h-[100vh] flex flex-col" style={{ borderRadius: 0 }}>
            <div className="mb-2 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                <h4 className="text-lg font-bold text-cyan whitespace-nowrap">
                  MAP #{mapId} — ENEMY PLACEMENTS
                </h4>
                <span className="px-3 py-1 text-xs font-bold text-text-secondary bg-steel/40 border border-steel rounded-none whitespace-nowrap">
                  {placements.length}/{maxPlacements} placed
                  {placements.length >= maxPlacements && " (max)"}
                </span>
                <span className="px-3 py-1 text-xs font-bold text-amber bg-amber/10 border border-amber/40 rounded-none whitespace-nowrap">
                  TOTAL THREAT: {totalThreat}
                </span>
              </div>

              <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:flex-row md:items-center md:justify-center">
                <button
                  type="button"
                  disabled={selectedShipId == null}
                  onClick={handleRemoveSelected}
                  className="w-full px-4 py-2 rounded-none border-2 border-warning-red text-warning-red hover:bg-warning-red/20 font-mono font-bold text-sm tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed md:w-auto md:whitespace-nowrap"
                >
                  REMOVE SELECTED
                </button>
                <button
                  type="button"
                  disabled={!isDirty || saving}
                  onClick={handleReset}
                  className="w-full px-4 py-2 rounded-none border border-steel text-text-secondary hover:border-text-secondary font-mono font-bold text-sm tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed md:w-auto md:whitespace-nowrap"
                >
                  RESET
                </button>
                <button
                  type="button"
                  disabled={!isDirty || saving || outOfZoneCount > 0}
                  title={outOfZoneCount > 0 ? "Move or remove the ships outside the joiner zone first" : undefined}
                  onClick={() => void handleSave()}
                  className="w-full px-4 py-2 rounded-none border-2 border-phosphor-green text-phosphor-green hover:bg-phosphor-green/10 font-mono font-bold text-sm tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed md:w-auto md:whitespace-nowrap"
                >
                  {saving ? "SAVING..." : "SAVE PLACEMENTS"}
                </button>
              </div>

              <div className="flex items-center justify-start gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="px-3 py-1 text-sm font-bold text-text-muted border border-gunmetal rounded-none hover:text-text-secondary hover:border-steel transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <p className="mb-4 text-xs text-text-muted">
              Drag a ship from the roster onto the highlighted zone, or click one then click a tile. Click a placed ship to select it (drag to move, or use Remove Selected above). Enemy placements are restricted to the map&apos;s joiner zone — the same tiles AI ships occupy in a real match.
            </p>
            {outOfZoneCount > 0 && (
              <p className="mb-4 border border-warning-red/60 bg-warning-red/10 px-3 py-2 text-xs text-warning-red">
                {outOfZoneCount === 1 ? "1 ship is" : `${outOfZoneCount} ships are`} outside this map&apos;s joiner
                zone, probably because the zone was edited after the fleet was saved. This mission won&apos;t start
                until you move or remove {outOfZoneCount === 1 ? "it" : "them"} and save.
              </p>
            )}

            <div className="flex gap-4 flex-1 min-h-0">
              <div className="w-1/4 flex flex-col gap-2 min-h-0">
                <select
                  value={rosterVariantFilter}
                  onChange={(e) =>
                    setRosterVariantFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                  }
                  className="w-full border border-gunmetal bg-black/60 px-2 py-1 text-xs text-cyan"
                >
                  <option value="all">All factions</option>
                  <option value={1}>{getFactionName(1)}</option>
                  <option value={2}>{getFactionName(2)}</option>
                </select>
                <FleetShipListPanel widthClass="w-full" items={rosterItems} />
              </div>
              <div className="w-3/4 h-full flex items-center justify-center">
                {renderMap({
                  placements,
                  selectedShipId,
                  onShipSelect: setSelectedShipId,
                  onShipMove: handleMove,
                  selectableShipIds: placements.map((p) => p.shipId),
                  pendingPlacementShipId,
                  onDragOver: (row, col, e) => {
                    e.preventDefault();
                    setDragOverPosition({ row, col });
                  },
                  onDrop: handleDrop,
                  dragOverPosition,
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
