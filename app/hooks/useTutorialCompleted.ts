"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useChainAccount } from "../near/useChainAccount";
import { NEAR_NETWORK } from "../near/config";
import { useNearView } from "../near/useNearView";
import {
  hasCompletedFirstBattle,
  hasSkippedTutorial,
  isTutorialClaimCompletedCached,
  persistTutorialClaimCompleted,
  persistTutorialSkipped,
  TUTORIAL_COMPLETION_CHANGED_EVENT,
} from "../utils/tutorialCompletion";

/** Tutorial-claim cache key scope (was the chain id). */
const CLAIM_SCOPE = `near-${NEAR_NETWORK}`;

/**
 * Whether the connected wallet has done the tutorial: finished it on this
 * device, skipped it from the Operations map, or claimed its reward
 * (is_tutorial_completed onchain; also recorded on this device when
 * complete_tutorial succeeds, so the answer is instant next time).
 * Web2: useTutorialCompletedWeb2.
 */
export function useTutorialCompleted() {
  const { address } = useChainAccount();
  const [localDone, setLocalDone] = useState<boolean | null>(null);

  useEffect(() => {
    const read = () =>
      setLocalDone(
        hasCompletedFirstBattle() ||
          (!!address && (hasSkippedTutorial(address) || isTutorialClaimCompletedCached(CLAIM_SCOPE, address))),
      );
    read();
    window.addEventListener(TUTORIAL_COMPLETION_CHANGED_EVENT, read);
    return () => window.removeEventListener(TUTORIAL_COMPLETION_CHANGED_EVENT, read);
  }, [address]);

  const chainArgs = useMemo(() => (address ? { account_id: address } : null), [address]);
  const { data: chainDone, isLoading: chainLoading } = useNearView("is_tutorial_completed", chainArgs, {
    staleTime: 60_000,
    enabled: localDone === false,
  });
  useEffect(() => {
    if (chainDone === true && address) persistTutorialClaimCompleted(CLAIM_SCOPE, address);
  }, [chainDone, address]);

  const markSkipped = useCallback(() => {
    if (address) persistTutorialSkipped(address);
  }, [address]);

  const markClaimed = useCallback(() => {
    if (address) persistTutorialClaimCompleted(CLAIM_SCOPE, address);
  }, [address]);

  return {
    isCompleted: localDone === true || chainDone === true,
    isLoading: localDone === null || (localDone === false && !!address && chainLoading),
    markSkipped,
    markClaimed,
  };
}

export const TUTORIAL_CLAIM_SCOPE = CLAIM_SCOPE;
