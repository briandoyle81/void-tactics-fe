// The Operations star chart during a run ("charted route"): only the part of
// the campaign the player has reached is drawn, and the route winds back and
// forth across the chart so a whole campaign (about 15 steps from start to
// end, 20 missions in all) fits without scrolling on desktop.
//
// - Visibility: missions cleared, where the run is (or, with no run, the
//   campaign's first mission), and the missions that come next. A mission
//   off a route the player didn't take shows as skipped. Everything further
//   on stays hidden; the chart hints at it with a fading trail.
// - Layout: each mission's step (its depth from the start) is a stop along
//   a winding route: left to right, a U-turn, right to left, and so on.
//   Missions at the same step (a fork) sit side by side across the route.
//   Positions come from the whole campaign, so nothing moves as more of it
//   is revealed.
// Pure and number-native; CampaignGraphCanvas draws it, RunMap feeds it.

export interface RouteChartNode {
  id: number;
  prerequisites: readonly number[];
  completed: boolean;
  isCurrent: boolean;
}

export interface RouteVisibility {
  visibleIds: ReadonlySet<number>;
  /** Visible, but off a route the run didn't take. */
  skippedIds: ReadonlySet<number>;
}

/** Which missions the chart shows during a run (see the file comment). */
export function computeRouteVisibility(nodes: readonly RouteChartNode[]): RouteVisibility {
  const childrenOf = new Map<number, number[]>();
  for (const n of nodes) {
    for (const p of n.prerequisites) {
      const list = childrenOf.get(p) ?? [];
      list.push(n.id);
      childrenOf.set(p, list);
    }
  }
  const visible = new Set<number>();
  // Where the run is; with no run, the campaign's start.
  let anchors = nodes.filter((n) => n.isCurrent);
  if (anchors.length === 0) anchors = nodes.filter((n) => n.prerequisites.length === 0);
  for (const n of nodes) if (n.completed) visible.add(n.id);
  for (const a of anchors) {
    visible.add(a.id);
    for (const c of childrenOf.get(a.id) ?? []) visible.add(c);
  }
  // A cleared mission's other branches: the routes not taken.
  const skipped = new Set<number>();
  for (const n of nodes) {
    if (!n.completed || anchors.some((a) => a.id === n.id)) continue;
    for (const c of childrenOf.get(n.id) ?? []) {
      if (!visible.has(c)) {
        visible.add(c);
        skipped.add(c);
      }
    }
  }
  return { visibleIds: visible, skippedIds: skipped };
}

export interface RouteLayoutInput {
  /** Missions grouped by step (depth from the start), in display order. */
  steps: readonly (readonly { id: number }[])[];
  /** The chart's width in px (the area inside the padding). */
  width: number;
  /** Narrow (phone) charts pack fewer, closer stops per row. */
  narrow: boolean;
}

export interface RouteLayout {
  positions: Map<number, { x: number; y: number; step: number }>;
  width: number;
  height: number;
  /** Stops per row and px between rows, for the lanes' curves. */
  perRow: number;
  rowGap: number;
  stepX: number;
}

/** Narrowest gap between two stops in a row (a node card is 96px wide). */
const MIN_STEP_X = 125;
const MIN_STEP_X_NARROW = 104;
const ROW_GAP = 150;
/** Extra row height per mission side by side at one step, so a fork's labels clear each other. */
const ROW_GAP_PER_BRANCH = 45;
/** How far the route bobs up and down between stops, as a share of the row gap. */
const WOBBLE = 0.1;

/** Positions along the winding route (see the file comment). */
export function layoutRoute({ steps, width, narrow }: RouteLayoutInput): RouteLayout {
  const stepCount = Math.max(1, steps.length);
  const minStep = narrow ? MIN_STEP_X_NARROW : MIN_STEP_X;
  const perRow = Math.max(1, Math.min(stepCount, Math.floor(width / minStep) + 1));
  const rows = Math.ceil(stepCount / perRow);
  const widest = Math.max(1, ...steps.map((s) => s.length));
  const rowGap = ROW_GAP + ROW_GAP_PER_BRANCH * (widest - 1);
  const stepX = perRow > 1 ? width / (perRow - 1) : 0;
  const branchSpread = rowGap * 0.3;
  const positions = new Map<number, { x: number; y: number; step: number }>();
  steps.forEach((missions, step) => {
    const row = Math.floor(step / perRow);
    const k = step % perRow;
    const col = row % 2 === 0 ? k : perRow - 1 - k;
    const x = perRow > 1 ? col * stepX : width / 2;
    const yBase = row * rowGap + rowGap / 2 + Math.sin(step * 1.7) * rowGap * WOBBLE;
    missions.forEach((m, i) => {
      positions.set(m.id, { x, y: yBase + (i - (missions.length - 1) / 2) * branchSpread, step });
    });
  });
  return { positions, width, height: rows * rowGap, perRow, rowGap, stepX };
}

/**
 * The lane between two stops as an SVG path: an S-curve along a row, a
 * U-turn bulging outward between rows, and a gentle curve otherwise.
 */
export function routeLanePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  layout: Pick<RouteLayout, "rowGap" | "stepX" | "width">,
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dy) > layout.rowGap * 0.6 && Math.abs(dx) < Math.max(layout.stepX / 2, 1)) {
    // A U-turn at the end of a row: bulge out past the edge it turns at.
    const bulge = (from.x >= layout.width / 2 ? 1 : -1) * Math.min(48, Math.max(layout.stepX * 0.4, 24));
    return `M ${from.x} ${from.y} C ${from.x + bulge} ${from.y} ${to.x + bulge} ${to.y} ${to.x} ${to.y}`;
  }
  if (Math.abs(dy) < layout.rowGap * 0.6) {
    const mx = from.x + dx / 2;
    return `M ${from.x} ${from.y} C ${mx} ${from.y} ${mx} ${to.y} ${to.x} ${to.y}`;
  }
  const my = from.y + dy / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${my} ${to.x} ${my} ${to.x} ${to.y}`;
}
