"use client";

import { useEffect, useRef } from "react";
import { takeRunResult, trackRunEnded, type AppMode } from "../utils/analytics/gameEvents";

/**
 * Sends run_ended when the player's Operations run goes from active to
 * not active while this view is mounted. Shared by RoguelikeCampaign (web3)
 * and RoguelikeCampaignWeb2. Pass isActive: null while the run is loading,
 * so a refetch doesn't look like the run ending.
 */
export function useTrackRunEnded({
  appMode,
  isActive,
  campaignId,
}: {
  appMode: AppMode;
  isActive: boolean | null;
  campaignId?: bigint | number;
}) {
  const wasActiveRef = useRef(false);
  const campaignIdRef = useRef(campaignId);
  if (isActive && campaignId != null) campaignIdRef.current = campaignId;

  useEffect(() => {
    if (isActive === null) return;
    if (wasActiveRef.current && !isActive) {
      trackRunEnded({ appMode, campaignId: campaignIdRef.current, result: takeRunResult() });
    }
    wasActiveRef.current = isActive;
  }, [appMode, isActive]);
}
