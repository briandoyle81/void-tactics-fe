"use client";

import { useCallback } from "react";
import { useDynamicContext, useProjectSettings } from "@dynamic-labs/sdk-react-core";
import { useAccount } from "wagmi";
import { toast } from "react-hot-toast";

/** The event that opens the sign-in modal (SignInModal, mounted once by the client's providers). */
export const OPEN_SIGN_IN_EVENT = "void-tactics-open-sign-in";

/** Opens the sign-in modal from anywhere in the client. */
export function openSignIn() {
  window.dispatchEvent(new CustomEvent(OPEN_SIGN_IN_EVENT));
}

/**
 * Gets Dynamic ready for a sign-in, whichever way it goes (SignInPanel's
 * email code / Google / browser wallet, or Dynamic's own modal). Resolves
 * false when it can't.
 *
 * If Dynamic still has a session but no wallet is connected (seen with
 * MetaMask on Firefox: after a refresh the extension's reconnect replies get
 * lost, so wagmi never reconnects), a sign-in is a silent no-op because
 * Dynamic thinks you're signed in — the user is stuck looking logged out.
 * Clear that stale session first so the sign-in actually starts.
 *
 * If Dynamic has no project settings (it couldn't reach its API, e.g. an
 * origin it doesn't allow or a blocked request), its sign-in can't start at
 * all: say so instead of doing nothing. sdkHasLoaded alone isn't enough;
 * it's set even when that request failed.
 */
export function usePrepareSignIn() {
  const { user, sdkHasLoaded, handleLogOut } = useDynamicContext();
  const projectSettings = useProjectSettings();
  const { isConnected } = useAccount();

  return useCallback(async (): Promise<boolean> => {
    if (!sdkHasLoaded || !projectSettings) {
      toast.error("Sign-in isn't available right now. Try again in a moment.");
      return false;
    }
    if (user && !isConnected) {
      try {
        await handleLogOut();
      } catch (error) {
        console.error("Failed to clear stale wallet session:", error);
      }
    }
    return true;
  }, [user, sdkHasLoaded, projectSettings, isConnected, handleLogOut]);
}

/**
 * Dynamic's own sign-in modal (after usePrepareSignIn). Only SignInPanel's
 * "More wallets" uses it; everything else opens our sign-in (openSignIn).
 */
export function useOpenDynamicAuthFlow() {
  const { setShowAuthFlow } = useDynamicContext();
  const prepare = usePrepareSignIn();

  return useCallback(async () => {
    if (await prepare()) setShowAuthFlow(true);
  }, [prepare, setShowAuthFlow]);
}

/** Opens the sign-in modal (SignInModal): the embedded wallet first, a browser wallet behind a notice. */
export function useOpenWalletSignIn() {
  return useCallback(async () => {
    openSignIn();
  }, []);
}
