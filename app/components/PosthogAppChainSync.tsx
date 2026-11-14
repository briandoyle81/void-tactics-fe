"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { GAME_CONTRACT, NEAR_NETWORK } from "../near/config";

/** Registers PostHog super properties so every event includes the NEAR network and game contract. */
export function PosthogAppChainSync() {
  useEffect(() => {
    posthog.register({
      app_chain_id: `near-${NEAR_NETWORK}`,
      app_chain_name: `NEAR ${NEAR_NETWORK}`,
      app_game_contract: GAME_CONTRACT,
    });
  }, []);

  return null;
}
