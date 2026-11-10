import { describe, expect, it } from "vitest";
import { orderColumns } from "../graphColumnOrder";

const n = (id: number, prerequisites: number[] = []) => ({ id, prerequisites });

describe("orderColumns", () => {
  // The Edit Mode chart from the bug report: 1 -> {2, 3}; 2 -> 6 (skips two
  // columns); 3 -> 4 -> 5 -> 6.
  const columns = [[n(1)], [n(2, [1]), n(3, [1])], [n(4, [3])], [n(5, [4])], [n(6, [2, 5])]];

  it("gives a link that skips columns a slot in each column it passes", () => {
    const { slots, lanes } = orderColumns(columns);
    expect(lanes.get("2-6")).toHaveLength(2);
    expect(slots[2]).toHaveLength(2);
    expect(slots[3]).toHaveLength(2);
  });

  it("keeps the long link on its own side, apart from the branch it skips", () => {
    const { slots } = orderColumns(columns);
    const ids = slots.map((col) => col.map((s) => (s.kind === "node" ? s.id : "lane")));
    expect(ids[1]).toEqual([2, 3]);
    expect(ids[2]).toEqual(["lane", 4]);
    expect(ids[3]).toEqual(["lane", 5]);
  });

  it("orders a column by its parents to avoid crossings", () => {
    // 1 -> 4, 2 -> 3: 3 and 4 swap so the links don't cross.
    const { slots } = orderColumns([[n(1), n(2)], [n(3, [2]), n(4, [1])]]);
    expect(slots[1].map((s) => (s.kind === "node" ? s.id : null))).toEqual([4, 3]);
  });

  it("ignores links that point back (a manual column override)", () => {
    const { lanes, slots } = orderColumns([[n(1, [3])], [n(2, [1])], [n(3, [2])]]);
    expect(lanes.size).toBe(0);
    expect(slots.flat()).toHaveLength(3);
  });
});
