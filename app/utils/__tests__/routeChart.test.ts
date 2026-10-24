import { describe, expect, it } from "vitest";
import { computeRouteVisibility, layoutRoute, routeLanePath } from "../routeChart";

// 1 → 2 → 3 → (4a | 4b) → 5 → 6
const node = (id: number, prerequisites: number[], completed = false, isCurrent = false) => ({
  id,
  prerequisites,
  completed,
  isCurrent,
});

describe("computeRouteVisibility", () => {
  it("shows the cleared route, where the run is and what comes next, nothing further", () => {
    const v = computeRouteVisibility([
      node(1, [], true),
      node(2, [1], true),
      node(3, [2], false, true),
      node(41, [3]),
      node(42, [3]),
      node(5, [41, 42]),
      node(6, [5]),
    ]);
    expect([...v.visibleIds].sort()).toEqual([1, 2, 3, 41, 42]);
    expect(v.skippedIds.size).toBe(0);
  });

  it("marks the branch the run didn't take as skipped, and hides past it", () => {
    const v = computeRouteVisibility([
      node(1, [], true),
      node(2, [1], true),
      node(3, [2], true),
      node(41, [3], true),
      node(42, [3]),
      node(5, [41, 42], false, true),
      node(6, [5]),
      node(7, [6]),
    ]);
    expect(v.visibleIds.has(42)).toBe(true);
    expect([...v.skippedIds]).toEqual([42]);
    expect(v.visibleIds.has(6)).toBe(true);
    expect(v.visibleIds.has(7)).toBe(false);
  });

  it("at a fork, both options are next, not skipped", () => {
    const v = computeRouteVisibility([node(3, [], true, true), node(41, [3]), node(42, [3])]);
    expect(v.visibleIds.has(41) && v.visibleIds.has(42)).toBe(true);
    expect(v.skippedIds.size).toBe(0);
  });

  it("with no run, shows the start and its next missions", () => {
    const v = computeRouteVisibility([node(1, []), node(2, [1]), node(3, [2])]);
    expect([...v.visibleIds].sort()).toEqual([1, 2]);
  });
});

describe("layoutRoute", () => {
  // A campaign of 20 missions with 15 steps from start to end (five forks).
  const steps = Array.from({ length: 15 }, (_, i) =>
    [3, 6, 9, 11, 13].includes(i) ? [{ id: i * 10 }, { id: i * 10 + 1 }] : [{ id: i * 10 }],
  );

  it("fits a 15-step campaign in three rows on a desktop chart", () => {
    const layout = layoutRoute({ steps, width: 728, narrow: false });
    expect(layout.perRow).toBe(6);
    expect(layout.height).toBe(3 * layout.rowGap);
    expect(layout.positions.size).toBe(20);
  });

  it("winds: the second row runs back the other way", () => {
    const layout = layoutRoute({ steps, width: 728, narrow: false });
    const x = (step: number) => layout.positions.get(step * 10)!.x;
    expect(x(1)).toBeGreaterThan(x(0));
    expect(x(7)).toBeLessThan(x(6));
    expect(x(6)).toBeCloseTo(x(5));
  });

  it("puts a fork's missions side by side across the route", () => {
    const layout = layoutRoute({ steps, width: 728, narrow: false });
    const a = layout.positions.get(30)!;
    const b = layout.positions.get(31)!;
    expect(a.x).toBe(b.x);
    expect(Math.abs(a.y - b.y)).toBeGreaterThan(50);
  });

  it("keeps every stop inside the chart", () => {
    const layout = layoutRoute({ steps, width: 300, narrow: true });
    for (const p of layout.positions.values()) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(300);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(layout.height);
    }
  });
});

describe("routeLanePath", () => {
  const layout = { rowGap: 195, stepX: 145, width: 728 };

  it("bulges out past the right edge on a U-turn there", () => {
    const d = routeLanePath({ x: 728, y: 100 }, { x: 728, y: 295 }, layout);
    expect(d).toMatch(/^M 728 100 C 7(6|7)\d/);
  });

  it("is an S-curve along a row", () => {
    expect(routeLanePath({ x: 0, y: 100 }, { x: 145, y: 120 }, layout)).toBe("M 0 100 C 72.5 100 72.5 120 145 120");
  });
});
