"use client";

import React from "react";
import { pathCorners, type PathTile } from "../utils/movePath";

// The move arrow, drawn along a move's route (findMovePath in
// app/utils/movePath.ts): from just outside the From tile, through the
// centre of each tile where the route turns, to the edge of the To tile with
// an arrowhead. A one-tile move is a lone arrowhead on the shared edge. Drawn
// in grid units (17x11) so it scales with the board. Used for a staged or
// hovered move and while a move plays back (MovePlaybackLayer).

const GRID_COLS = 17;
const GRID_ROWS = 11;
const HEAD = 0.361;
const STROKE = 0.12;
const START_OUTSIDE = STROKE / 2 + 0.02;

export const MOVE_ARROW_YELLOW = "#facc15";
export const MOVE_ARROW_GREY = "#6b7280";

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="absolute left-0 top-0 z-50 w-full h-full overflow-visible pointer-events-none"
      viewBox={`0 0 ${GRID_COLS} ${GRID_ROWS}`}
      preserveAspectRatio="none"
    >
      {children}
    </svg>
  );
}

export const MovePathArrow = React.memo(function MovePathArrow({
  path,
  color = MOVE_ARROW_YELLOW,
}: {
  path: PathTile[];
  color?: string;
}) {
  if (path.length < 2) return null;
  const from = path[0];
  const to = path[path.length - 1];

  if (path.length === 2) {
    const dRow = to.row - from.row;
    const dCol = to.col - from.col;
    const edge =
      dCol !== 0
        ? { x: Math.min(from.col, to.col) + 1, y: from.row + 0.5 }
        : { x: from.col + 0.5, y: Math.min(from.row, to.row) + 1 };
    const hs = HEAD / 2;
    const cx = HEAD / 3;
    const local = [
      { x: -cx, y: -hs },
      { x: -cx, y: hs },
      { x: HEAD - cx, y: 0 },
    ];
    const world = local.map(({ x, y }) =>
      dCol === 1
        ? { x: edge.x + x, y: edge.y + y }
        : dCol === -1
          ? { x: edge.x - x, y: edge.y - y }
          : dRow === 1
            ? { x: edge.x + y, y: edge.y + x }
            : { x: edge.x - y, y: edge.y - x },
    );
    return (
      <Svg>
        <path
          d={`M ${world[0].x} ${world[0].y} L ${world[1].x} ${world[1].y} L ${world[2].x} ${world[2].y} Z`}
          fill={color}
        />
      </Svg>
    );
  }

  const corners = pathCorners(path);
  const first = corners[1];
  const startDir = { row: Math.sign(first.row - from.row), col: Math.sign(first.col - from.col) };
  const last = corners[corners.length - 2];
  const endDir = { row: Math.sign(to.row - last.row), col: Math.sign(to.col - last.col) };

  const start = {
    x: from.col + 0.5 + startDir.col * (0.5 + START_OUTSIDE),
    y: from.row + 0.5 + startDir.row * (0.5 + START_OUTSIDE),
  };
  const tip = { x: to.col + 0.5 - endDir.col * 0.5, y: to.row + 0.5 - endDir.row * 0.5 };
  // Leave room for the head on the last leg (short legs get a shorter one).
  const lastLeg = Math.abs(tip.x - (last.col + 0.5)) + Math.abs(tip.y - (last.row + 0.5));
  const head = Math.max(0.05, Math.min(HEAD, lastLeg - 0.05));
  const lineEnd = { x: tip.x - endDir.col * head, y: tip.y - endDir.row * head };

  const points = [start, ...corners.slice(1, -1).map((t) => ({ x: t.col + 0.5, y: t.row + 0.5 })), lineEnd];
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const markerId = `wf-move-arrow-head-${color.replace("#", "")}`;

  return (
    <Svg>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="0"
          refY="5"
          markerWidth={head}
          markerHeight={head}
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M 0 0 L 0 10 L 10 5 z" fill={color} />
        </marker>
      </defs>
      <path
        d={d}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        markerEnd={`url(#${markerId})`}
      />
    </Svg>
  );
});
