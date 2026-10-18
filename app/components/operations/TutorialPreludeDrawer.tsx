"use client";

import { MissionBriefing } from "../MissionBriefing";
import { MissionDossier } from "../MissionDossier";
import { MissionDrawerContent } from "./MissionDrawerContent";
import { TUTORIAL_PRELUDE } from "../../data/dialog/tutorial";
import type { MissionPeek } from "./OperationsMap";

// The run map drawer for the tutorial prelude node (see tutorialPrelude.ts).
// Shared by RoguelikeGraph and RoguelikeGraphWeb2. `completed`: played or
// skipped, shown cleared.

/** The phone bar for the prelude node (OperationsMap's `peek`). */
export const TUTORIAL_PRELUDE_PEEK: MissionPeek = {
  title: TUTORIAL_PRELUDE.title,
  kindLabel: "Combat",
  teaser: TUTORIAL_PRELUDE.briefing,
};

export function TutorialPreludeDrawer({ completed = false }: { completed?: boolean }) {
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
            ...(completed ? [{ label: "Status", value: "Cleared", tone: "good" as const }] : []),
            { label: "Your fleet", value: "Assigned by Headquarters" },
            { label: "Reward", value: "Ships for your own fleet", tone: "good" },
            { label: "After", value: "Pick your fleet and start the operation" },
          ]}
        />
      }
    />
  );
}
