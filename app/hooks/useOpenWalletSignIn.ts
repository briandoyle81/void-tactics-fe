"use client";

import { useCallback } from "react";
import { useDynamicContext, useProjectSettings } from "@dynamic-labs/sdk-react-core";
import { useAccount } from "wagmi";
import { toast } from "react-hot-toast";

/**
 * Opens Dynamic's wallet sign-in. If Dynamic still has a session but no
 * wallet is connected (seen with MetaMask on Firefox: after a refresh the
 * extension's reconnect replies get lost, so wagmi never reconnects), opening
 * the auth flow is a silent no-op because Dynamic thinks you're signed in —
 * the user is stuck looking logged out. Clear that stale session first so the
 * sign-in flow actually opens.
 *
 * If Dynamic has no project settings (it couldn't reach its API, e.g. an
 * origin it doesn't allow or a blocked request), its sign-in can't open at
 * all: say so instead of doing nothing. sdkHasLoaded alone isn't enough;
 * it's set even when that request failed.
 */
export function useOpenWalletSignIn() {
  const { user, sdkHasLoaded, setShowAuthFlow, handleLogOut } = useDynamicContext();
  const projectSettings = useProjectSettings();
  const { isConnected } = useAccount();

  return useCallback(async () => {
    if (!sdkHasLoaded || !projectSettings) {
      toast.error("Wallet sign-in isn't available right now. Try again in a moment.");
      return;
    }
    if (user && !isConnected) {
      try {
        await handleLogOut();
      } catch (error) {
        console.error("Failed to clear stale wallet session:", error);
      }
    }
    setShowAuthFlow(true);
  }, [user, sdkHasLoaded, projectSettings, isConnected, handleLogOut, setShowAuthFlow]);
}
