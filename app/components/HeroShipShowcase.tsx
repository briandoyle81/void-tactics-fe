"use client";

import React, { useEffect, useMemo, useState } from "react";
import { renderShip } from "../utils/shipRenderer";
import { Ship, Attributes } from "../types/types";
import { calculateShipRank } from "../utils/shipLevel";
import { toShipVisual } from "../utils/toShipVisual";
import { generateRandomShip } from "../utils/generateRandomShip";
import { calculateAttributesFromContracts } from "../utils/shipAttributesCalculator";
import { SHIP_IMAGE_RANK_STAR_BOX } from "./ShipImage";
import { WeaponIcon, DefenseIcon, SpecialIcon } from "./EquipmentTypeIcons";
import {
  getMainWeaponName,
  getArmorName,
  getShieldName,
  getSpecialName,
} from "../types/types";

// Equipment row labels are icon-only (category glyph + title tooltip)
// instead of "Weapon:"/"Armor:"/"Shields:"/"Special:" text — the value
// itself (e.g. "Plasma Cannon") stays full text.

type HeroShipShowcaseAlign = "start" | "center" | "end";

export const HeroShipShowcase: React.FC<{
  seedOffset?: number;
  intervalMs?: number;
  align?: HeroShipShowcaseAlign;
  side?: "allied" | "enemy";
  flipLayout?: boolean;
  /** Pin the mock ship to a specific variant (1 or 2) instead of picking one
   * at random — e.g. the Info page's Intel section always shows variant 1
   * on the left and variant 2 on the right. */
  forcedVariant?: number;
}> = ({
  seedOffset = 0,
  intervalMs = 10000,
  align = "end",
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
  useEffect(() => {
    const interval = setInterval(advanceShip, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs, shipIndex, advanceShip]);

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

  const gridPlacementClass =
    align === "center"
      ? "mx-auto max-w-3xl"
      : align === "end"
        ? "ml-auto max-w-3xl"
        : "";

  const accent = side === "enemy" ? "var(--color-warning-red)" : "var(--color-cyan)";
  const accentBorderClass = side === "enemy" ? "border-warning-red" : "border-cyan";
  const accentTextClass = side === "enemy" ? "text-warning-red" : "text-cyan";
  const accentSoftBorderClass =
    side === "enemy" ? "border-warning-red/30" : "border-cyan/30";
  const accentDividerClass =
    side === "enemy" ? "border-warning-red/20" : "border-cyan/20";
  const accentGlow = side === "enemy" ? "rgba(255, 77, 77, 0.4)" : "rgba(86, 214, 255, 0.4)";
  const accentInset = side === "enemy" ? "rgba(255, 77, 77, 0.1)" : "rgba(86, 214, 255, 0.1)";
  const flipSprite = side === "allied";

  /** Narrow stats column, wider art (~36% / ~64%). Flip column fr order when art is on the left. */
  const intelGridCols = flipLayout
    ? "grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)]"
    : "grid-cols-[minmax(0,2fr)_minmax(0,3.5fr)]";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={advanceShip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          advanceShip();
        }
      }}
      aria-label="Switch to next ship"
      className={`grid w-full min-w-0 cursor-pointer items-stretch gap-2 sm:gap-3 ${intelGridCols} ${gridPlacementClass}`}
    >
      {/* Stats panel (left when not flipLayout; right when enemy flipLayout) */}
      <div
        className={`flex min-w-0 max-w-full flex-col ${flipLayout ? "order-2" : "order-1"}`}
      >
        <div
          className={`corner-bracket flex h-full min-w-0 flex-col gap-2 border-2 ${accentBorderClass} bg-black/60 p-2 sm:gap-3 sm:p-3 md:p-4`}
          style={{
            borderRadius: 0,
            "--bracket-color": accent,
          } as React.CSSProperties}
        >
          {/* Ship name — wraps to two lines instead of truncating; minHeight
              reserves that two-line slot unconditionally (in em, so it
              tracks the responsive text-size classes below) so a short
              one-line name on one side of the Intel showcase doesn't leave
              this card shorter than a sibling whose name wrapped. */}
          <div className="mb-1.5 md:mb-2">
            <h3
              className="break-words text-lg font-bold sm:text-xl md:text-2xl lg:text-3xl"
              style={{
                fontFamily:
                  "var(--font-rajdhani), 'Arial Black', sans-serif",
                color: accent,
                lineHeight: 1.2,
                minHeight: "2.4em",
              }}
            >
              {heroShip?.name ?? " "}
            </h3>
          </div>

          {/* Equipment — icon labels (Weapon/Armor-Shields/Special), full
              text values. */}
          <div
            className={`mb-1.5 border-b pb-1.5 md:mb-2 md:pb-2 ${accentDividerClass}`}
            style={{
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            <div className="space-y-0.5 text-xs leading-tight sm:text-sm md:text-base">
              {/* Row labels are icon-only (title tooltip carries the word);
                  values stay full text and wrap to a second line instead of
                  truncating. */}
              <div className="flex min-w-0 items-start justify-between gap-2">
                <span className="shrink-0 opacity-60" title="Weapon" aria-label="Weapon">
                  <WeaponIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                <span className={`min-w-0 text-right ${accentTextClass}`}>
                  {heroShip ? getMainWeaponName(heroShip.equipment.mainWeapon, heroShip.traits.variant) : " "}
                </span>
              </div>
              <div className="flex min-w-0 items-start justify-between gap-2">
                <span
                  className="shrink-0 opacity-60"
                  title={heroShip && heroShip.equipment.shields > 0 ? "Shields" : "Armor"}
                  aria-label={heroShip && heroShip.equipment.shields > 0 ? "Shields" : "Armor"}
                >
                  <DefenseIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                <span className={`min-w-0 text-right ${accentTextClass}`}>
                  {!heroShip
                    ? " "
                    : heroShip.equipment.armor > 0
                      ? getArmorName(heroShip.equipment.armor)
                      : heroShip.equipment.shields > 0
                        ? getShieldName(heroShip.equipment.shields)
                        : "None"}
                </span>
              </div>
              <div className="flex min-w-0 items-start justify-between gap-2">
                <span className="shrink-0 opacity-60" title="Special" aria-label="Special">
                  <SpecialIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                <span className={`min-w-0 text-right ${accentTextClass}`}>
                  {!heroShip
                    ? " "
                    : heroShip.equipment.special > 0
                      ? getSpecialName(heroShip.equipment.special, heroShip.traits.variant)
                      : "None"}
                </span>
              </div>
            </div>
          </div>

          {/* Combat stats */}
          <div className="space-y-0">
            <div className="data-readout">
              <span className="data-readout-label">Range</span>
              <span className="font-bold text-phosphor-green font-mono text-xs">
                {shipAttributes?.range ?? " "}
              </span>
            </div>
            <div className="data-readout">
              <span className="data-readout-label">Damage</span>
              <span className="font-bold text-warning-red font-mono text-xs">
                {shipAttributes?.gunDamage ?? " "}
              </span>
            </div>
            <div className="data-readout">
              <span className="data-readout-label">Hull</span>
              <span className="font-bold text-amber font-mono text-xs">
                {shipAttributes
                  ? `${shipAttributes.hullPoints}/${shipAttributes.maxHullPoints}`
                  : " "}
              </span>
            </div>
            <div className="data-readout">
              <span className="data-readout-label">Move</span>
              <span className={`font-bold font-mono text-xs ${side === "enemy" ? "text-warning-red" : "text-cyan"}`}>
                {shipAttributes?.movement ?? " "}
              </span>
            </div>
            <div className="data-readout">
              <span className="data-readout-label">Defense</span>
              <span className="font-bold text-amber font-mono text-xs">
                {shipAttributes ? `${shipAttributes.damageReduction}%` : " "}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ship art: wider column; square uses full column width (taller than stats when art is large) */}
      <div
        className={`flex min-h-0 min-w-0 flex-col items-start justify-center ${flipLayout ? "order-1" : "order-2"}`}
      >
        {heroShipImage && heroShip && shipRank ? (
          <div
            className={`corner-bracket relative flex aspect-square w-full max-w-full items-center justify-center border-2 bg-black/40 p-1.5 sm:p-2 md:p-4 ${accentSoftBorderClass}`}
            style={{
              borderRadius: 0,
              "--bracket-color": accent,
            } as React.CSSProperties}
          >
            {/* Only the art + glow overlay flip (scaleX(-1)) — the rank
                star lives as a sibling outside that transform, matching
                ShipImageView.tsx's own star-is-a-sibling-of-<img> pattern.
                Nesting the star INSIDE the flipped wrapper made its
                cqmin-based SHIP_IMAGE_RANK_STAR_BOX size compute near-zero
                on flipped (allied-side) ships, even though container-type:size
                lived on this outer, untransformed div — an intervening
                transformed ancestor still threw off cqmin resolution. */}
            <div className="relative h-full w-full min-h-0 flex-1 [container-type:size]">
              <div
                className="relative h-full w-full"
                style={flipSprite ? { transform: "scaleX(-1)" } : undefined}
              >
                <img
                  src={heroShipImage}
                  alt={heroShip.name}
                  className="h-full w-full object-contain"
                  style={{
                    imageRendering: "pixelated",
                    filter: `drop-shadow(0 0 20px ${accentGlow})`,
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0 z-[1]"
                  style={{
                    boxShadow: `inset 0 0 60px ${accentInset}`,
                  }}
                />
              </div>
              {heroShip.shipData.constructed && (
                <div
                  className="pointer-events-none absolute right-[2.5%] top-[5%] z-10 leading-none text-amber"
                  style={{
                    fontSize: SHIP_IMAGE_RANK_STAR_BOX,
                  }}
                  role="img"
                  aria-label={`Combat rank ${shipRank.rank} of 6`}
                >
                  {Array.from({ length: shipRank.rank }, (_, i) => (
                    <span key={i} aria-hidden>
                      ⭐
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className={`corner-bracket flex aspect-square w-full max-w-full items-center justify-center border-2 bg-black/40 ${accentSoftBorderClass}`}
            style={{
              borderRadius: 0,
              "--bracket-color": accent,
            } as React.CSSProperties}
          >
            <p
              className="text-sm opacity-50 sm:text-base md:text-lg"
              style={{
                fontFamily: "var(--font-mono), monospace",
                color: "var(--color-text-muted)",
              }}
            >
              Loading ship...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

