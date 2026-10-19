"use client";

import React from "react";
import { toast } from "react-hot-toast";
import { rewardShipsAdminHref } from "../../config/routes";

// The Operations campaign settings modal (Edit Mode › Campaign settings):
// root node, auto-heal, required variant, initial cost cap, repair cost, the
// global win-effect settings, and on web3 the fee withdrawal and editor
// access. Shared by RoguelikeSettingsModal (web3: one transaction per field)
// and RoguelikeSettingsModalWeb2 (the admin API), which supply the current
// values and a save per field. A field whose save is omitted is shown
// disabled; an omitted section isn't shown.

export interface RoguelikeSettingsValues {
  rootNodeId: number | null;
  autoHealPercent: number;
  requiredVariant: number;
  initialCostCap: string;
  repairCostPerHp: string;
  decBonusAmount: string;
  healAboveFloorPercent: number;
}

export interface RoguelikeSettingsSaves {
  rootNodeId: (value: string) => Promise<unknown>;
  autoHealPercent: (value: number) => Promise<unknown>;
  requiredVariant: (value: number) => Promise<unknown>;
  initialCostCap: (value: string) => Promise<unknown>;
  repairCostPerHp: (value: string) => Promise<unknown>;
  decBonusAmount: (value: string) => Promise<unknown>;
  /** Omitted where the effect isn't implemented (shown disabled). */
  healAboveFloorPercent?: (value: number) => Promise<unknown>;
}

const INPUT_CLASS =
  "flex-1 px-3 py-2 bg-near-black border text-cyan focus:outline-none focus:ring-2 focus:ring-cyan";
const INPUT_STYLE = { borderRadius: 0, borderColor: "var(--color-cyan)" } as const;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Keeps a field in step with its loaded value, once it arrives or changes. */
function useLoadedValue<T>(loaded: T | undefined, initial: T) {
  const [value, setValue] = React.useState<T>(loaded ?? initial);
  React.useEffect(() => {
    if (loaded !== undefined) setValue(loaded);
  }, [loaded]);
  return [value, setValue] as const;
}

export function RoguelikeSettingsForm({
  values,
  saves,
  repairCostLabel,
  decBonusLabel,
  onWithdraw,
  onSetEditor,
  onClose,
  onSaved,
}: {
  /** Loaded values; a field still loading is undefined. */
  values: Partial<RoguelikeSettingsValues>;
  saves: RoguelikeSettingsSaves;
  repairCostLabel: string;
  decBonusLabel: string;
  /** Web3 only: sweep accumulated resupply fees to an address. */
  onWithdraw?: (to: string) => Promise<unknown>;
  /** Web3 only: grant or revoke node + enemy-fleet editing together. */
  onSetEditor?: (address: string, allowed: boolean) => Promise<unknown>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rootNodeId, setRootNodeId] = useLoadedValue(
    values.rootNodeId === undefined ? undefined : (values.rootNodeId?.toString() ?? ""),
    "",
  );
  const [autoHealPercent, setAutoHealPercent] = useLoadedValue(values.autoHealPercent, 0);
  const [variant, setVariant] = useLoadedValue(values.requiredVariant, 0);
  const [initialCostCap, setInitialCostCap] = useLoadedValue(values.initialCostCap, "0");
  const [repairCostPerHp, setRepairCostPerHp] = useLoadedValue(values.repairCostPerHp, "0");
  const [decBonusAmount, setDecBonusAmount] = useLoadedValue(values.decBonusAmount, "0");
  const [healAbovePercent, setHealAbovePercent] = useLoadedValue(values.healAboveFloorPercent, 100);
  const [withdrawTo, setWithdrawTo] = React.useState("");
  const [editorAddress, setEditorAddress] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await action();
      toast.success(`${label} saved.`);
      onSaved();
    } catch (error) {
      console.error(`Failed to save ${label}:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to save ${label}`);
    } finally {
      setBusy(null);
    }
  };

  const saveHealAbove = saves.healAboveFloorPercent;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[500] p-4">
      <div
        className="bg-near-black border-2 p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto rounded-none font-mono"
        style={{ borderColor: "var(--color-amber)" }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-amber tracking-wider">[ROGUELIKE SETTINGS]</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-amber hover:text-amber/80 text-2xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <SettingRow label="Root node id">
            <input
              type="number"
              value={rootNodeId}
              onChange={(e) => setRootNodeId(e.target.value)}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
            />
            <SaveButton busy={busy === "root"} onClick={() => run("root", () => saves.rootNodeId(rootNodeId))} />
          </SettingRow>

          <SettingRow label="Auto-heal % on win (0-100)">
            <input
              type="number"
              min={0}
              max={100}
              value={autoHealPercent}
              onChange={(e) => setAutoHealPercent(clamp(Number(e.target.value) || 0, 0, 100))}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
            />
            <SaveButton
              busy={busy === "autoHeal"}
              onClick={() => run("autoHeal", () => saves.autoHealPercent(autoHealPercent))}
            />
          </SettingRow>

          <SettingRow label="Required fleet variant (0 = unrestricted)">
            <input
              type="number"
              min={0}
              value={variant}
              onChange={(e) => setVariant(Math.max(0, Number(e.target.value) || 0))}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
            />
            <SaveButton busy={busy === "variant"} onClick={() => run("variant", () => saves.requiredVariant(variant))} />
          </SettingRow>

          <SettingRow label="Initial cost cap">
            <input
              type="number"
              value={initialCostCap}
              onChange={(e) => setInitialCostCap(e.target.value)}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
            />
            <SaveButton
              busy={busy === "costCap"}
              onClick={() => run("costCap", () => saves.initialCostCap(initialCostCap))}
            />
          </SettingRow>

          <SettingRow label={repairCostLabel}>
            <input
              type="number"
              value={repairCostPerHp}
              onChange={(e) => setRepairCostPerHp(e.target.value)}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
            />
            <SaveButton
              busy={busy === "repairCost"}
              onClick={() => run("repairCost", () => saves.repairCostPerHp(repairCostPerHp))}
            />
          </SettingRow>

          {onWithdraw && (
            <SettingRow label="Withdraw resupply fees to">
              <input
                type="text"
                value={withdrawTo}
                onChange={(e) => setWithdrawTo(e.target.value)}
                placeholder="0x..."
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              />
              <SaveButton
                label="[WITHDRAW]"
                busy={busy === "withdraw"}
                onClick={() => run("withdraw", () => onWithdraw(withdrawTo))}
              />
            </SettingRow>
          )}

          {onSetEditor && (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-text-muted">
                Editor access — grants both node-editing and enemy-fleet-editing permissions together
              </label>
              <input
                type="text"
                value={editorAddress}
                onChange={(e) => setEditorAddress(e.target.value)}
                placeholder="0x..."
                className="px-3 py-2 bg-near-black border text-cyan focus:outline-none focus:ring-2 focus:ring-cyan"
                style={INPUT_STYLE}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === "grant"}
                  onClick={() => run("grant", () => onSetEditor(editorAddress, true))}
                  className="flex-1 px-4 py-2 border-2 border-phosphor-green text-phosphor-green text-xs font-bold uppercase tracking-wider hover:bg-phosphor-green/10 disabled:opacity-50"
                  style={{ borderRadius: 0 }}
                >
                  [GRANT]
                </button>
                <button
                  type="button"
                  disabled={busy === "revoke"}
                  onClick={() => run("revoke", () => onSetEditor(editorAddress, false))}
                  className="flex-1 px-4 py-2 border-2 border-warning-red text-warning-red text-xs font-bold uppercase tracking-wider hover:bg-warning-red/10 disabled:opacity-50"
                  style={{ borderRadius: 0 }}
                >
                  [REVOKE]
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-steel pt-4">
            <label className="text-xs text-text-muted">
              Win effect configuration — global per resolver, shared across every
              campaign/node it&apos;s assigned to (see a node&apos;s own edit panel to
              assign which effects run there)
            </label>

            <SettingRow label={decBonusLabel}>
              <input
                type="number"
                min={0}
                value={decBonusAmount}
                onChange={(e) => setDecBonusAmount(e.target.value)}
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              />
              <SaveButton
                busy={busy === "decBonus"}
                onClick={() => run("decBonus", () => saves.decBonusAmount(decBonusAmount))}
              />
            </SettingRow>

            <SettingRow
              label={`Heal Above Floor — heals to this % of max HP${saveHealAbove ? "" : " (not yet implemented)"}`}
            >
              <input
                type="number"
                min={0}
                max={100}
                disabled={!saveHealAbove}
                value={healAbovePercent}
                onChange={(e) => setHealAbovePercent(clamp(Number(e.target.value) || 0, 0, 100))}
                className={`${INPUT_CLASS}${saveHealAbove ? "" : " opacity-50"}`}
                style={INPUT_STYLE}
              />
              {saveHealAbove && (
                <SaveButton
                  busy={busy === "healAbove"}
                  onClick={() => run("healAbove", () => saveHealAbove(healAbovePercent))}
                />
              )}
            </SettingRow>

            <SettingRow label="Grant Ship">
              <p className="text-xs text-text-secondary">
                Each node sets its own reward ship in{" "}
                <a href={rewardShipsAdminHref()} className="text-cyan underline hover:text-cyan/80">
                  Ops Console › Reward Ships
                </a>
                .
              </p>
            </SettingRow>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-text-muted">{label}</label>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function SaveButton({
  onClick,
  busy,
  label = "[SAVE]",
}: {
  onClick: () => void;
  busy: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="px-4 py-2 border-2 border-cyan text-cyan text-xs font-bold uppercase tracking-wider hover:bg-cyan/10 disabled:opacity-50"
      style={{ borderRadius: 0 }}
    >
      {busy ? "[SAVING...]" : label}
    </button>
  );
}
