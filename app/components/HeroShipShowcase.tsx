"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { renderShip } from "../utils/shipRenderer";
import { Ship, Attributes } from "../types/types";
import { calculateShipRank } from "../utils/shipLevel";
import { toShipVisual } from "../utils/toShipVisual";
import { generateRandomShip } from "../utils/generateRandomShip";
import { calculateAttributesFromContracts } from "../utils/shipAttributesCalculator";
import { SHIP_IMAGE_RANK_STAR_BOX } from "./ShipImage";
import { useInView } from "../hooks/useInView";
import { usePageVisible } from "../hooks/usePageVisible";
import {
  getMainWeaponName,
  getArmorName,
  getShieldName,
  getSpecialName,
} from "../types/types";

export const HeroShipShowcase: React.FC<{
  seedOffset?: number;
  intervalMs?: number;
  side?: "allied" | "enemy";
  /** Mirror the layout: art on the left, stats on the right (the enemy). */
  flipLayout?: boolean;
  /** Pin the mock ship to a specific variant (1 or 2) instead of picking one
   * at random — e.g. the Info page's Intel section always shows variant 1
   * on the left and variant 2 on the right. */
  forcedVariant?: number;
}> = ({
  seedOffset = 0,
  intervalMs = 10000,
  side = "allied",
  flipLayout = false,
  forcedVariant,
}) => {
  // Rotate ships every N milliseconds
  const [shipIndex, setShipIndex] = useState(seedOffset);

  const advanceShip = React.useCallback(() => {
    setShipIndex((prev) => prev + 1);
  }, []);

  // Depending on shipIndex (not just intervalMs) restarts the countdown
  // from zero whenever the ship changes for any reason — including a
  // manual click via advanceShip below — so clicking to switch ships also
  // resets the auto-rotation timer instead of leaving the old countdown
  // running and immediately re-advancing a moment later.
  // Rotation pauses while the showcase is off screen or the tab is hidden.
  const rootRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(rootRef);
  const isPageVisible = usePageVisible();
  const isRotating = isInView && isPageVisible;
  useEffect(() => {
    if (!isRotating) return;
    const interval = setInterval(advanceShip, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs, shipIndex, advanceShip, isRotating]);

  // Generate current hero ship client-side only, after mount. `generateRandomShip`
  // uses Math.random(), so computing it during render (e.g. via useMemo) would give
  // the server and the client's initial hydration pass different values — a
  // hydration mismatch. Server and first client render both show the loading
  // placeholder below; the real ship appears once this effect runs.
  const [heroShip, setHeroShip] = useState<Ship | null>(null);

  useEffect(() => {
    const variant = forcedVariant ?? Math.floor(Math.random() * 10);
    const ship = generateRandomShip(shipIndex, variant);
    setHeroShip(ship);
  }, [shipIndex, forcedVariant]);

  // Calculate attributes for the ship
  const shipAttributes = useMemo<Attributes | null>(
    () => (heroShip ? calculateAttributesFromContracts(heroShip) : null),
    [heroShip],
  );

  // Calculate ship rank
  const shipRank = useMemo(
    () => (heroShip ? calculateShipRank(toShipVisual(heroShip)) : null),
    [heroShip],
  );

  // Render the hero ship
  const heroShipImage = useMemo(() => {
    if (!heroShip) return null;
    try {
      return renderShip(toShipVisual(heroShip));
    } catch (error) {
      console.error("Error rendering hero ship:", error);
      return null;
    }
  }, [heroShip]);

  const accent = side === "enemy" ? "var(--color-warning-red)" : "var(--color-cyan)";
  const accentGlow = side === "enemy" ? "rgba(255, 77, 77, 0.4)" : "rgba(86, 214, 255, 0.4)";
  const flipSprite = side === "allied";
  // The enemy side mirrors the layout: text and stats line up on the right.
  const alignEnd = flipLayout;

  const gear = heroShip
    ? [
        getMainWeaponName(heroShip.equipment.mainWeapon, heroShip.traits.variant),
        heroShip.equipment.armor > 0
          ? getArmorName(heroShip.equipment.armor)
          : heroShip.equipment.shields > 0
            ? getShieldName(heroShip.equipment.shields)
            : null,
        heroShip.equipment.special > 0
          ? getSpecialName(heroShip.equipment.special, heroShip.traits.variant)
          : null,
      ].filter(Boolean)
    : [];

  // A non-breaking space keeps an empty line its height while a ship loads.
  const EMPTY = "\u00a0";
  const stats: { label: string; value: string }[] = [
    { label: "Range", value: shipAttributes ? String(shipAttributes.range) : EMPTY },
    { label: "Damage", value: shipAttributes ? String(shipAttributes.gunDamage) : EMPTY },
    {
      label: "Hull",
      value: shipAttributes ? `${shipAttributes.hullPoints}/${shipAttributes.maxHullPoints}` : EMPTY,
    },
    { label: "Move", value: shipAttributes ? String(shipAttributes.movement) : EMPTY },
    { label: "Defense", value: shipAttributes ? `${shipAttributes.damageReduction}%` : EMPTY },
  ];

  // Open, frameless presentation (the website's Intel section): the stats
  // column on the outer side, the ship art beside it, facing the middle.
  // Click to cycle. Every line has a fixed height (two-line name, three
  // gear lines), so nothing moves as the ships rotate.
  const statsColumn = (
    <div className={`flex min-w-0 flex-col gap-4 ${alignEnd ? "items-end text-right" : "items-start text-left"}`}>
      <h3
        className="line-clamp-2 min-h-[2lh] w-full text-2xl font-bold leading-tight md:text-3xl"
        style={{ fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif", color: accent }}
      >
        {heroShip?.name ?? EMPTY}
      </h3>
      <ul
        className="min-h-[3lh] w-full text-sm leading-snug text-text-secondary"
        style={{ fontFamily: "var(--font-mono), monospace" }}
      >
        {gear.length > 0
          ? gear.map((item) => (
              <li key={item} className="truncate">
                {item}
              </li>
            ))
          : <li>{EMPTY}</li>}
      </ul>
      <dl className="w-full" style={{ fontFamily: "var(--font-mono), monospace" }}>
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 border-t border-white/10 py-1.5"
          >
            <dt className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{label}</dt>
            <dd className="truncate text-base font-bold text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    // A click anywhere on the card cycles; the art is the real button
    // (keyboard and screen readers), its click bubbling up to this handler.
    // The name and stats stay plain text, so they're read out.
    <div
      ref={rootRef}
      onClick={advanceShip}
      className={`grid w-full min-w-0 cursor-pointer items-center gap-4 md:gap-6 ${alignEnd ? "grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"}`}
    >
      {!alignEnd && statsColumn}
      <button
        type="button"
        aria-label="Show next ship"
        className="relative block aspect-square w-full cursor-pointer"
      >
        {heroShipImage && heroShip && shipRank ? (
          // Same art structure as the old framed card: a size container
          // (which the rank star's cqmin size resolves against, and which
          // keeps the image swap's repaint inside this box), the flip as a
          // transform on the art only, and the star as a sibling outside it.
          <span className="relative block h-full w-full [container-type:size]">
            <span
              className="relative block h-full w-full"
              style={flipSprite ? { transform: "scaleX(-1)" } : undefined}
            >
              {/* A generated data: URL, which next/image can't optimize. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroShipImage}
                alt={heroShip.name}
                className="h-full w-full object-contain"
                style={{
                  imageRendering: "pixelated",
                  filter: `drop-shadow(0 0 20px ${accentGlow})`,
                }}
              />
            </span>
            {heroShip.shipData.constructed && (
              <span
                className="pointer-events-none absolute right-[2.5%] top-[5%] z-10 leading-none text-amber"
                style={{ fontSize: SHIP_IMAGE_RANK_STAR_BOX }}
                role="img"
                aria-label={`Combat rank ${shipRank.rank} of 6`}
              >
                {Array.from({ length: shipRank.rank }, (_, i) => (
                  <span key={i} aria-hidden>
                    ⭐
                  </span>
                ))}
              </span>
            )}
          </span>
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-sm opacity-50"
            style={{ fontFamily: "var(--font-mono), monospace", color: "var(--color-text-muted)" }}
          >
            Loading ship...
          </span>
        )}
      </button>

      {alignEnd && statsColumn}
    </div>
  );
};
