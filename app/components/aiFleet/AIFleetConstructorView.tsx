"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import ShipCard from "../ShipCard";
import { ShipImageWeb2 } from "../ShipImageWeb2";
import { ShipSpecControls, type ShipSpecControlsValue } from "../ship/ShipSpecControls";
import { validSpecialsForVariant, Archetype } from "../../types/types";
import { ARCHETYPE_LABEL } from "../../utils/aiShipConfig";
import { aiConfigToPreviewShipWeb2 } from "../../utils/aiShipConfigWeb2";
import { calculateAttributesFromContractsWeb2 } from "../../utils/shipAttributesCalculatorWeb2";
import { toShipCardDataWeb2 } from "../../utils/toShipCardData";
import { downloadJson } from "../../utils/jsonFileSave";
import { calculateShipRank } from "../../utils/shipLevel";
import { getRankConfig } from "../../utils/rankConfigCache";
import {
  aiFleetPendingWrites,
  aiFleetShipStatus,
  aiFleetShipToWeb2,
  aiFleetToFile,
  newAIFleetShip,
  AI_FLEET_MAX_KILLS,
  parseAIFleetFile,
  withKey,
  type AIFleetShip,
  type AIFleetShipData,
  type AIFleetShipStatus,
} from "../../utils/aiFleet";

// Ops Console › AI Fleet: every AI ship config as a card. Add a ship or
// click one to open it in the constructor (the shared ShipSpecControls plus
// name and archetype); the X on a card removes it from the fleet. The fleet
// is a working copy: download it as JSON, load one back, and write it to
// the chain (web3, AIEncounters) or the database (web2). Shared by
// AIFleetConstructor and AIFleetConstructorWeb2, which load the saved
// configs and do the writes. Number-native.

export interface AIFleetWriteResult {
  created: number;
  updated: number;
}

/** A ship to write, with its key so a created one can be given its new id. */
export type AIFleetWrite = AIFleetShipData & { key: string };

interface Props {
  /** The saved configs; undefined while loading. */
  saved: AIFleetShipData[] | undefined;
  /** Whether this account may write (the panel still works locally without). */
  canWrite: boolean;
  /** "chain" or "database", for the button and messages. */
  destination: "chain" | "database";
  /** Color sets the constructor edits (web2 ships have no third set). */
  colorSets: readonly (1 | 2)[];
  /** Highest special slot per variant (web3 reads it from Game); default 3. */
  maxSpecialSlot?: (variant: number) => number | undefined;
  /**
   * Creates and updates the ships one by one, calling onCreated with each new
   * ship's id as it's saved (so a retry after a failure doesn't create it
   * again), and reloads the saved configs, even after a failure.
   */
  onWrite: (
    writes: { creates: AIFleetWrite[]; updates: AIFleetWrite[] },
    onCreated: (key: string, configId: number) => void,
  ) => Promise<AIFleetWriteResult>;
}

const STATUS_LABEL: Record<AIFleetShipStatus, string> = {
  new: "New",
  changed: "Changed",
  saved: "Saved",
};
const STATUS_CLASS: Record<AIFleetShipStatus, string> = {
  new: "border-phosphor-green text-phosphor-green",
  changed: "border-amber text-amber",
  saved: "border-gunmetal text-text-muted",
};

const BUTTON =
  "border-2 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";
const BUTTON_CYAN = `${BUTTON} border-cyan text-cyan hover:bg-cyan/10`;
const BUTTON_MUTED = `${BUTTON} border-gunmetal text-text-secondary hover:border-cyan hover:text-cyan`;
const BUTTON_GREEN = `${BUTTON} border-phosphor-green text-phosphor-green hover:bg-phosphor-green/10`;
const SELECT_CLASS =
  "w-full px-3 py-2 bg-near-black border text-cyan focus:outline-none focus:ring-2 focus:ring-cyan";
const FIELD_STYLE = { borderRadius: 0, borderColor: "var(--color-cyan)" } as const;
const DISPLAY_FONT = { fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" } as const;

const ARCHETYPES = Object.values(Archetype).filter((v): v is Archetype => typeof v === "number");

function shipLabel(ship: AIFleetShipData): string {
  return ship.name || ARCHETYPE_LABEL[ship.archetype];
}

function previewShip(ship: AIFleetShipData, previewId: number) {
  return aiConfigToPreviewShipWeb2(aiFleetShipToWeb2(ship), previewId);
}

function ConfirmModal({
  title,
  children,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md border-2 bg-near-black p-5"
        style={{ borderRadius: 0, borderColor: danger ? "var(--color-warning-red)" : "var(--color-cyan)" }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-bold uppercase tracking-wide text-primary" style={DISPLAY_FONT}>
          {title}
        </h3>
        <div className="mb-5 space-y-2 font-mono text-sm leading-relaxed text-text-secondary">{children}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className={BUTTON_MUTED}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={danger ? `${BUTTON} border-warning-red text-warning-red hover:bg-warning-red/10` : BUTTON_CYAN}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The constructor for one ship: spec sections, name, archetype and a preview. */
function AIShipConstructor({
  initial,
  colorSets,
  maxSpecialSlot,
  onSave,
  onCancel,
}: {
  initial: AIFleetShip;
  colorSets: readonly (1 | 2)[];
  maxSpecialSlot?: (variant: number) => number | undefined;
  onSave: (ship: AIFleetShip) => void;
  onCancel: () => void;
}) {
  const [ship, setShip] = useState(initial);
  const isNew = initial.configId == null;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const specValue: ShipSpecControlsValue = {
    name: ship.name,
    ...ship.equipment,
    accuracy: ship.traits.accuracy,
    hull: ship.traits.hull,
    speed: ship.traits.speed,
    variant: ship.traits.variant,
    colors: ship.traits.colors,
    shiny: ship.shiny,
  };
  const applyPatch = (patch: Partial<ShipSpecControlsValue>) => {
    setShip((prev) => ({
      ...prev,
      name: patch.name ?? prev.name,
      shiny: patch.shiny ?? prev.shiny,
      equipment: {
        mainWeapon: patch.mainWeapon ?? prev.equipment.mainWeapon,
        armor: patch.armor ?? prev.equipment.armor,
        shields: patch.shields ?? prev.equipment.shields,
        special: patch.special ?? prev.equipment.special,
      },
      traits: {
        ...prev.traits,
        accuracy: patch.accuracy ?? prev.traits.accuracy,
        hull: patch.hull ?? prev.traits.hull,
        speed: patch.speed ?? prev.traits.speed,
        variant: patch.variant ?? prev.traits.variant,
        colors: patch.colors ? { ...prev.traits.colors, ...patch.colors } : prev.traits.colors,
      },
    }));
  };

  const preview = useMemo(() => previewShip(ship, 1), [ship]);
  const { rank } = calculateShipRank(preview);
  // Kill counts that reach each rank: rank 1 needs none.
  const rankKills = useMemo(() => [0, ...getRankConfig(ship.traits.variant).thresholds], [ship.traits.variant]);
  const setKills = (kills: number) =>
    setShip((prev) => ({ ...prev, shipsDestroyed: Math.min(AI_FLEET_MAX_KILLS, Math.max(0, Math.floor(kills) || 0)) }));
  const specials = validSpecialsForVariant(ship.traits.variant, maxSpecialSlot?.(ship.traits.variant));

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-3" onClick={onCancel}>
      <div
        className="max-h-[92vh] w-[95%] max-w-5xl overflow-y-auto border-2 border-cyan bg-near-black p-4"
        style={{ borderRadius: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "New AI ship" : `Edit ${shipLabel(ship)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold uppercase tracking-widest text-cyan" style={DISPLAY_FONT}>
            {isNew ? "New AI ship" : `Edit #${ship.configId}`}
          </h3>
          <button type="button" onClick={onCancel} className={BUTTON_MUTED}>
            Close
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
          <div className="space-y-4">
            <ShipSpecControls
              value={specValue}
              onChange={applyPatch}
              specials={specials}
              variantMax={2}
              colorsTitle="COLORS"
              colorSets={colorSets}
              shipDataExtra={
                <>
                <div>
                  <label className="mb-2 block text-sm text-cyan">
                    Kills: {ship.shipsDestroyed} (rank {rank})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={AI_FLEET_MAX_KILLS}
                    value={ship.shipsDestroyed}
                    onChange={(e) => setKills(Number(e.target.value))}
                    className={SELECT_CLASS}
                    style={FIELD_STYLE}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rankKills.map((kills, i) => (
                      <button
                        key={kills}
                        type="button"
                        onClick={() => setKills(kills)}
                        className={`border px-2 py-1 font-mono text-[11px] ${
                          rank === i + 1
                            ? "border-amber text-amber"
                            : "border-gunmetal text-text-secondary hover:border-cyan hover:text-cyan"
                        }`}
                      >
                        R{i + 1}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-cyan">Archetype (AI behavior)</label>
                  <select
                    value={ship.archetype}
                    onChange={(e) => setShip((prev) => ({ ...prev, archetype: Number(e.target.value) as Archetype }))}
                    className={SELECT_CLASS}
                    style={FIELD_STYLE}
                  >
                    {ARCHETYPES.map((a) => (
                      <option key={a} value={a}>
                        {ARCHETYPE_LABEL[a]}
                      </option>
                    ))}
                  </select>
                </div>
                </>
              }
            />
          </div>
          <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
            <div className="aspect-square w-full overflow-hidden border border-gunmetal bg-near-black">
              <ShipImageWeb2 ship={preview} className="h-full w-full" showLoadingState={false} />
            </div>
            <div className="font-mono text-sm font-bold text-cyan">{shipLabel(ship)}</div>
            <div className="font-mono text-xs text-text-secondary">
              {ARCHETYPE_LABEL[ship.archetype]} · Rank {rank}
              {ship.shiny ? " · Shiny" : ""} · Cost {preview.shipData.cost}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onSave(ship)} className={BUTTON_GREEN}>
                {isNew ? "Add to fleet" : "Save to fleet"}
              </button>
              <button type="button" onClick={onCancel} className={BUTTON_MUTED}>
                Cancel
              </button>
            </div>
            <p className="font-mono text-[11px] text-text-muted">
              Changes stay in this fleet until you write it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIFleetConstructorView({
  saved,
  canWrite,
  destination,
  colorSets,
  maxSpecialSlot,
  onWrite,
}: Props) {
  const savedById = useMemo(
    () => new Map((saved ?? []).filter((s) => s.configId != null).map((s) => [s.configId as number, s])),
    [saved],
  );
  // The working fleet: loaded from the saved configs the first time they
  // arrive, then edited locally until Reload, Load JSON or a write.
  const [fleet, setFleet] = useState<AIFleetShip[] | null>(null);
  // After a write, the saved list from before it (wait for the reloaded one).
  const [staleSaved, setStaleSaved] = useState<AIFleetShipData[] | null>(null);
  if (fleet === null && saved && saved !== staleSaved) setFleet(saved.map(withKey));
  const ships = useMemo(() => fleet ?? [], [fleet]);

  const [editing, setEditing] = useState<AIFleetShip | null>(null);
  const [deleting, setDeleting] = useState<AIFleetShip | null>(null);
  const [confirmingWrite, setConfirmingWrite] = useState(false);
  const [confirmingReload, setConfirmingReload] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { creates, updates } = useMemo(
    () => aiFleetPendingWrites(ships, savedById),
    [ships, savedById],
  );
  const removedSaved = useMemo(() => {
    const inFleet = new Set(ships.map((s) => s.configId));
    return [...savedById.values()].filter((s) => !inFleet.has(s.configId));
  }, [ships, savedById]);
  const pendingCount = creates.length + updates.length;
  const isLocalChanged = pendingCount > 0 || removedSaved.length > 0;
  const destinationLabel = destination === "chain" ? "chain" : "database";

  const saveShip = (ship: AIFleetShip) => {
    setFleet((prev) => {
      const list = prev ?? [];
      return list.some((s) => s.key === ship.key) ? list.map((s) => (s.key === ship.key ? ship : s)) : [...list, ship];
    });
    setEditing(null);
  };

  const reloadFromSaved = () => {
    setFleet(saved ? saved.map(withKey) : null);
    setConfirmingReload(false);
  };

  const handleUpload = async (file: File) => {
    try {
      const loaded = parseAIFleetFile(await file.text());
      setFleet(loaded.map(withKey));
      const matched = loaded.filter((s) => s.configId != null && savedById.has(s.configId)).length;
      toast.success(
        `Loaded ${loaded.length} ship${loaded.length === 1 ? "" : "s"} from ${file.name}` +
          (matched > 0 ? ` (${matched} match saved configs by id)` : ""),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that file");
    }
  };

  const handleWrite = async () => {
    setConfirmingWrite(false);
    setIsWriting(true);
    try {
      const result = await onWrite({ creates, updates }, (key, configId) =>
        setFleet((prev) => (prev ?? []).map((s) => (s.key === key ? { ...s, configId } : s))),
      );
      toast.success(`Wrote the fleet to the ${destinationLabel}: ${result.created} created, ${result.updated} updated.`);
      // Reload from what's saved now (new ships have their ids).
      setStaleSaved(saved ?? null);
      setFleet(null);
    } catch (e) {
      // Ships written before the failure now carry their ids and match the
      // reloaded configs, so writing again only does the rest.
      toast.error(e instanceof Error ? e.message : `Couldn't write to the ${destinationLabel}`);
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-widest text-cyan" style={DISPLAY_FONT}>
            AI Fleet
          </h2>
          <p className="font-mono text-xs text-text-secondary">
            {fleet === null
              ? "Loading AI ship configs…"
              : `${ships.length} ship${ships.length === 1 ? "" : "s"}` +
                (isLocalChanged
                  ? ` · ${creates.length} new · ${updates.length} changed` +
                    (removedSaved.length > 0 ? ` · ${removedSaved.length} removed` : "")
                  : ` · matches the ${destinationLabel}`)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing(newAIFleetShip())} disabled={fleet === null} className={BUTTON_GREEN}>
            + Add ship
          </button>
          <button
            type="button"
            onClick={() => downloadJson(`ai-fleet-${new Date().toISOString().slice(0, 10)}.json`, aiFleetToFile(ships))}
            disabled={fleet === null}
            className={BUTTON_CYAN}
          >
            Download JSON
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className={BUTTON_CYAN}>
            Load JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => setConfirmingReload(true)}
            disabled={!saved || !isLocalChanged}
            className={BUTTON_MUTED}
          >
            Reload from {destinationLabel}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingWrite(true)}
            disabled={!canWrite || pendingCount === 0 || isWriting}
            title={canWrite ? undefined : "This account can't write AI ship configs"}
            className={`${BUTTON} border-amber text-amber hover:bg-amber/10`}
          >
            {isWriting ? "Writing…" : `Write to ${destinationLabel}${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
          </button>
        </div>
      </div>

      {!canWrite && (
        <p className="border border-gunmetal bg-black/40 p-2 font-mono text-xs text-text-muted">
          This account can&apos;t write AI ship configs. You can still build a fleet and save it as JSON.
        </p>
      )}

      {fleet !== null && ships.length === 0 ? (
        <p className="py-8 text-center font-mono text-sm text-text-muted">No ships in this fleet. Add one to start.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {ships.map((ship, i) => {
            const preview = previewShip(ship, i + 1);
            const status = aiFleetShipStatus(ship, savedById);
            return (
              <div key={ship.key} className="relative">
                <ShipCard
                  ship={toShipCardDataWeb2(preview)}
                  shipImage={<ShipImageWeb2 ship={preview} className="h-full w-full" showLoadingState={false} />}
                  isStarred={false}
                  onToggleStar={() => {}}
                  isSelected={false}
                  onToggleSelection={() => setEditing(ship)}
                  onRecycleClick={() => {}}
                  showInGameProperties
                  inGameAttributes={calculateAttributesFromContractsWeb2(preview)}
                  selectionMode
                  hideRecycle
                  hideCheckbox
                  onCardClick={() => setEditing(ship)}
                  canSelect
                />
                <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="truncate text-text-secondary">
                    {ARCHETYPE_LABEL[ship.archetype]}
                    {ship.configId != null ? ` · #${ship.configId}` : ""}
                  </span>
                  <span className={`shrink-0 border px-1.5 ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleting(ship)}
                  aria-label={`Remove ${shipLabel(ship)} from the fleet`}
                  className="absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center border-2 border-warning-red bg-near-black font-mono text-sm font-bold leading-none text-warning-red hover:bg-warning-red hover:text-near-black"
                  style={{ borderRadius: 0 }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <AIShipConstructor
          key={editing.key}
          initial={editing}
          colorSets={colorSets}
          maxSpecialSlot={maxSpecialSlot}
          onSave={saveShip}
          onCancel={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Remove ship"
          confirmLabel="Remove"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            setFleet((prev) => (prev ?? []).filter((s) => s.key !== deleting.key));
            setDeleting(null);
          }}
        >
          <p>Remove {shipLabel(deleting)} from this fleet?</p>
          {deleting.configId != null && savedById.has(deleting.configId) && (
            <p className="text-amber">
              It&apos;s saved as config #{deleting.configId}. Configs can&apos;t be deleted from the {destinationLabel}, so
              it stays there (and in any map placements); it&apos;s left out of this fleet and its JSON, and comes back on
              Reload.
            </p>
          )}
        </ConfirmModal>
      )}

      {confirmingWrite && (
        <ConfirmModal
          title={`Write to ${destinationLabel}`}
          confirmLabel="Write"
          onCancel={() => setConfirmingWrite(false)}
          onConfirm={() => void handleWrite()}
        >
          <p>
            Create {creates.length} new config{creates.length === 1 ? "" : "s"} and update {updates.length}.
            {destination === "chain" ? " Each one is its own transaction to sign." : ""}
          </p>
          {updates.length > 0 && (
            <p>Updating: {updates.map((s) => `#${s.configId} ${shipLabel(s)}`).join(", ")}.</p>
          )}
          {removedSaved.length > 0 && (
            <p className="text-amber">
              {removedSaved.length} removed ship{removedSaved.length === 1 ? "" : "s"} stay saved (configs can&apos;t be
              deleted).
            </p>
          )}
        </ConfirmModal>
      )}

      {confirmingReload && (
        <ConfirmModal
          title={`Reload from ${destinationLabel}`}
          confirmLabel="Reload"
          danger
          onCancel={() => setConfirmingReload(false)}
          onConfirm={reloadFromSaved}
        >
          <p>Discard this fleet&apos;s changes and load the saved configs? Download it as JSON first to keep them.</p>
        </ConfirmModal>
      )}
    </div>
  );
}
