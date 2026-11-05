"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import posthog from "posthog-js";
import { OPEN_SIGN_IN_EVENT } from "../../hooks/useOpenWalletSignIn";
import { SignInPanel, type SignInStep } from "./SignInPanel";

// The sign-in modal: the same SignInPanel as the play page's sign-in screen,
// over whatever the player is doing (the tutorial's reward claim, the HUD's
// sign-in, a game link). Mounted once by the client's providers and opened
// with openSignIn() / useOpenWalletSignIn(). Closes once the wallet connects.

export function SignInModal() {
  const { isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const stateRef = useRef<{ step: SignInStep; noticeOpen: boolean }>({ step: "email", noticeOpen: false });

  useEffect(() => {
    const onOpen = () => {
      posthog.capture("sign_in_modal_opened");
      setOpen(true);
    };
    window.addEventListener(OPEN_SIGN_IN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SIGN_IN_EVENT, onOpen);
  }, []);

  // Signed in: nothing left to do here.
  useEffect(() => {
    if (open && isConnected) setOpen(false);
  }, [open, isConnected]);

  const close = useCallback(() => setOpen(false), []);
  const onStepChange = useCallback((step: SignInStep, noticeOpen: boolean) => {
    stateRef.current = { step, noticeOpen };
  }, []);

  // Escape closes it, except while the browser-wallet notice (which handles
  // Escape itself) is up or the account is being set up.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const { step, noticeOpen } = stateRef.current;
      if (event.key === "Escape" && !noticeOpen && step !== "setup") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    // Above GameNav (z-250), like the other modals; below the notice (z-[460]).
    <div className="fixed inset-0 z-[450] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-[3px]">
      <div role="dialog" aria-modal="true" aria-label="Sign in" className="relative grid w-full max-w-xl gap-4 py-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={close}
            aria-label="Close sign-in"
            className="inline-flex h-11 w-11 items-center justify-center border border-solid border-steel bg-near-black text-text-secondary hover:border-cyan hover:text-cyan"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <SignInPanel surface="modal" onStepChange={onStepChange} />
      </div>
    </div>
  );
}
