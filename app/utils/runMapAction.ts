// The run map's primary action (bottom right of the action bar) for the
// selected node. Shared by RoguelikeGraph (web3) and RoguelikeGraphWeb2.

export type RunMapActionType = "start" | "tutorial" | "warp" | "resume" | "resupply" | "none";

export interface RunMapAction {
  type: RunMapActionType;
  label: string;
  disabled: boolean;
  /** A smaller second choice beside the action (the tutorial's skip). */
  secondary?: { label: string };
}

export interface RunMapActionInput {
  /** No run: browsing or editing the map. */
  isBrowseMode: boolean;
  /** No run, and the player can start one from here (opens fleet selection). */
  canStartRun?: boolean;
  /**
   * No run, and the player hasn't done the tutorial: it's the first
   * mission (tutorialPrelude.ts), ahead of Start run.
   */
  tutorialPending?: boolean;
  /** The selected node is the tutorial prelude (pending, or cleared once done). */
  isTutorialPrelude?: boolean;
  selectedKind: "combat" | "resupply" | null;
  isCurrentNode: boolean;
  isReachableChild: boolean;
  isDefeated: boolean;
  /** A match for this run is already live (web3 run.activeGameId). */
  hasActiveGame: boolean;
  /**
   * The run's current node is done (isCurrentNodeCleared), so its next
   * nodes can be entered. Until then they only show what's ahead.
   */
  currentCleared: boolean;
  isEnteringResupply: boolean;
  /**
   * At a fork, the next missions whose briefs the player hasn't opened yet:
   * entering one waits until they've looked at every option.
   */
  unreviewedOptions?: number;
}

const none = (label: string): RunMapAction => ({ type: "none", label, disabled: true });

/**
 * Whether the player can move on from their current node: a resupply stop,
 * or a combat mission they've beaten, with no match still in progress. The
 * next missions open only after the current one is won.
 */
export function isCurrentNodeCleared(current: {
  kind: "combat" | "resupply" | null;
  isDefeated: boolean;
  hasActiveGame: boolean;
}): boolean {
  if (current.hasActiveGame || current.kind === null) return false;
  return current.kind === "resupply" || current.isDefeated;
}

export function getRunMapAction(input: RunMapActionInput): RunMapAction {
  if (input.isBrowseMode && input.tutorialPending) {
    return input.isTutorialPrelude
      ? { type: "tutorial", label: "Begin First Contact", disabled: false, secondary: { label: "Skip Tutorial" } }
      : none("Select a mission");
  }
  if (input.isBrowseMode && input.canStartRun) return { type: "start", label: "Start run", disabled: false };
  // The tutorial prelude once played or skipped: nothing to launch there.
  if (input.isTutorialPrelude) return none("Completed");
  if (input.selectedKind === null) return none("Select a mission");
  if (input.isBrowseMode) return none("Start a run to enter");

  if (input.isCurrentNode) {
    // At a resupply stop: back to its fleet and repairs (RunMap reopens it).
    if (input.selectedKind === "resupply") return { type: "resupply", label: "Resupply Fleet", disabled: false };
    if (input.isDefeated) return none("Pick your next mission");
    // Relaunching while a match is live would revert; go back to it instead.
    if (input.hasActiveGame) return { type: "resume", label: "Return to battle", disabled: false };
    return { type: "warp", label: "Warp to mission", disabled: false };
  }

  if (!input.isReachableChild) return none("Not reachable");
  if (!input.currentCleared) return none("Finish your current mission");
  if ((input.unreviewedOptions ?? 0) > 0) return none("Review Options");

  if (input.selectedKind === "resupply") {
    return input.isEnteringResupply
      ? { type: "resupply", label: "Entering…", disabled: true }
      : { type: "resupply", label: "Resupply Fleet", disabled: false };
  }
  if (input.isDefeated) return none("Already cleared");
  return { type: "warp", label: "Warp to mission", disabled: false };
}
