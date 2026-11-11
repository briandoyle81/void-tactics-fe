import React from "react";

/**
 * Threat (a ship's cost and overall strength) as a crosshair, used in place
 * of the word on the ship cards. `title` shows "Threat" on hover.
 */
export function ThreatIcon({ size = 20, color = "var(--color-amber)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" role="img" aria-label="Threat" className="shrink-0">
      <title>Threat</title>
      <circle cx="11" cy="11" r="7.5" fill="none" stroke={color} strokeWidth="1.8" />
      <circle cx="11" cy="11" r="2.2" fill={color} />
      <path d="M11 1 V5 M11 17 V21 M1 11 H5 M17 11 H21" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

/** The crosshair and the Threat number side by side. */
export function ThreatValue({
  value,
  iconSize = 20,
  className = "",
}: {
  value: number;
  iconSize?: number;
  /** Sets the number's size (e.g. text-3xl). */
  className?: string;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 leading-none" title="Threat">
      <ThreatIcon size={iconSize} />
      <span className={`font-bold text-amber ${className}`}>{value}</span>
    </span>
  );
}

/** Hull bar color by health: green above half, amber above a quarter, red below. */
export function hullBarColor(hull: number, maxHull: number): string {
  const pct = maxHull > 0 ? hull / maxHull : 0;
  if (pct > 0.5) return "var(--color-phosphor-green)";
  if (pct > 0.25) return "var(--color-amber)";
  return "var(--color-warning-red)";
}
