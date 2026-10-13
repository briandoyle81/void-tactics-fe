"use client";

import React from "react";
import { useRoguelikeRunWeb2 } from "../hooks/useRoguelikeWeb2";
import { RoguelikeRunStartWeb2 } from "./RoguelikeRunStartWeb2";
import { RoguelikeGraphWeb2 } from "./RoguelikeGraphWeb2";
import {
  BackToCampaignMapButton,
  closeFleetSelection,
  openFleetSelection,
  useFleetSelectionParam,
} from "./RoguelikeCampaign";
import { useTutorialCompletedWeb2 } from "../hooks/useTutorialCompletedWeb2";
import { startTutorialFromOperations } from "../utils/tutorialCompletion";
import { useTrackRunEnded } from "../hooks/useTrackRunEnded";

// Web2 counterpart to RoguelikeCampaign.tsx — branches on active-run same
// as web3, with the same run-less map preview, tutorial prelude and fleet
// selection.
export function RoguelikeCampaignWeb2() {
  const { run, isLoading, error, refetch } = useRoguelikeRunWeb2();
  const choosingFleet = useFleetSelectionParam();
  const tutorial = useTutorialCompletedWeb2();

  useTrackRunEnded({
    appMode: "web2",
    isActive: isLoading || error ? null : run?.status === "ACTIVE",
    campaignId: run?.campaignId,
  });

  if (isLoading) {
    return <div className="text-center font-mono text-sm text-text-muted">Loading run…</div>;
  }
  if (error) {
    return (
      <div className="text-center font-mono text-sm text-warning-red">
        [ERR] Failed to load run: {error.message}
      </div>
    );
  }

  if (!run) {
    if (!choosingFleet) {
      return (
        <RoguelikeGraphWeb2
          run={null}
          onRunEnded={() => {}}
          onStartRun={tutorial.isLoading ? undefined : openFleetSelection}
          tutorialDone={tutorial.isCompleted}
          tutorial={
            tutorial.isLoading || tutorial.isCompleted
              ? undefined
              : { onStart: startTutorialFromOperations, onSkip: tutorial.markSkipped }
          }
        />
      );
    }
    return (
      <div className="flex flex-col gap-4">
        <BackToCampaignMapButton onClick={() => closeFleetSelection({ back: true })} />
        <RoguelikeRunStartWeb2
          onRunStarted={() => {
            closeFleetSelection({ replace: true });
            void refetch();
          }}
        />
      </div>
    );
  }

  return <RoguelikeGraphWeb2 run={run} onRunEnded={() => void refetch()} tutorialDone={tutorial.isCompleted} />;
}
