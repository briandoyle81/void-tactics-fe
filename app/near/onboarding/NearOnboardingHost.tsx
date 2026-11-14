"use client";

/**
 * "Activate your account": shown once a signed-in player's NEAR account
 * isn't fully set up (app/near/session.tsx onboarding). One click runs the
 * missing steps (funding, adding the session key, the first storage
 * deposit). It can't be closed until the account is ready: nothing in the
 * game works without it. The only way out is signing out.
 *
 * Also listens for OPEN_STORAGE_TOP_UP_EVENT (a write that ran out of
 * storage) and offers a storage top-up.
 */
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNearSession } from "../session";
import { useAppMode } from "../../hooks/useAppMode";
import { STORAGE_TOP_UP } from "../config";
import { formatNear } from "../codec";
import { errorText, isUserRejection } from "../errors";
import { nearViewPrefix } from "../useNearView";

/** Dispatch on window to offer a storage top-up (e.g. after InsufficientStorageBalance). */
export const OPEN_STORAGE_TOP_UP_EVENT = "vt-open-storage-top-up";

export function openStorageTopUp(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_STORAGE_TOP_UP_EVENT));
}

const STEP_TEXT: Record<string, string> = {
  funding: "Funding your account…",
  "adding-key": "Setting up moves without confirmations…",
  registering: "Setting aside room for your ships and battles…",
};

export function NearOnboardingHost() {
  const appMode = useAppMode();
  const session = useNearSession();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);

  useEffect(() => {
    const open = () => setTopUpOpen(true);
    window.addEventListener(OPEN_STORAGE_TOP_UP_EVENT, open);
    return () => window.removeEventListener(OPEN_STORAGE_TOP_UP_EVENT, open);
  }, []);

  const setupKnown =
    session.accountExists !== null && session.sessionKeyReady !== null && session.storageRegistered !== null;
  const needsSetup =
    appMode === "web3" && session.status === "connected" && setupKnown && !session.isOnboarded;

  const activate = useCallback(async () => {
    setRunning(true);
    try {
      await session.runOnboarding();
      void queryClient.invalidateQueries({ queryKey: nearViewPrefix("storage_balance_of") });
      toast.success("Your account is ready.");
    } catch (e) {
      if (isUserRejection(e)) toast.error("Activation cancelled. You can finish it any time.");
      else toast.error(`Couldn't activate your account: ${errorText(e).slice(0, 160)}`);
    } finally {
      setRunning(false);
    }
  }, [session, queryClient]);

  const topUp = useCallback(async () => {
    setToppingUp(true);
    try {
      await session.send({
        method: "storage_deposit",
        args: { account_id: null, registration_only: false },
        deposit: STORAGE_TOP_UP,
      });
      void queryClient.invalidateQueries({ queryKey: nearViewPrefix("storage_balance_of") });
      toast.success("Storage topped up.");
      setTopUpOpen(false);
    } catch (e) {
      if (!isUserRejection(e)) toast.error(`Top-up failed: ${errorText(e).slice(0, 160)}`);
    } finally {
      setToppingUp(false);
    }
  }, [session, queryClient]);

  if (topUpOpen && session.status === "connected") {
    return (
      <Shell title="Storage is running low" onClose={toppingUp ? undefined : () => setTopUpOpen(false)}>
        <p className="text-sm text-text-secondary">
          Your ships and battles take up storage on the network, paid from a small balance you hold with the
          game. Add {formatNear(STORAGE_TOP_UP)} NEAR to keep playing. Unused storage can be withdrawn later.
        </p>
        <button
          type="button"
          onClick={() => void topUp()}
          disabled={toppingUp}
          className="w-full border-2 border-solid border-cyan px-4 py-3 font-mono text-sm font-bold tracking-wider text-cyan hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {toppingUp ? "[ADDING…]" : `ADD ${formatNear(STORAGE_TOP_UP)} NEAR`}
        </button>
      </Shell>
    );
  }

  if (!needsSetup) return null;

  const stepText = STEP_TEXT[session.onboardingStep];
  return (
    <Shell title="Activate your account">
      <p className="text-sm text-text-secondary">
        One-time setup before your first battle. It takes a few seconds; after that, the game plays your moves
        without asking.
      </p>
      <ol className="grid gap-1 font-mono text-xs text-text-secondary">
        <SetupRow done={session.accountExists === true} label="Account funded" />
        <SetupRow done={session.sessionKeyReady === true} label="Moves without confirmations" />
        <SetupRow done={session.storageRegistered === true} label="Storage for ships and battles" />
      </ol>
      {running && stepText && <p className="text-sm text-amber">{stepText}</p>}
      {!running && session.onboardingError && (
        <p className="text-sm text-warning-red">{session.onboardingError}</p>
      )}
      <button
        type="button"
        onClick={() => void activate()}
        disabled={running}
        className="w-full border-2 border-solid border-cyan px-4 py-3 font-mono text-sm font-bold tracking-wider text-cyan hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? "[ACTIVATING…]" : session.onboardingStep === "error" ? "TRY AGAIN" : "ACTIVATE"}
      </button>
      {!running && (
        <button
          type="button"
          onClick={() => void session.logout()}
          className="justify-self-center font-mono text-xs uppercase tracking-wider text-text-muted hover:text-cyan"
        >
          Sign out
        </button>
      )}
    </Shell>
  );
}

function SetupRow({ done, label }: { done: boolean; label: string }) {
  return (
    <li className={done ? "text-phosphor-green" : ""}>
      {done ? "[✓]" : "[ ]"} {label}
    </li>
  );
}

function Shell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    // Above GameNav (z-250), below the sign-in modal (z-450).
    <div className="fixed inset-0 z-[440] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[3px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="grid w-full max-w-md gap-4 border border-solid border-cyan bg-near-black p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-sans text-2xl font-bold uppercase tracking-wider text-cyan">{title}</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-solid border-steel text-text-secondary hover:border-cyan hover:text-cyan"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
