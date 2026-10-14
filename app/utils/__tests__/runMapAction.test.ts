import { describe, expect, it } from "vitest";
import { getRunMapAction, isCurrentNodeCleared, type RunMapActionInput } from "../runMapAction";

const base: RunMapActionInput = {
  isBrowseMode: false,
  selectedKind: "combat",
  isCurrentNode: false,
  isReachableChild: true,
  isDefeated: false,
  hasActiveGame: false,
  currentCleared: true,
  isEnteringResupply: false,
};

describe("getRunMapAction", () => {
  it("starts a run from the run-less map preview", () => {
    expect(getRunMapAction({ ...base, isBrowseMode: true, canStartRun: true })).toEqual({
      type: "start",
      label: "Start run",
      disabled: false,
    });
    expect(getRunMapAction({ ...base, isBrowseMode: true, selectedKind: null, canStartRun: true }).type).toBe("start");
  });

  it("offers the tutorial first when the player hasn't done it", () => {
    const browse = { ...base, isBrowseMode: true, canStartRun: true, tutorialPending: true };
    expect(getRunMapAction({ ...browse, isTutorialPrelude: true })).toEqual({
      type: "tutorial",
      label: "Begin First Contact",
      disabled: false,
      secondary: { label: "Skip Tutorial" },
    });
    // Start run waits until the tutorial is done or skipped.
    expect(getRunMapAction({ ...browse, isTutorialPrelude: false }).type).toBe("none");
    // Once done, the prelude stays on the map but has nothing to launch.
    expect(getRunMapAction({ ...base, isTutorialPrelude: true })).toEqual({
      type: "none",
      label: "Completed",
      disabled: true,
    });
    expect(getRunMapAction({ ...base, isBrowseMode: true, canStartRun: true, isTutorialPrelude: true }).type).toBe("start");
  });

  it("warps to a reachable combat node", () => {
    expect(getRunMapAction(base)).toEqual({ type: "warp", label: "Warp to mission", disabled: false });
  });

  it("warps to the current node until it's cleared", () => {
    expect(getRunMapAction({ ...base, isCurrentNode: true, isReachableChild: false }).type).toBe("warp");
    expect(getRunMapAction({ ...base, isCurrentNode: true, isDefeated: true })).toEqual({
      type: "none",
      label: "Pick your next mission",
      disabled: true,
    });
  });

  it("returns to a live match instead of relaunching", () => {
    expect(getRunMapAction({ ...base, isCurrentNode: true, hasActiveGame: true })).toEqual({
      type: "resume",
      label: "Return to battle",
      disabled: false,
    });
  });

  it("enters reachable resupply nodes", () => {
    expect(getRunMapAction({ ...base, selectedKind: "resupply" }).type).toBe("resupply");
    expect(getRunMapAction({ ...base, selectedKind: "resupply", isEnteringResupply: true })).toEqual({
      type: "resupply",
      label: "Entering…",
      disabled: true,
    });
  });

  it("is disabled for cleared, unreachable or unselected nodes, and while browsing", () => {
    expect(getRunMapAction({ ...base, isDefeated: true }).label).toBe("Already cleared");
    expect(getRunMapAction({ ...base, isReachableChild: false }).label).toBe("Not reachable");
    expect(getRunMapAction({ ...base, selectedKind: null }).label).toBe("Select a mission");
    expect(getRunMapAction({ ...base, isBrowseMode: true }).label).toBe("Start a run to enter");
  });
});

describe("next missions wait for the current one", () => {
  it("won't warp to a next mission until the current one is beaten", () => {
    const blocked = getRunMapAction({ ...base, currentCleared: false });
    expect(blocked).toEqual({ type: "none", label: "Finish your current mission", disabled: true });
    expect(getRunMapAction({ ...base, selectedKind: "resupply", currentCleared: false }).disabled).toBe(true);
    expect(getRunMapAction({ ...base, currentCleared: true }).type).toBe("warp");
  });
  it("still lets the player launch or return to the current mission", () => {
    expect(getRunMapAction({ ...base, isCurrentNode: true, currentCleared: false }).type).toBe("warp");
    expect(
      getRunMapAction({ ...base, isCurrentNode: true, hasActiveGame: true, currentCleared: false }).type,
    ).toBe("resume");
  });
});

describe("isCurrentNodeCleared", () => {
  it("is cleared after winning a combat mission", () => {
    expect(isCurrentNodeCleared({ kind: "combat", isDefeated: true, hasActiveGame: false })).toBe(true);
  });
  it("isn't cleared before the mission is won (including a run's first mission)", () => {
    expect(isCurrentNodeCleared({ kind: "combat", isDefeated: false, hasActiveGame: false })).toBe(false);
  });
  it("isn't cleared while a match is in progress", () => {
    expect(isCurrentNodeCleared({ kind: "combat", isDefeated: false, hasActiveGame: true })).toBe(false);
    expect(isCurrentNodeCleared({ kind: "resupply", isDefeated: false, hasActiveGame: true })).toBe(false);
  });
  it("is cleared on a resupply stop, which has no fight", () => {
    expect(isCurrentNodeCleared({ kind: "resupply", isDefeated: false, hasActiveGame: false })).toBe(true);
  });
  it("isn't cleared with no current node", () => {
    expect(isCurrentNodeCleared({ kind: null, isDefeated: false, hasActiveGame: false })).toBe(false);
  });
});
