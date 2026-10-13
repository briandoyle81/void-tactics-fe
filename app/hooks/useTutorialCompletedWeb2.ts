"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { useCurrentUser } from "./useCurrentUser";
import {
  hasCompletedFirstBattle,
  hasSkippedTutorial,
  notifyTutorialCompletionChanged,
  persistTutorialSkipped,
  TUTORIAL_COMPLETION_CHANGED_EVENT,
} from "../utils/tutorialCompletion";

const TUTORIAL_QUERY_KEY = ["user", "me", "tutorial"] as const;

type TutorialRecord = { tutorialCompleted: boolean; tutorialPath: string | null };

async function postTutorialPath(path: "win" | "loss" | "skipped"): Promise<void> {
  await fetch("/api/user/me/tutorial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
}

/**
 * Web2 counterpart to useTutorialCompleted: the account's record
 * (GET /api/user/me/tutorial), or finished/skipped on this device.
 */
export function useTutorialCompletedWeb2() {
  const { userId, isLoggedIn } = useCurrentUser();
  const queryClient = useQueryClient();
  const [localDone, setLocalDone] = useState<boolean | null>(null);

  useEffect(() => {
    const read = () => setLocalDone(hasCompletedFirstBattle() || (!!userId && hasSkippedTutorial(userId)));
    read();
    window.addEventListener(TUTORIAL_COMPLETION_CHANGED_EVENT, read);
    return () => window.removeEventListener(TUTORIAL_COMPLETION_CHANGED_EVENT, read);
  }, [userId]);

  const { data, isLoading } = useQuery({
    queryKey: TUTORIAL_QUERY_KEY,
    queryFn: () => apiFetch<TutorialRecord>("/api/user/me/tutorial"),
    enabled: isLoggedIn,
    staleTime: 5 * 60_000,
  });

  const markSkipped = useCallback(() => {
    if (!userId) return;
    persistTutorialSkipped(userId);
    void postTutorialPath("skipped").then(() => queryClient.invalidateQueries({ queryKey: TUTORIAL_QUERY_KEY }));
  }, [userId, queryClient]);

  return {
    isCompleted: localDone === true || data?.tutorialCompleted === true,
    isLoading: localDone === null || (localDone === false && isLoggedIn && isLoading),
    markSkipped,
  };
}

/**
 * Records a web2 player's finished tutorial on their account once they
 * reach a completion step (win: the sniper branch, loss: the retreat one).
 */
export function useReportTutorialCompletionWeb2(stepId: string | undefined, enabled: boolean) {
  const { isLoggedIn } = useCurrentUser();
  const queryClient = useQueryClient();
  const reported = useRef(false);
  useEffect(() => {
    if (!enabled || !isLoggedIn || reported.current) return;
    const path = stepId === "completion-sniper" ? "win" : stepId === "completion-retreat" ? "loss" : null;
    if (!path) return;
    reported.current = true;
    void postTutorialPath(path).then(() => {
      void queryClient.invalidateQueries({ queryKey: TUTORIAL_QUERY_KEY });
      notifyTutorialCompletionChanged();
    });
  }, [enabled, isLoggedIn, stepId, queryClient]);
}
