"use client";

import React from "react";
import { CAMPAIGN_NODE_WIDTH, CAMPAIGN_NODE_HEIGHT, CAMPAIGN_NODE_CIRCLE_OFFSET_Y } from "./CampaignNodeCard";
import { layoutRoute, routeLanePath, type RouteLayout, type RouteVisibility } from "../utils/routeChart";

const MIN_COL_WIDTH = 230;
const ROW_HEIGHT = 170;
const CANVAS_PADDING = 56;
const CANVAS_MIN_HEIGHT = 560;
// Phones: the route runs top to bottom instead (tiers become rows, so a
// long chart scrolls the way the phone does), in a box capped at 60% of the
// screen so the mission bar and the action stay on screen below it.
const NARROW_WIDTH = 640;
const VERTICAL_TIER_HEIGHT = 120;
const VERTICAL_MIN_SLOT_WIDTH = 112;
const VERTICAL_PADDING = 28;
const VERTICAL_MAX_HEIGHT = "60dvh";

export interface CampaignGraphCanvasNode {
  id: number;
  prerequisites: number[];
  completed: boolean;
  unlocked: boolean;
}

interface NodePosition {
  x: number;
  y: number;
  /** Depth tier: a column, or a row when vertical. */
  col: number;
}

interface GraphLayout<TNode extends CampaignGraphCanvasNode> {
  columns: TNode[][];
  positions: Map<number, NodePosition>;
  width: number;
  height: number;
  vertical: boolean;
  /** The charted-route layout (app/utils/routeChart.ts), when the chart draws one. */
  route?: RouteLayout & RouteVisibility;
}

// Depth = 1 + max(prerequisite depths), root nodes (no prerequisites) sit
// at depth 0 — this is what turns the graph into columns/tiers.
function groupNodesByDepth<TNode extends CampaignGraphCanvasNode>(
  nodes: TNode[],
  manualColumnOverrides: Record<number, number>,
): TNode[][] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depthCache = new Map<number, number>();

  function depthOf(node: TNode, seen: Set<number>): number {
    if (depthCache.has(node.id)) return depthCache.get(node.id)!;
    if (node.prerequisites.length === 0) {
      depthCache.set(node.id, 0);
      return 0;
    }
    if (seen.has(node.id)) return 0; // guard against a cycle in bad data
    seen.add(node.id);
    const prereqDepths = node.prerequisites.map((pid) => {
      const prereq = byId.get(pid);
      return prereq ? depthOf(prereq, seen) : 0;
    });
    const depth = 1 + Math.max(...prereqDepths);
    depthCache.set(node.id, depth);
    return depth;
  }

  const columns: TNode[][] = [];
  nodes.forEach((node) => {
    const rawDepth = depthOf(node, new Set());
    const override = manualColumnOverrides[node.id];
    const depth = override !== undefined ? override - 1 : rawDepth;
    if (!columns[depth]) columns[depth] = [];
    columns[depth].push(node);
  });
  columns.forEach((col) => col?.sort((a, b) => a.id - b.id));
  return columns;
}

function layoutGraph<TNode extends CampaignGraphCanvasNode>(
  columns: TNode[][],
  colWidth: number,
): GraphLayout<TNode> {
  const maxRows = Math.max(1, ...columns.map((c) => (c ?? []).length));
  const totalHeight = maxRows * ROW_HEIGHT;

  const positions = new Map<number, NodePosition>();
  columns.forEach((col, colIndex) => {
    const list = col ?? [];
    const colHeight = list.length * ROW_HEIGHT;
    const yOffset = (totalHeight - colHeight) / 2;
    list.forEach((node, rowIndex) => {
      positions.set(node.id, {
        x: colIndex * colWidth + colWidth / 2,
        y: yOffset + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2,
        col: colIndex,
      });
    });
  });

  return { columns, positions, width: columns.length * colWidth, height: totalHeight, vertical: false };
}

// Phones: tier 0 at the top, each tier a row, its nodes spread across the
// width (wider than the box only when a tier has more nodes than fit).
function layoutGraphVertical<TNode extends CampaignGraphCanvasNode>(
  columns: TNode[][],
  availableWidth: number,
): GraphLayout<TNode> {
  const maxPerTier = Math.max(1, ...columns.map((c) => (c ?? []).length));
  const width = Math.max(availableWidth, maxPerTier * VERTICAL_MIN_SLOT_WIDTH);
  const positions = new Map<number, NodePosition>();
  columns.forEach((tier, tierIndex) => {
    const list = tier ?? [];
    const slot = width / Math.max(list.length, 1);
    list.forEach((node, i) => {
      positions.set(node.id, {
        x: slot * i + slot / 2,
        y: tierIndex * VERTICAL_TIER_HEIGHT + VERTICAL_TIER_HEIGHT / 2,
        col: tierIndex,
      });
    });
  });
  return { columns, positions, width, height: columns.length * VERTICAL_TIER_HEIGHT, vertical: true };
}

// The charted route (app/utils/routeChart.ts): the steps wind across the
// chart; the columns stay the depth tiers, so lanes and selection work as before.
function layoutGraphRoute<TNode extends CampaignGraphCanvasNode>(
  columns: TNode[][],
  availableWidth: number,
  padding: number,
  narrow: boolean,
  visibility: RouteVisibility,
): GraphLayout<TNode> {
  // Stops at the edges keep their whole label on the chart (the phone's
  // padding is narrower than half a node card).
  const inset = Math.max(0, CAMPAIGN_NODE_WIDTH / 2 - padding);
  const route = layoutRoute({
    steps: columns.map((c) => c ?? []),
    width: Math.max(0, availableWidth - inset * 2),
    narrow,
  });
  const positions = new Map<number, NodePosition>();
  route.positions.forEach((p, id) => positions.set(id, { x: p.x + inset, y: p.y, col: p.step }));
  return {
    columns,
    positions,
    width: availableWidth,
    height: route.height,
    vertical: narrow,
    route: { ...route, width: availableWidth, ...visibility },
  };
}

// Starfield backdrop — two stacked CSS-only repeating radial-gradient
// layers (no images/canvas): a static field for texture, plus a dimmer
// twinkling field for ambient motion (disabled under prefers-reduced-motion
// via the campaign-starfield-twinkle class in globals.css).
function Starfield({ backdropSrc }: { backdropSrc?: string | null }) {
  const staticStars: React.CSSProperties = {
    backgroundImage: `
      radial-gradient(1px 1px at 24px 32px, rgba(226,232,240,0.55) 50%, transparent 51%),
      radial-gradient(1px 1px at 96px 84px, rgba(226,232,240,0.4) 50%, transparent 51%),
      radial-gradient(1.5px 1.5px at 156px 46px, rgba(86,214,255,0.5) 50%, transparent 51%),
      radial-gradient(1px 1px at 206px 128px, rgba(226,232,240,0.35) 50%, transparent 51%),
      radial-gradient(1.5px 1.5px at 44px 140px, rgba(107,255,143,0.3) 50%, transparent 51%)
    `,
    backgroundSize: "280px 170px",
    backgroundRepeat: "repeat",
  };
  const twinkleStars: React.CSSProperties = {
    backgroundImage: `
      radial-gradient(1px 1px at 70px 20px, rgba(255,255,255,0.6) 50%, transparent 51%),
      radial-gradient(1px 1px at 180px 96px, rgba(255,255,255,0.5) 50%, transparent 51%),
      radial-gradient(1.5px 1.5px at 12px 108px, rgba(255,184,77,0.4) 50%, transparent 51%)
    `,
    backgroundSize: "260px 190px",
    backgroundRepeat: "repeat",
  };
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ backgroundColor: "var(--color-near-black)" }}>
      {backdropSrc && (
        <div
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: `url(${backdropSrc})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}
      <div className="absolute inset-0" style={staticStars} />
      <div className="campaign-starfield-twinkle absolute inset-0" style={twinkleStars} />
    </div>
  );
}

// Prerequisite connectors as actual SVG lines — see CampaignGraph.tsx's
// original doc-comment for the full rationale (real lines instead of a
// "Requires: #5 or #8" text label; solid green once cleared, flowing cyan
// for the live frontier, bowed curves for edges spanning >1 column so a
// straight line never happens to pass through an unrelated node).
function JumpLanes({
  layout,
  selectedNodeId,
}: {
  layout: GraphLayout<CampaignGraphCanvasNode>;
  selectedNodeId: number | null;
}) {
  const edges: React.ReactNode[] = [];
  const route = layout.route;
  layout.columns.flat().forEach((node) => {
    const to = layout.positions.get(node.id);
    if (!to) return;
    if (route && !route.visibleIds.has(node.id)) return;
    const isSkipped = !!route?.skippedIds.has(node.id);
    const isSelectedRoute = selectedNodeId != null && node.id === selectedNodeId && !node.completed;
    node.prerequisites.forEach((prereqId) => {
      const prereq = layout.columns.flat().find((n) => n.id === prereqId);
      const from = layout.positions.get(prereqId);
      if (!prereq || !from) return;
      if (route && !route.visibleIds.has(prereqId)) return;

      const isCleared = node.completed;
      const isFrontier = !isCleared && prereq.completed;
      const stroke = isCleared
        ? "var(--color-phosphor-green)"
        : isFrontier
          ? "var(--color-cyan)"
          : "var(--color-text-secondary)";
      const commonProps = {
        stroke,
        strokeWidth: isFrontier || isCleared ? 2 : 1.5,
        strokeDasharray: isCleared ? undefined : isFrontier ? "6 6" : "3 5",
        className: isFrontier && !isSkipped ? "campaign-lane-active" : undefined,
        opacity: isSkipped ? 0.35 : isCleared || isFrontier ? 0.9 : 0.8,
        fill: "none",
      };
      const glowOuterProps = {
        stroke: "var(--color-amber)",
        strokeWidth: 9,
        strokeLinecap: "round" as const,
        opacity: 0.9,
        fill: "none",
        className: "campaign-route-glow",
      };
      const glowCoreProps = {
        stroke: "#fff3d6",
        strokeWidth: 2.5,
        strokeLinecap: "round" as const,
        opacity: 0.95,
        fill: "none",
      };

      const fromY = from.y + CAMPAIGN_NODE_CIRCLE_OFFSET_Y;
      const toY = to.y + CAMPAIGN_NODE_CIRCLE_OFFSET_Y;
      const key = `${prereqId}-${node.id}`;
      const colSpan = Math.abs(to.col - from.col);

      if (route) {
        const d = routeLanePath({ x: from.x, y: fromY }, { x: to.x, y: toY }, route);
        if (isSelectedRoute) {
          edges.push(<path key={`${key}-glow-outer`} d={d} {...glowOuterProps} />);
          edges.push(<path key={`${key}-glow-core`} d={d} {...glowCoreProps} />);
        }
        edges.push(
          <path key={key} d={d} {...commonProps} {...(isSkipped ? { stroke: "var(--color-text-secondary)", strokeDasharray: "3 5" } : {})} />,
        );
      } else if (colSpan > 1) {
        const midX = (from.x + to.x) / 2;
        const midY = (fromY + toY) / 2;
        // Bow across the tiers (sideways when the route runs down).
        const d = layout.vertical
          ? `M ${from.x} ${fromY} Q ${midX + (midX < layout.width / 2 ? 1 : -1) * CAMPAIGN_NODE_WIDTH * 0.8} ${midY} ${to.x} ${toY}`
          : `M ${from.x} ${fromY} Q ${midX} ${midY + (midY < layout.height / 2 ? ROW_HEIGHT * 0.6 : -ROW_HEIGHT * 0.6)} ${to.x} ${toY}`;
        if (isSelectedRoute) {
          edges.push(<path key={`${key}-glow-outer`} d={d} {...glowOuterProps} />);
          edges.push(<path key={`${key}-glow-core`} d={d} {...glowCoreProps} />);
        }
        edges.push(<path key={key} d={d} {...commonProps} />);
      } else {
        if (isSelectedRoute) {
          edges.push(
            <line key={`${key}-glow-outer`} x1={from.x} y1={fromY} x2={to.x} y2={toY} {...glowOuterProps} />,
          );
          edges.push(
            <line key={`${key}-glow-core`} x1={from.x} y1={fromY} x2={to.x} y2={toY} {...glowCoreProps} />,
          );
        }
        edges.push(<line key={key} x1={from.x} y1={fromY} x2={to.x} y2={toY} {...commonProps} />);
      }
    });
  });

  // The way on from what's visible: a short trail toward each hidden
  // mission that fades out, so the route reads as going somewhere unseen.
  const trails: React.ReactNode[] = [];
  if (route) {
    layout.columns.flat().forEach((node) => {
      const to = layout.positions.get(node.id);
      if (!to || route.visibleIds.has(node.id)) return;
      node.prerequisites.forEach((prereqId) => {
        const from = layout.positions.get(prereqId);
        if (!from || !route.visibleIds.has(prereqId) || route.skippedIds.has(prereqId)) return;
        const fromY = from.y + CAMPAIGN_NODE_CIRCLE_OFFSET_Y;
        const toY = to.y + CAMPAIGN_NODE_CIRCLE_OFFSET_Y;
        const endX = from.x + (to.x - from.x) * TRAIL_REACH;
        const endY = fromY + (toY - fromY) * TRAIL_REACH;
        const id = `trail-${prereqId}-${node.id}`;
        trails.push(
          <linearGradient key={`${id}-g`} id={id} gradientUnits="userSpaceOnUse" x1={from.x} y1={fromY} x2={endX} y2={endY}>
            <stop offset="0" stopColor="var(--color-text-secondary)" stopOpacity={0.8} />
            <stop offset="1" stopColor="var(--color-text-secondary)" stopOpacity={0} />
          </linearGradient>,
          <line
            key={id}
            x1={from.x}
            y1={fromY}
            x2={endX}
            y2={endY}
            stroke={`url(#${id})`}
            strokeWidth={1.5}
            strokeDasharray="3 5"
          />,
        );
      });
    });
  }

  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" width={layout.width} height={layout.height}>
      {trails}
      {edges}
    </svg>
  );
}

/** How far a trail toward a hidden mission reaches before it has faded out. */
const TRAIL_REACH = 0.55;

/**
 * The charted route's unexplored space: everything beyond what the run has
 * reached is dimmed, as if out of sensor range.
 */
function ExploredGlow({ layout, padding }: { layout: GraphLayout<CampaignGraphCanvasNode>; padding: number }) {
  const route = layout.route;
  if (!route) return null;
  const seen = [...route.visibleIds].map((id) => layout.positions.get(id)).filter((p) => p != null);
  if (seen.length === 0) return null;
  const minX = Math.min(...seen.map((p) => p.x));
  const maxX = Math.max(...seen.map((p) => p.x));
  const minY = Math.min(...seen.map((p) => p.y));
  const maxY = Math.max(...seen.map((p) => p.y));
  const cx = (minX + maxX) / 2 + padding;
  const cy = (minY + maxY) / 2 + padding;
  const rx = (maxX - minX) / 2 + 220;
  const ry = (maxY - minY) / 2 + 180;
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, rgba(12,17,23,0) 0%, rgba(12,17,23,0) 60%, rgba(8,11,15,0.85) 100%)`,
      }}
    />
  );
}

export interface CampaignGraphCanvasProps<TNode extends CampaignGraphCanvasNode> {
  nodes: TNode[];
  selectedNodeId: number | null;
  onSelectNode: (id: number) => void;
  renderNode: (node: TNode, isSelected: boolean, onSelect: () => void) => React.ReactNode;
  manualColumnOverrides?: Record<number, number>;
  headerExtra?: React.ReactNode;
  /** Rendered below the graph canvas — the node detail/preview panel. */
  children?: React.ReactNode;
  /** No border of its own, for a canvas framed by its container (the run map). */
  bare?: boolean;
  /** Image drawn under the starfield (app/config/art.ts). */
  backdropSrc?: string | null;
  /**
   * Draw the charted route (app/utils/routeChart.ts): a winding layout that
   * shows only these missions. Omitted: the depth-column chart of every node.
   */
  route?: RouteVisibility | null;
}

// Shared campaign-graph canvas (depth-tiered columns, SVG prerequisite
// lanes, starfield backdrop, ResizeObserver-driven responsive column
// width) — used identically by CampaignGraph.tsx (web3) and
// CampaignGraphWeb2.tsx (web2). Number-native: callers adapt their own
// bigint/number node ids down to plain numbers before passing in (the
// only bigint↔number conversion point, per feedback_number_native_shared_
// components memory), and render their own CampaignNodeCard-based node via
// the renderNode prop so each caller's onSelect wiring can stay in its own
// id type.
export function CampaignGraphCanvas<TNode extends CampaignGraphCanvasNode>({
  nodes,
  selectedNodeId,
  onSelectNode,
  renderNode,
  manualColumnOverrides = {},
  headerExtra,
  children,
  bare = false,
  backdropSrc,
  route = null,
}: CampaignGraphCanvasProps<TNode>) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState<number | null>(null);
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = React.useMemo(
    () => groupNodesByDepth(nodes, manualColumnOverrides),
    [nodes, manualColumnOverrides],
  );
  const isNarrow = containerWidth != null && containerWidth < NARROW_WIDTH;
  const padding = isNarrow ? VERTICAL_PADDING : CANVAS_PADDING;
  const colWidth = containerWidth
    ? Math.max(MIN_COL_WIDTH, (containerWidth - CANVAS_PADDING * 2 - 1) / Math.max(columns.length, 1))
    : MIN_COL_WIDTH;
  const layout = React.useMemo(
    () =>
      route
        ? layoutGraphRoute(columns, Math.max(0, (containerWidth ?? MIN_COL_WIDTH * 3) - padding * 2 - 1), padding, isNarrow, route)
        : isNarrow
          ? layoutGraphVertical(columns, containerWidth - VERTICAL_PADDING * 2)
          : layoutGraph(columns, colWidth),
    [columns, colWidth, isNarrow, containerWidth, route, padding],
  );
  const canvasHeight = isNarrow
    ? layout.height + padding * 2
    : Math.max(layout.height + padding * 2, CANVAS_MIN_HEIGHT);

  // Keep the selected node (the current mission when a run opens) in view:
  // a long chart is wider (or, on phones, taller) than the box, and the
  // current node was often out of view with nothing pointing at it.
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const selectedPos = selectedNodeId != null ? layout.positions.get(selectedNodeId) : undefined;
  const selectedX = selectedPos?.x;
  const selectedY = selectedPos?.y;
  const isVertical = layout.vertical;
  React.useEffect(() => {
    const box = scrollRef.current;
    if (!box || selectedX == null || selectedY == null) return;
    const margin = CAMPAIGN_NODE_WIDTH;
    if (isVertical) {
      if (box.scrollHeight <= box.clientHeight) return;
      const y = selectedY + padding;
      if (y - margin >= box.scrollTop && y + margin <= box.scrollTop + box.clientHeight) return;
      box.scrollTo({ top: Math.max(0, y - box.clientHeight / 2), behavior: "smooth" });
      return;
    }
    if (box.scrollWidth <= box.clientWidth) return;
    const x = selectedX + padding;
    if (x - margin >= box.scrollLeft && x + margin <= box.scrollLeft + box.clientWidth) return;
    box.scrollTo({ left: Math.max(0, x - box.clientWidth / 2), behavior: "smooth" });
  }, [selectedX, selectedY, isVertical, padding]);
  const contentTop = (canvasHeight - layout.height) / 2;

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        {headerExtra}
        <div className="text-center font-mono text-sm text-text-muted">
          No campaign nodes configured yet.
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${bare ? "" : "gap-6"}`}>
      {headerExtra}
      {/* containerRef sits on this plain, non-scrolling wrapper (not the
          overflow-x-auto box below) so its measured width can never be
          affected by a scrollbar appearing/disappearing inside it. */}
      <div ref={containerRef} className="relative w-full">
        <div
          ref={scrollRef}
          className={`relative w-full ${
            // Vertical: sideways scrolling only for a tier wider than the box
            // (the vertical scrollbar's width alone shouldn't cause it).
            isNarrow
              ? `overflow-y-auto overscroll-contain ${layout.width > containerWidth - VERTICAL_PADDING * 2 ? "overflow-x-auto" : "overflow-x-hidden"}`
              : "overflow-x-auto"
          } ${bare ? "" : "border-2"}`}
          style={{
            borderColor: "var(--color-steel)",
            borderRadius: 0,
            minHeight: isNarrow ? undefined : CANVAS_MIN_HEIGHT,
            maxHeight: isNarrow ? VERTICAL_MAX_HEIGHT : undefined,
          }}
        >
          <div className="relative" style={{ width: layout.width + padding * 2, height: canvasHeight }}>
            <Starfield backdropSrc={backdropSrc} />
            <ExploredGlow layout={layout} padding={padding} />
            <div
              className="absolute"
              style={{ left: padding, top: contentTop, width: layout.width, height: layout.height }}
            >
              <JumpLanes layout={layout} selectedNodeId={selectedNodeId} />
              {layout.columns.flat().map((node) => {
                const pos = layout.positions.get(node.id);
                if (!pos) return null;
                if (layout.route && !layout.route.visibleIds.has(node.id)) return null;
                return (
                  <div
                    key={node.id}
                    style={{
                      position: "absolute",
                      left: pos.x - CAMPAIGN_NODE_WIDTH / 2,
                      top: pos.y - CAMPAIGN_NODE_HEIGHT / 2,
                    }}
                  >
                    {renderNode(node, selectedNodeId === node.id, () => onSelectNode(node.id))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
