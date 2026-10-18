"use client";

// Shared by Lobbies.tsx (web3) and LobbiesWeb2.tsx (web2): the warning
// before creating a fleet that uses under 90% of the lobby's threat budget.
// Capped to the screen and scrolling, so its buttons stay reachable on a
// phone held sideways.
export function FleetThreatWarningModal({
  totalCost,
  costLimit,
  onBack,
  onConfirm,
  confirmDisabled,
  isCreating,
}: {
  totalCost: number;
  costLimit: number;
  onBack: () => void;
  onConfirm: () => void;
  confirmDisabled: boolean;
  isCreating: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[420] p-2">
      <div className="bg-near-black border border-amber rounded-none p-4 md:p-6 max-w-md w-full max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <div className="text-center">
          <div className="text-amber text-2xl font-mono font-bold mb-2 md:mb-4 tracking-widest">[!]</div>
          <h3 className="text-xl font-bold text-amber mb-2 md:mb-4">FLEET THREAT WARNING</h3>
          <p className="text-text-secondary mb-4 md:mb-6">
            Your fleet threat ({totalCost}) is less than 90% of the maximum ({costLimit}). You&apos;re only
            using {Math.round((totalCost / costLimit) * 100)}% of your available budget.
          </p>
          <p className="text-sm text-text-muted mb-4 md:mb-6">
            Consider adding more ships to maximize your fleet&apos;s potential, or proceed with your current
            selection.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 px-4 py-2 border border-gunmetal text-text-muted rounded-none hover:bg-steel/20"
            >
              GO BACK
            </button>
            <button
              onClick={onConfirm}
              disabled={confirmDisabled}
              className="flex-1 px-4 py-2 border border-amber text-amber rounded-none hover:bg-amber/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "CREATING..." : "CONFIRM FLEET"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
