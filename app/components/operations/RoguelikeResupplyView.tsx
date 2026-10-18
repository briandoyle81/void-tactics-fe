"use client";

import React from "react";

// A resupply node's screen: pick damaged roster ships to repair (with the
// cost), remove ships from the roster, and add owned ships to it. Shared by
// RoguelikeResupplyPanel (web3: UTC approve + resupplyRepair transactions)
// and RoguelikeResupplyPanelWeb2 (the API), which supply the roster, the
// ships available to add, the add/remove calls and the repair button. Keys
// are stringified ship ids.

export interface ResupplyRosterShip {
  key: string;
  name: string;
  image: React.ReactNode;
  currentHP: number;
  maxHP: number;
}

export interface ResupplyAvailableShip {
  key: string;
  card: React.ReactNode;
}

export function RoguelikeResupplyView({
  nodeLabel,
  costCapLabel,
  isLoading = false,
  roster,
  available,
  onAdd,
  onRemove,
  repairCostLabel,
  renderRepairButton,
  onDone,
}: {
  nodeLabel: string;
  costCapLabel: string;
  isLoading?: boolean;
  roster: ResupplyRosterShip[];
  available: ResupplyAvailableShip[];
  /** Resolve when done; the adapter shows its own toasts. */
  onAdd: (key: string) => Promise<unknown>;
  onRemove: (key: string) => Promise<unknown>;
  /** "Repair cost: … UTC" for this many missing HP. */
  repairCostLabel: (missingHP: number) => string;
  /** The repair action for the selected ships; call `onRepaired` once it succeeds. */
  renderRepairButton: (args: { keys: string[]; missingHP: number; onRepaired: () => void }) => React.ReactNode;
  onDone: () => void;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

  const missingHP = (ship: ResupplyRosterShip) => Math.max(0, ship.maxHP - ship.currentHP);
  const totalMissingHP = roster.reduce((sum, ship) => sum + (selected.has(ship.key) ? missingHP(ship) : 0), 0);

  const toggle = (ship: ResupplyRosterShip) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ship.key)) next.delete(ship.key);
      else if (missingHP(ship) > 0) next.add(ship.key);
      return next;
    });
  };

  const modify = async (key: string, action: (key: string) => Promise<unknown>) => {
    setPendingKey(key);
    try {
      await action(key);
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 border-2 border-cyan p-6 font-mono" style={{ borderRadius: 0 }}>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-cyan">[RESUPPLY — NODE #{nodeLabel}]</h3>
        <button
          type="button"
          onClick={onDone}
          className="border-2 border-steel px-4 py-2 text-xs font-bold uppercase tracking-wider text-text-secondary transition-colors hover:border-cyan hover:text-cyan"
          style={{ borderRadius: 0 }}
        >
          [CONTINUE]
        </button>
      </div>

      <div>
        <h4 className="mb-2 text-xs uppercase tracking-wider text-text-muted">Repair Roster</h4>
        {isLoading ? (
          <p className="text-sm text-text-muted">Loading roster…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {roster.map((ship) => {
              const missing = missingHP(ship);
              return (
                <button
                  key={ship.key}
                  type="button"
                  disabled={missing === 0}
                  onClick={() => toggle(ship)}
                  className={`flex flex-col gap-1 border-2 p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected.has(ship.key) ? "border-cyan bg-cyan/10" : "border-gunmetal"
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  <div className="aspect-square w-full overflow-hidden" style={{ backgroundColor: "var(--color-slate)" }}>
                    {ship.image}
                  </div>
                  <span className="truncate text-[10px] uppercase tracking-wider text-text-secondary">{ship.name}</span>
                  <span className={`text-[10px] ${missing > 0 ? "text-warning-red" : "text-phosphor-green"}`}>
                    HP {ship.currentHP}/{ship.maxHP}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {totalMissingHP > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border border-cyan/40 bg-cyan/10 p-3 text-xs">
            <span className="text-cyan">{repairCostLabel(totalMissingHP)}</span>
            {renderRepairButton({
              keys: Array.from(selected),
              missingHP: totalMissingHP,
              onRepaired: () => setSelected(new Set()),
            })}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs uppercase tracking-wider text-text-muted">
          Roster ({roster.length}) — cost cap {costCapLabel}
        </h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {roster.map((ship) => (
            <div key={ship.key} className="flex flex-col gap-1">
              <div
                className="aspect-square w-full overflow-hidden border border-gunmetal"
                style={{ backgroundColor: "var(--color-slate)" }}
              >
                {ship.image}
              </div>
              <button
                type="button"
                disabled={pendingKey !== null}
                onClick={() => void modify(ship.key, onRemove)}
                className="border border-warning-red px-1 py-0.5 text-[9px] uppercase tracking-wider text-warning-red hover:bg-warning-red/10 disabled:opacity-50"
              >
                [REMOVE]
              </button>
            </div>
          ))}
        </div>

        {available.length > 0 && (
          <>
            <h4 className="mb-2 mt-4 text-xs uppercase tracking-wider text-text-muted">Available Ships</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {available.map((ship) => (
                <div key={ship.key} className="flex flex-col gap-1">
                  {ship.card}
                  <button
                    type="button"
                    disabled={pendingKey !== null}
                    onClick={() => void modify(ship.key, onAdd)}
                    className="border border-phosphor-green px-1 py-0.5 text-[9px] uppercase tracking-wider text-phosphor-green hover:bg-phosphor-green/10 disabled:opacity-50"
                  >
                    [ADD]
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
