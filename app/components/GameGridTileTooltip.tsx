"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TileTooltip, TileTooltipTone } from "../utils/tileTooltip";
import { TOOLTIP_Z_CLASS, tooltipPanelStyle } from "./tooltipPanel";
// Same rest-before-showing delay as the ship tooltips.
import { SHIP_TOOLTIP_HOVER_DELAY_MS } from "./HoverShipCardTooltip";

// The board's tile tooltip (deposits, nebulae, hazards, "Move here"), in the
// game's own panel style instead of the browser's native title tooltip.
// One delegated listener on the grid container reads the hovered tile's
// `data-tile-tip` (set by GameGridCell from describeTile), so hovering never
// re-renders the board. Mouse/pen only: touch has no hover. Drawn in a
// portal at the page level (fixed to the viewport) so overlays on the
// board, like the tutorial briefing or the comms panel, can't cover it.

const GAP_PX = 8;
/** Room the panel needs beside a tile before it flips to the other side. */
const PANEL_WIDTH_PX = 240;
const PANEL_HEIGHT_PX = 96;

const TONE_COLOR: Record<TileTooltipTone, string> = {
  gold: "var(--color-amber)",
  crystal: "rgb(45 212 191)",
  hazard: "var(--color-warning-red)",
  nebula: "var(--color-purple)",
  move: "var(--color-phosphor-green)",
  range: "var(--color-amber)",
  target: "var(--color-warning-red)",
};

interface Shown {
  tip: TileTooltip;
  left?: number;
  right?: number;
  top: number;
}

export function GameGridTileTooltip({
  gridContainerRef,
  disabled,
}: {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Hidden while true (tooltips off, a ship being dragged). */
  disabled: boolean;
}) {
  const [shown, setShown] = useState<Shown | null>(null);
  const hoveredRef = useRef<Element | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    if (disabled) setShown(null);
  }, [disabled]);

  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      hoveredRef.current = null;
      setShown(null);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      // The board cell under the pointer itself, not an ancestor of the
      // event target: overlays (move arrows, range art) belong to other
      // cells and would point at the wrong tile.
      const cellUnder = document
        .elementsFromPoint(event.clientX, event.clientY)
        .find((el) => el.hasAttribute("data-grid-row") && container.contains(el));
      const tile = cellUnder?.hasAttribute("data-tile-tip") ? cellUnder : null;
      if (tile === hoveredRef.current) return;
      clear();
      if (!tile || disabledRef.current) return;
      hoveredRef.current = tile;
      timerRef.current = setTimeout(() => {
        if (hoveredRef.current !== tile || disabledRef.current) return;
        let tip: TileTooltip;
        try {
          tip = JSON.parse(tile.getAttribute("data-tile-tip") ?? "") as TileTooltip;
        } catch {
          return;
        }
        const cell = tile.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const top = Math.max(0, Math.min(cell.top, window.innerHeight - PANEL_HEIGHT_PX));
        // Beside the tile, on whichever side has room.
        setShown(
          cell.right + GAP_PX + PANEL_WIDTH_PX <= viewportWidth
            ? { tip, left: cell.right + GAP_PX, top }
            : { tip, right: viewportWidth - cell.left + GAP_PX, top },
        );
      }, SHIP_TOOLTIP_HOVER_DELAY_MS);
    };

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", clear);
    container.addEventListener("pointerdown", clear);
    container.addEventListener("dragstart", clear);
    // Fixed to the viewport, so a zoom or scroll would leave it behind.
    container.addEventListener("wheel", clear, { passive: true });
    window.addEventListener("scroll", clear, true);
    return () => {
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", clear);
      container.removeEventListener("pointerdown", clear);
      container.removeEventListener("dragstart", clear);
      container.removeEventListener("wheel", clear);
      window.removeEventListener("scroll", clear, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gridContainerRef]);

  if (!shown || disabled || typeof document === "undefined") return null;
  const { tip } = shown;
  const color = TONE_COLOR[tip.tone];

  return createPortal(
    <div
      role="tooltip"
      className={`pointer-events-none fixed ${TOOLTIP_Z_CLASS} w-max max-w-[15rem] border border-solid px-3 py-2`}
      style={{ left: shown.left, right: shown.right, top: shown.top, ...tooltipPanelStyle(color) }}
    >
      {tip.action && (
        <div className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-phosphor-green">
          › {tip.action}
        </div>
      )}
      <div
        className="text-sm font-bold uppercase leading-tight tracking-wider"
        style={{ fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif", color }}
      >
        {tip.title}
      </div>
      {tip.details.map((line) => (
        <div key={line} className="mt-0.5 font-mono text-[11px] leading-snug text-text-secondary">
          {line}
        </div>
      ))}
    </div>,
    document.body,
  );
}
