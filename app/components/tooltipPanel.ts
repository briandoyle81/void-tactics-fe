import type { CSSProperties } from "react";

// The in-game tooltip frame shared by the board's tooltips (tiles:
// GameGridTileTooltip, ships: ShipCard in tooltip mode): a dark panel, a thin
// gunmetal edge, and a 3px left edge in the accent color.
// Longhand properties only (no `borderLeft` shorthand), matching ShipCard's
// own border styles so React never sees a shorthand/longhand mix.
export function tooltipPanelStyle(accent: string) {
  return {
    borderColor: "var(--color-gunmetal)",
    borderTopColor: "var(--color-gunmetal)",
    borderLeftColor: accent,
    borderLeftWidth: "3px",
    backgroundColor: "rgba(12, 17, 23, 0.95)",
    borderRadius: 0,
    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.55)",
  } satisfies CSSProperties;
}

/** Above every board overlay (tutorial panel, comms, dialogs' backdrops excluded). */
export const TOOLTIP_Z_CLASS = "z-[10001]";
