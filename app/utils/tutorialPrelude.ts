import { RoguelikeNodeKind } from "../types/roguelike";
import { TUTORIAL_PRELUDE } from "../data/dialog/tutorial";

// The tutorial ("first battle") as the first mission on the Operations map,
// for players who haven't done it (useTutorialCompleted /
// useTutorialCompletedWeb2). It isn't a contract node: the tutorial is a
// scripted simulation, so the map draws an extra node ahead of the
// campaign's root, and finishing or skipping it leads into fleet selection
// and the real run. Shared by RoguelikeGraph (web3) and RoguelikeGraphWeb2.

/** The prelude node's id on the map; clear of real node ids and the editor's + ADD NODE. */
export const TUTORIAL_PRELUDE_NODE_ID = Number.MAX_SAFE_INTEGER - 1;

/** The prelude as a run map node (RoguelikeGraph / RoguelikeGraphWeb2's canvas node shape). */
export const TUTORIAL_PRELUDE_CANVAS_NODE = {
  id: TUTORIAL_PRELUDE_NODE_ID,
  kind: RoguelikeNodeKind.Combat,
  prerequisites: [] as number[],
  completed: false,
  unlocked: true,
  isCurrent: true,
  selectable: true,
  title: TUTORIAL_PRELUDE.title,
  titleStatus: "ok" as const,
  editMode: false,
  connectHighlight: undefined,
};

interface PreludeMapNode {
  id: number;
  prerequisites: number[];
  unlocked: boolean;
  selectable: boolean;
  isCurrent: boolean;
  completed: boolean;
}

/**
 * `nodes` with the prelude added ahead of `rootNodeId` (the root lists it as
 * a prerequisite, so the depth-tiered layout puts the prelude first).
 * Pending: the prelude is the current mission and the root stays locked
 * until it's done. Done (finished or skipped): it stays on the map, cleared,
 * and the root keeps its own state.
 */
export function withTutorialPrelude<T extends PreludeMapNode>(
  nodes: readonly T[],
  rootNodeId: number | null,
  prelude: T,
  { done = false }: { done?: boolean } = {},
): T[] {
  if (rootNodeId == null || !nodes.some((n) => n.id === rootNodeId)) return [...nodes];
  return [
    {
      ...prelude,
      id: TUTORIAL_PRELUDE_NODE_ID,
      prerequisites: [],
      unlocked: true,
      selectable: true,
      isCurrent: !done,
      completed: done,
    },
    ...nodes.map((n) =>
      n.id !== rootNodeId
        ? n
        : done
          ? { ...n, prerequisites: [...n.prerequisites, TUTORIAL_PRELUDE_NODE_ID] }
          : { ...n, prerequisites: [...n.prerequisites, TUTORIAL_PRELUDE_NODE_ID], unlocked: false, selectable: false },
    ),
  ];
}
