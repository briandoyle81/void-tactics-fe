"use client";

import { MissionBriefing } from "../MissionBriefing";
import { MissionDossier } from "../MissionDossier";
import { MissionDrawerContent } from "./MissionDrawerContent";
import { TUTORIAL_PRELUDE } from "../../data/dialog/tutorial";

// The run map drawer for the tutorial prelude node (see tutorialPrelude.ts).
// Shared by RoguelikeGraph and RoguelikeGraphWeb2.
export function TutorialPreludeDrawer() {
  return (
    <MissionDrawerContent
      title={TUTORIAL_PRELUDE.title}
      titleStatus="ok"
      kindLabel="Combat"
      briefing={
        <MissionBriefing mission={{ kind: "tutorial" }} text={TUTORIAL_PRELUDE.briefing} status="ok" compact />
      }
      dossier={
        <MissionDossier
          rows={[
            { label: "Your fleet", value: "Assigned by Headquarters" },
            { label: "Reward", value: "Ships for your own fleet", tone: "good" },
            { label: "After", value: "Pick your fleet and start the operation" },
          ]}
        />
      }
    />
  );
}
