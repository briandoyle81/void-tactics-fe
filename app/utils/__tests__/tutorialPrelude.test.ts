import { describe, expect, it } from "vitest";
import { TUTORIAL_PRELUDE_NODE_ID, withTutorialPrelude } from "../tutorialPrelude";

const node = (id: number, prerequisites: number[] = []) => ({
  id,
  prerequisites,
  unlocked: id === 1,
  selectable: id === 1,
  isCurrent: false,
  completed: false,
  title: `Node ${id}`,
});

describe("withTutorialPrelude", () => {
  const nodes = [node(1), node(2, [1])];
  const prelude = { ...node(0), title: "First Contact" };

  it("puts the prelude ahead of the root and locks the root", () => {
    const out = withTutorialPrelude(nodes, 1, prelude);
    expect(out[0]).toMatchObject({ id: TUTORIAL_PRELUDE_NODE_ID, unlocked: true, selectable: true, isCurrent: true });
    expect(out.find((n) => n.id === 1)).toMatchObject({
      prerequisites: [TUTORIAL_PRELUDE_NODE_ID],
      unlocked: false,
      selectable: false,
    });
    expect(out.find((n) => n.id === 2)).toEqual(nodes[1]);
  });

  it("keeps a done prelude on the map, cleared, without locking the root", () => {
    const out = withTutorialPrelude(nodes, 1, prelude, { done: true });
    expect(out[0]).toMatchObject({ id: TUTORIAL_PRELUDE_NODE_ID, completed: true, isCurrent: false, selectable: true });
    expect(out.find((n) => n.id === 1)).toMatchObject({
      prerequisites: [TUTORIAL_PRELUDE_NODE_ID],
      unlocked: true,
      selectable: true,
    });
  });

  it("leaves the map alone without a known root", () => {
    expect(withTutorialPrelude(nodes, null, prelude)).toEqual(nodes);
    expect(withTutorialPrelude(nodes, 9, prelude)).toEqual(nodes);
  });
});
