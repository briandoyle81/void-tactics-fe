"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useHoldFireWarningSetting } from "../hooks/useHoldFireWarning";

// The confirmation before a ship holds fire while a target is in range of
// where it ends its move. Shared by the live games (web3, web2) and the
// tutorial: each passes `confirmHoldFire` to its move's submit button
// (TransactionButton `confirmBeforeSend`, or its own submit) and renders
// `holdFireModal`. "Don't ask again" turns the warning off
// (useHoldFireWarning); Settings › Combat turns it back on.

type Pending = { targets: number; resolve: (go: boolean) => void };

/**
 * `confirmHoldFire(targetsInRange)` resolves true to go ahead: at once when
 * nothing is in range or the warning is off, else when the player confirms
 * in the modal (false when they go back to pick a target).
 */
export function useHoldFireConfirm() {
  const warning = useHoldFireWarningSetting();
  const [pending, setPending] = useState<Pending | null>(null);
  const [dontAsk, setDontAsk] = useState(false);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const confirmHoldFire = useCallback(
    (targetsInRange: number): Promise<boolean> => {
      if (targetsInRange <= 0 || !warning.enabled) return Promise.resolve(true);
      // A second ask while one is open answers the first as "go back".
      pendingRef.current?.resolve(false);
      return new Promise<boolean>((resolve) => {
        setDontAsk(false);
        setPending({ targets: targetsInRange, resolve });
      });
    },
    [warning.enabled],
  );

  const answer = useCallback(
    (go: boolean) => {
      const open = pendingRef.current;
      if (!open) return;
      if (go && dontAsk) warning.setEnabled(false);
      setPending(null);
      open.resolve(go);
    },
    [dontAsk, warning],
  );

  // Escape goes back, as the modal's own way out.
  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      answer(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pending, answer]);

  // An unmount mid-question answers it, so the submit never hangs.
  useEffect(() => () => pendingRef.current?.resolve(false), []);

  const holdFireModal = pending ? (
    <HoldFireConfirmModal
      targets={pending.targets}
      dontAsk={dontAsk}
      onDontAskChange={setDontAsk}
      onBack={() => answer(false)}
      onConfirm={() => answer(true)}
    />
  ) : null;

  return { confirmHoldFire, holdFireModal };
}

function HoldFireConfirmModal({
  targets,
  dontAsk,
  onDontAskChange,
  onBack,
  onConfirm,
}: {
  targets: number;
  dontAsk: boolean;
  onDontAskChange: (value: boolean) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[420] p-2"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hold-fire-title"
    >
      <div className="bg-near-black border border-amber rounded-none p-4 md:p-6 max-w-md w-full max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <div className="text-center">
          <div className="text-amber text-2xl font-mono font-bold mb-2 md:mb-4 tracking-widest">[!]</div>
          <h3 id="hold-fire-title" className="text-xl font-bold text-amber mb-2 md:mb-4">
            TARGET IN RANGE
          </h3>
          <p className="text-text-secondary mb-4 md:mb-6">
            {targets === 1
              ? "A target is in range of where this ship ends its move."
              : `${targets} targets are in range of where this ship ends its move.`}{" "}
            Hold fire anyway?
          </p>
          <label className="mb-4 md:mb-6 flex cursor-pointer items-center justify-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={dontAsk}
              onChange={(event) => onDontAskChange(event.target.checked)}
              className="accent-amber"
            />
            Don&apos;t ask again
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              autoFocus
              className="flex-1 px-4 py-2 border border-gunmetal text-text-muted rounded-none hover:bg-steel/20"
            >
              PICK A TARGET
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2 border border-amber text-amber rounded-none hover:bg-amber/20"
            >
              HOLD FIRE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
