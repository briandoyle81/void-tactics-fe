"use client";

import React, { useEffect } from "react";

// Confirms a roguelike resupply repair before any UTC is spent, shared by
// RoguelikeResupplyPanel (web3) and RoguelikeResupplyPanelWeb2: each ship
// being repaired (its hull now and after), the total HP and the UTC price.
// `confirmButton` is the caller's (web3: a TransactionButton calling
// resupplyRepair; web2: the API call), the same split as RecycleConfirmModal.

export interface RepairConfirmShip {
  key: string;
  name: string;
  hull: number;
  maxHull: number;
}

interface RepairConfirmModalProps {
  show: boolean;
  ships: RepairConfirmShip[];
  totalHp: number;
  /** The price, already formatted (formatUtc / formatUtcWei). */
  costLabel: string;
  onCancel: () => void;
  confirmButton: React.ReactNode;
}

const LABEL_FONT = "var(--font-rajdhani), 'Arial Black', sans-serif";

export function RepairConfirmModal({
  show,
  ships,
  totalHp,
  costLabel,
  onCancel,
  confirmButton,
}: RepairConfirmModalProps) {
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, onCancel]);

  if (!show) return null;

  return (
    // Above GameNav (z-250) so the bottom bar doesn't cover its buttons.
    <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/60 p-3" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="repair-confirm-title"
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto border-2 border-phosphor-green bg-near-black p-4 font-mono md:p-6"
        style={{ borderRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="repair-confirm-title"
          className="mb-4 text-xl font-bold uppercase tracking-widest text-phosphor-green"
          style={{ fontFamily: LABEL_FONT }}
        >
          Repair your fleet?
        </h3>

        <ul className="mb-4 space-y-1.5 text-sm">
          {ships.map((ship) => (
            <li key={ship.key} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-text-primary">{ship.name}</span>
              <span className="shrink-0 text-text-secondary">
                {ship.hull}/{ship.maxHull} → {ship.maxHull}/{ship.maxHull}{" "}
                <span className="text-phosphor-green">+{ship.maxHull - ship.hull} HP</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mb-5 space-y-1 border-t border-gunmetal pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">HP repaired</span>
            <span className="font-bold text-phosphor-green">{totalHp} HP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Cost</span>
            <span className="font-bold text-cyan">{costLabel} UTC</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 border border-gunmetal bg-steel text-sm font-bold uppercase tracking-[0.1em] text-text-primary transition-colors hover:border-cyan hover:text-cyan"
            style={{ fontFamily: LABEL_FONT, borderRadius: 0 }}
          >
            Cancel
          </button>
          <div className="flex flex-[2]">{confirmButton}</div>
        </div>
      </div>
    </div>
  );
}
