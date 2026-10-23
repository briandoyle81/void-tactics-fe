"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GridShip } from "../../types/gridDisplay";
import { GridShipImage } from "../GridShipImage";
import { cellCenterOnGrid, gridLayoutSize } from "./gridLayout";
import { startCancelledRaf } from "./overlayPaint";
import type { PathTile } from "../../utils/movePath";

// A ship sliding from its old tile to its new one along its route
// (findMovePath: around asteroids and enemy ships), as a move plays back
// (MovePlaybackLayer). The ship's own cells hide it meanwhile (GameGrid's
// hiddenShipIds). Calls onComplete once when it arrives.

/** Per tile of the route; the whole slide eases in and out. */
export const SHIP_MOVE_MS_PER_TILE = 170;
const MIN_MOVE_MS = 350;

export function shipMoveDurationMs(path: PathTile[]): number {
  return Math.max(MIN_MOVE_MS, (path.length - 1) * SHIP_MOVE_MS_PER_TILE);
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

interface ShipMoveAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  ship: GridShip;
  /** Creator ships face right (their art is mirrored, as in GameGridCell). */
  isCreator: boolean;
  path: PathTile[];
  onComplete: () => void;
}

export const ShipMoveAnimation = React.memo(function ShipMoveAnimation({
  gridContainerRef,
  ship,
  isCreator,
  path,
  onComplete,
}: ShipMoveAnimationProps) {
  const shipRef = useRef<HTMLDivElement | null>(null);
  const [cell, setCell] = useState<{ width: number; height: number } | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useLayoutEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const { cellWidth, cellHeight } = gridLayoutSize(el);
    setCell({ width: cellWidth, height: cellHeight });
  }, [gridContainerRef]);

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el || path.length === 0) return;
    const points = path.map((t) => cellCenterOnGrid(el, t.row, t.col));
    const lengths = points.map((p, i) => (i === 0 ? 0 : Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y)));
    const total = lengths.reduce((a, b) => a + b, 0);
    const duration = shipMoveDurationMs(path);
    const startedAt = performance.now();
    let done = false;

    const place = (u: number) => {
      const node = shipRef.current;
      if (!node) return;
      let along = easeInOut(u) * total;
      let x = points[0].x;
      let y = points[0].y;
      for (let i = 1; i < points.length; i++) {
        if (along <= lengths[i] || i === points.length - 1) {
          const f = lengths[i] > 0 ? Math.min(1, along / lengths[i]) : 1;
          x = points[i - 1].x + (points[i].x - points[i - 1].x) * f;
          y = points[i - 1].y + (points[i].y - points[i - 1].y) * f;
          break;
        }
        along -= lengths[i];
      }
      node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    };

    place(0);
    const stop = startCancelledRaf((now) => {
      if (done) return;
      const u = Math.min(1, (now - startedAt) / duration);
      place(u);
      if (u >= 1) {
        done = true;
        onCompleteRef.current();
      }
    });
    return stop;
  }, [gridContainerRef, path]);

  if (!cell) return null;
  return (
    <div className="absolute left-0 top-0 pointer-events-none z-30" aria-hidden>
      <div
        ref={shipRef}
        className="absolute left-0 top-0"
        style={{ width: cell.width, height: cell.height, willChange: "transform" }}
      >
        <GridShipImage
          ship={ship}
          className={`w-full h-full ${isCreator ? "[&_img]:scale-x-[-1]" : ""}`}
          showLoadingState={false}
          hideRankStars
        />
      </div>
    </div>
  );
});
