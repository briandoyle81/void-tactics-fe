"use client";

import { STYLE_LABEL, STYLE_MONO } from "../styles/fontStyles";

// Shown over a battle while its map is still loading (GameDisplay /
// GameDisplayWeb2): the screen dims and its controls are locked, since a
// move staged on a board without its terrain could be illegal. Back stays
// reachable.
export function MapLoadingOverlay({ onBack }: { onBack: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[450] flex items-center justify-center bg-black/75 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label="Loading the battlefield"
    >
      <div
        className="flex w-full max-w-xs flex-col items-center gap-3 border-2 border-solid bg-near-black px-6 py-5 text-center"
        style={{ borderColor: "var(--color-cyan)", borderRadius: 0 }}
      >
        <span className="animate-pulse text-2xl font-bold uppercase tracking-widest text-cyan" style={STYLE_LABEL}>
          Loading…
        </span>
        <span className="text-xs text-text-secondary" style={STYLE_MONO}>
          Loading the battlefield
        </span>
        <button
          type="button"
          onClick={onBack}
          className="min-h-10 w-full border border-solid px-4 text-sm uppercase tracking-wider text-text-secondary hover:bg-white/5"
          style={{ ...STYLE_LABEL, borderColor: "var(--color-gunmetal)", borderRadius: 0 }}
        >
          Back
        </button>
      </div>
    </div>
  );
}
