"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useOnboardingTutorial } from "../hooks/useOnboardingTutorial";
import {
  TutorialContextValue,
  TUTORIAL_STEP_STORAGE_KEY,
  getTutorialAnalyticsRewardPath,
} from "../types/onboarding";
import { SimulatedGameDisplay } from "./SimulatedGameDisplay";
import posthog from "posthog-js";
import { useAppMode } from "../hooks/useAppMode";
import { useReportTutorialCompletionWeb2 } from "../hooks/useTutorialCompletedWeb2";
import {
  getTutorialReturnTo,
  isTutorialCompletionStep,
  markKnownPlayer,
  persistFirstBattleFinished,
} from "../utils/tutorialCompletion";

// Create context for tutorial
const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorialContext() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error(
      "useTutorialContext must be used within OnboardingTutorial",
    );
  }
  return context;
}

interface OnboardingTutorialProps {
  onComplete?: () => void;
  onSkip?: () => void;
  /** Signed out, leaving the battle is the way to sign in. */
  isSignedIn?: boolean;
}

export function OnboardingTutorial({
  onComplete,
  onSkip,
  isSignedIn = true,
}: OnboardingTutorialProps) {
  const tutorialContext = useOnboardingTutorial();

  const {
    currentStep,
    currentStepIndex,
    displayStepNumber,
    rescueCompletionBranch,
  } = tutorialContext;
  const appMode = useAppMode();
  // Opened as the Operations map's first mission (see app/(client)/play/GameClient.tsx).
  const [fromOperations] = useState(() => getTutorialReturnTo() === "mission");

  // Reaching a completion step finishes the tutorial: on this device, and on
  // a web2 account (web3 records it on chain with the reward claim).
  const reachedCompletion = isTutorialCompletionStep(currentStep?.id);
  useEffect(() => {
    if (reachedCompletion) persistFirstBattleFinished();
  }, [reachedCompletion]);
  useReportTutorialCompletionWeb2(currentStep?.id, appMode === "web2");

  const handleSkip = () => {
    const stepId = currentStep?.id ?? "unknown";
    const rewardPath = getTutorialAnalyticsRewardPath(
      stepId,
      rescueCompletionBranch,
    );
    posthog.capture("tutorial_abandoned", {
      step_id: stepId,
      step_index: currentStepIndex,
      display_step_number: displayStepNumber,
      rescue_branch: rescueCompletionBranch,
      reward_path: rewardPath,
    });
    // Leaving signed out means "Sign in": this browser has a player now, so
    // /play shows sign-in rather than the battle from here on.
    if (!isSignedIn) markKnownPlayer();
    // Clear saved step index when quitting the tutorial.
    if (typeof window !== "undefined") {
      localStorage.removeItem(TUTORIAL_STEP_STORAGE_KEY);
    }
    onSkip?.();
  };

  return (
    <TutorialContext.Provider value={tutorialContext}>
      <div className="relative h-full w-full overflow-hidden">
        {!currentStep ? (
          <div className="flex min-h-[70vh] items-center justify-center">
            <div className="text-cyan font-mono">Loading tutorial...</div>
          </div>
        ) : (
          <>
            <SimulatedGameDisplay
              tutorialContext={tutorialContext}
              onBack={handleSkip}
              continueToFleetSelection={fromOperations}
              exitLabel={isSignedIn ? "Quit" : "Sign in"}
            />
          </>
        )}
      </div>
    </TutorialContext.Provider>
  );
}
