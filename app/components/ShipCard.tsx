"use client";

import { formatGridPosition } from "../utils/gridPosition";
import React from "react";
import { SHIP_IMAGE_RANK_STAR_BOX } from "./ShipImage";
import {
  getMainWeaponName,
  getSpecialName,
  getArmorName,
  getShieldName,
} from "../types/types";
import { getRankColor } from "../utils/shipLevel";
import { formatDestroyedDate } from "../utils/dateUtils";
import { Attributes } from "../types/types";
import type { ShipCardData } from "../types/shipCardData";
import { SosHullFires } from "./SosHullFires";
import { tooltipPanelStyle } from "./tooltipPanel";
import { ThreatValue, hullBarColor } from "./ThreatIcon";

interface ShipCardProps {
  ship: ShipCardData;
  /** Rendered ship art — caller builds `<ShipImage ship={...} .../>` (web3) or `<ShipImageWeb2 ship={...} .../>` (web2). */
  shipImage: React.ReactNode;
  isStarred: boolean;
  onToggleStar: () => void;
  isSelected: boolean;
  onToggleSelection: () => void;
  onRecycleClick: () => void;
  /** Manage Navy: open the customize-ship modal for this card. */
  onCustomizeClick?: () => void;
  showInGameProperties: boolean;
  inGameAttributes?: Attributes;
  attributesLoading?: boolean;
  // Selection mode props
  selectionMode?: boolean;
  hideRecycle?: boolean;
  hideCheckbox?: boolean; // Hide the checkbox for recycling selection
  onCardClick?: () => void;
  canSelect?: boolean; // Whether the ship can be selected in selection mode
  tooltipMode?: boolean; // Use fully opaque backgrounds for tooltip display
  isCurrentPlayerShip?: boolean; // Whether this ship belongs to the current player (for tooltip border color)
  flipShip?: boolean; // Whether to flip the ship image horizontally (for joiner ships in tooltip)
  reactorCriticalStatus?: "none" | "warning" | "critical"; // Reactor critical status for game view borders
  hasMoved?: boolean; // Whether the ship has moved (for game view status display)
  gameViewMode?: boolean; // Explicitly mark this as game view for styling
  /** Manage Navy: ship costsVersion behind global (shown only when not destroyed / not in fleet). */
  costsVersionStale?: boolean;
  /** Manage Navy: calls Ships.syncShipCosts (not setCostOfShip, which is owner/game). */
  costVersionSyncButton?: React.ReactNode;
  /** Manage Navy: enables row sync of name block height via data attributes */
  layoutShipId?: string;
  /** Manage Navy: min height (px) for the star+name row to align cards in a grid row */
  nameBlockMinHeightPx?: number;
  /** Grid hover tooltip: tile row/col under the cursor (ghost / preview / live). */
  tooltipGridPosition?: { row: number; col: number };
  /** Manage Navy: optional fleet composition add/remove controls below stats. */
  fleetCompositionControls?: React.ReactNode;
  /** Hide COMMON/SHINY badge (used by compact mobile game UI). */
  hideRarityLabel?: boolean;
  /** Hide rank badge (used by compact mobile game UI). */
  hideRankLabel?: boolean;
  /** Render card content without outer border/padding frame. */
  hideOuterFrame?: boolean;
}

/** The card's outlined buttons, as on the Loadouts tiles. */
const CARD_BUTTON =
  "border border-solid px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors duration-150 pointer-coarse:py-2";

/** One number in the card's stat row (design pass D): a small label over a large number. */
function StatCell({
  label,
  value,
  first = false,
  muted = false,
  compact = false,
  title,
}: {
  label: string;
  value: React.ReactNode;
  first?: boolean;
  muted?: boolean;
  compact?: boolean;
  title?: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-0.5 ${first ? "pr-2" : "border-l border-solid border-gunmetal px-2"}`}
      title={title}
    >
      <span className="font-mono text-[9px] tracking-[0.12em] text-text-muted">{label}</span>
      <span
        className={`font-sans font-bold leading-none ${compact ? "text-lg" : "text-2xl"} ${
          muted ? "text-text-secondary" : "text-text-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/** The weapon (cyan) and the special, on one line under the numbers. */
function WeaponAndSpecial({ data, muted }: { data: ShipCardData; muted: boolean }) {
  const special = getSpecialName(data.equipment.special, data.traits.variant);
  return (
    <div className="flex justify-between gap-2 font-mono text-[11px]">
      <span className={`min-w-0 truncate ${muted ? "text-text-muted" : "text-cyan"}`}>
        {getMainWeaponName(data.equipment.mainWeapon, data.traits.variant)}
      </span>
      <span className={`min-w-0 truncate text-right ${special === "None" ? "text-text-muted" : "text-text-primary"}`}>
        {special === "None" ? "No special" : special}
      </span>
    </div>
  );
}

const ShipCard: React.FC<ShipCardProps> = ({
  ship: data,
  shipImage,
  isStarred,
  onToggleStar,
  isSelected,
  onToggleSelection,
  onRecycleClick,
  onCustomizeClick,
  showInGameProperties,
  inGameAttributes,
  attributesLoading = false,
  selectionMode = false,
  hideRecycle = false,
  hideCheckbox = false,
  onCardClick,
  canSelect = true,
  tooltipMode = false,
  isCurrentPlayerShip = false,
  flipShip = false,
  reactorCriticalStatus = "none",
  hasMoved = false,
  gameViewMode = false,
  costsVersionStale = false,
  costVersionSyncButton,
  layoutShipId,
  nameBlockMinHeightPx,
  tooltipGridPosition,
  fleetCompositionControls,
  hideRarityLabel = false,
  hideRankLabel = false,
  hideOuterFrame = false,
}) => {
  const isSosArt =
    !!inGameAttributes &&
    inGameAttributes.hullPoints === 0 &&
    !data.isDestroyed;
  const useCompactStatGrid = gameViewMode && hideRarityLabel && hideRankLabel;
  const useTeamArtBorder = gameViewMode && hideOuterFrame;
  const shipArtBorderColor = useTeamArtBorder
    ? isCurrentPlayerShip
      ? "var(--color-cyan)"
      : "var(--color-warning-red)"
    : "var(--color-gunmetal)";
  const handleCardClick = () => {
    if (selectionMode && onCardClick && canSelect) {
      onCardClick();
    }
  };

  // Get industrial border styles
  const getIndustrialBorderStyle = () => {
    const isInGameView = tooltipMode || gameViewMode;
    const greyFleetCardBorder = {
      borderColor: "var(--color-gunmetal)",
      borderTopColor: "var(--color-steel)",
      borderLeftColor: "var(--color-steel)",
      backgroundColor: tooltipMode ? "var(--color-slate)" : "var(--color-near-black)",
    } as const;

    // Disabled in match (0 HP): grey, not team red/blue or reactor red.
    const isDisabledInGame =
      showInGameProperties &&
      inGameAttributes &&
      !data.isDestroyed &&
      inGameAttributes.hullPoints === 0;

    if (isInGameView && isDisabledInGame) {
      return { ...greyFleetCardBorder };
    }

    if (reactorCriticalStatus === "critical") {
      return {
        borderColor: "var(--color-warning-red)",
        borderTopColor: "var(--color-warning-red)",
        borderLeftColor: "var(--color-warning-red)",
        backgroundColor: "var(--color-slate)",
      };
    }
    if (reactorCriticalStatus === "warning") {
      return {
        borderColor: "var(--color-amber)",
        borderTopColor: "var(--color-amber)",
        borderLeftColor: "var(--color-amber)",
        backgroundColor: "var(--color-slate)",
      };
    }

    if (isInGameView && data.isConstructed && !data.isDestroyed) {
      // Opponent ship has already acted this round: grey instead of red "team" border.
      if (!isCurrentPlayerShip && hasMoved) {
        return { ...greyFleetCardBorder };
      }
      return {
        borderColor: isCurrentPlayerShip ? "var(--color-cyan)" : "var(--color-warning-red)",
        borderTopColor: isCurrentPlayerShip ? "var(--color-cyan)" : "var(--color-warning-red)",
        borderLeftColor: isCurrentPlayerShip ? "var(--color-cyan)" : "var(--color-warning-red)",
        backgroundColor: tooltipMode ? "var(--color-slate)" : "var(--color-near-black)",
      };
    }

    if (selectionMode && isSelected) {
      return {
        borderColor: "var(--color-phosphor-green)",
        borderTopColor: "var(--color-phosphor-green)",
        borderLeftColor: "var(--color-phosphor-green)",
        backgroundColor: tooltipMode ? "var(--color-slate)" : "var(--color-near-black)",
      };
    }
    if (data.isDestroyed) {
      return {
        borderColor: "var(--color-warning-red)",
        borderTopColor: "var(--color-warning-red)",
        borderLeftColor: "var(--color-warning-red)",
        backgroundColor: tooltipMode ? "var(--color-slate)" : "var(--color-near-black)",
      };
    }
    if (costsVersionStale && data.isConstructed && !data.isDestroyed && !data.inFleet) {
      return {
        borderColor: "var(--color-amber)",
        borderTopColor: "var(--color-amber)",
        borderLeftColor: "var(--color-amber)",
        backgroundColor: tooltipMode ? "var(--color-slate)" : "var(--color-near-black)",
      };
    }
    if (data.isConstructed) {
      if (selectionMode) {
        return {
          borderColor: canSelect ? "var(--color-gunmetal)" : "var(--color-gunmetal)",
          borderTopColor: canSelect ? "var(--color-steel)" : "var(--color-gunmetal)",
          borderLeftColor: canSelect ? "var(--color-steel)" : "var(--color-gunmetal)",
          backgroundColor: "var(--color-slate)",
          opacity: canSelect ? 1 : 0.5,
        };
      }
      // Design pass D: the frame says only whether the card is selected
      // (cyan). Rank is under the name and "in fleet" is the status chip, so
      // the card is neither rank-colored nor dimmed.
      const frameColor = isSelected ? "var(--color-cyan)" : "var(--color-gunmetal)";
      return {
        borderColor: frameColor,
        borderTopColor: frameColor,
        borderLeftColor: frameColor,
        backgroundColor: "var(--color-near-black)",
      };
    }
    return {
      borderColor: "var(--color-gunmetal)",
      borderTopColor: "var(--color-steel)",
      borderLeftColor: "var(--color-steel)",
      backgroundColor: "var(--color-near-black)",
    };
  };

  const industrialBorderStyle = getIndustrialBorderStyle();
  // Grid hover tooltip: the board's tooltip frame (tooltipPanel.ts), with the
  // card's status color (ours / theirs / moved / reactor) as its left edge.
  const borderStyle = tooltipMode
    ? tooltipPanelStyle(industrialBorderStyle.borderLeftColor)
    : industrialBorderStyle;
  const rankTooltipLines =
    data.rankNextRank == null
      ? [`Kills: ${data.rankShipsDestroyed}`, "Max rank reached"]
      : [
          `Kills: ${data.rankShipsDestroyed}`,
          `Next rank (R${data.rankNextRank}) in ${data.rankKillsToNextRank} kill${data.rankKillsToNextRank === 1 ? "" : "s"}`,
        ];
  // The status chip on the art (design pass A).
  const statusLabel = data.isDestroyed
    ? `DESTROYED ${formatDestroyedDate(data.timestampDestroyedSeconds)}`
    : hasMoved
      ? "MOVED"
      : gameViewMode || tooltipMode
        ? "READY"
        : data.inFleet
          ? "IN FLEET"
          : "READY";
  const statusColor = data.isDestroyed
    ? "var(--color-warning-red)"
    : hasMoved
      ? "var(--color-amber)"
      : gameViewMode || tooltipMode
        ? "var(--color-cyan)"
        : data.inFleet
          ? "var(--color-amber)"
          : "var(--color-phosphor-green)";
  const rankTooltipAccent =
    data.rank <= 2
      ? "var(--color-phosphor-green)"
      : data.rank <= 4
        ? "var(--color-cyan)"
        : data.rank === 5
          ? "var(--color-amber)"
          : "var(--color-warning-red)";

  // Design pass D (hangar tile): built from the Command Deck and Loadouts
  // tiles. Header (star, name, rank and rarity, Threat), then the art with
  // only the status chip, then hull, the four combat numbers, weapon and
  // special, and a footer with the card's tools.
  const isGameCard = tooltipMode || gameViewMode;
  const pad = hideOuterFrame ? "" : "px-3";
  const showRankLine = data.isConstructed && !hideRankLabel;
  const showRarityLine = !hideRarityLabel;
  const showCustomize = !!onCustomizeClick && data.isConstructed && !data.isDestroyed;
  const showFooter = !hideCheckbox || !hideRecycle || showCustomize;
  const statsMuted = data.isDestroyed;

  return (
    // A size container, so the card can rearrange when it is itself narrow
    // (a phone's two-column list, the battle ship panel) whatever the screen
    // width.
    <div
      className={`@container flex h-full flex-col ${
        hideOuterFrame ? "" : "border-2 border-solid"
      } ${
        selectionMode && canSelect
          ? "cursor-pointer transition-colors duration-150"
          : ""
      }`}
      {...(layoutShipId ? { "data-ship-id": layoutShipId } : {})}
      style={{
        ...(hideOuterFrame ? {} : borderStyle),
        borderRadius: 0, // Square corners
      }}
      onClick={handleCardClick}
      onMouseEnter={(e) => {
        if (selectionMode && canSelect && !isSelected) {
          e.currentTarget.style.borderColor = "var(--color-cyan)";
          e.currentTarget.style.borderTopColor = "var(--color-cyan)";
          e.currentTarget.style.borderLeftColor = "var(--color-cyan)";
          e.currentTarget.style.backgroundColor = "var(--color-steel)";
        }
      }}
      onMouseLeave={(e) => {
        if (selectionMode && canSelect && !isSelected) {
          e.currentTarget.style.borderColor = borderStyle.borderColor;
          e.currentTarget.style.borderTopColor = borderStyle.borderTopColor;
          e.currentTarget.style.borderLeftColor = borderStyle.borderLeftColor;
          e.currentTarget.style.backgroundColor = borderStyle.backgroundColor;
        }
      }}
    >
      {/* Header: star, name with rank and rarity under it, Threat. */}
      <div className={`flex items-start gap-2 ${pad} ${useCompactStatGrid ? "pb-1.5 pt-1" : "pb-2 pt-2.5"}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
          className="mt-0.5 shrink-0 rounded-none p-0.5 transition-colors duration-150 hover:bg-amber/10"
          aria-label={isStarred ? "Unstar ship" : "Star ship"}
          aria-pressed={isStarred}
        >
          <svg
            className="h-4 w-4 text-amber"
            fill={isStarred ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
        <div
          className="flex min-w-0 flex-1 flex-col gap-1"
          {...(layoutShipId ? { "data-ship-name-block": "" } : {})}
          style={
            nameBlockMinHeightPx && nameBlockMinHeightPx > 0
              ? { minHeight: nameBlockMinHeightPx }
              : undefined
          }
        >
          <h5
            className={`line-clamp-2 break-words font-sans font-bold uppercase leading-[1.05] tracking-[0.06em] ${
              data.isShiny ? "text-amber" : "text-text-primary"
            } ${useCompactStatGrid ? "text-base" : "text-[19px]"}`}
          >
            {data.name || `Ship #${data.id}`}
          </h5>
          {(showRankLine || showRarityLine) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
              {showRankLine && (
                <div className="group relative">
                  {/* Focusable so a tap shows the rank tooltip. The tap still
                      reaches the card, so it selects it too. */}
                  <span
                    tabIndex={0}
                    className="flex cursor-default items-center gap-1.5 outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                    aria-label={`Rank ${data.rank}`}
                  >
                    {data.rank > 0 && (
                      <span className={`flex items-center gap-1 ${getRankColor(data.rank)}`} aria-hidden="true">
                        {Array.from({ length: data.rank }, (_, i) => (
                          <span key={i} className="inline-block h-[7px] w-[7px] rotate-45 bg-current" />
                        ))}
                      </span>
                    )}
                    R{data.rank}
                  </span>
                  <div
                    className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden min-w-max border border-solid px-2 py-1 text-xs normal-case tracking-normal group-hover:block group-focus-within:block"
                    style={{
                      backgroundColor: "var(--color-slate)",
                      color: "var(--color-text-primary)",
                      borderColor: rankTooltipAccent,
                      borderRadius: 0,
                      boxShadow: `0 0 12px color-mix(in srgb, ${rankTooltipAccent} 25%, transparent)`,
                    }}
                  >
                    <div style={{ color: rankTooltipAccent }}>{rankTooltipLines[0]}</div>
                    <div className="opacity-80">{rankTooltipLines[1]}</div>
                  </div>
                </div>
              )}
              {showRankLine && showRarityLine && <span className="text-text-muted">·</span>}
              {showRarityLine && (
                <span className={data.isShiny ? "text-amber" : undefined}>{data.isShiny ? "Shiny ★" : "Common"}</span>
              )}
            </div>
          )}
        </div>
        {data.isConstructed && (
          <ThreatValue
            value={data.cost}
            iconSize={useCompactStatGrid ? 16 : 18}
            className={`font-sans ${useCompactStatGrid ? "text-xl" : "text-[26px]"}`}
          />
        )}
      </div>

      {/* Art. Flip only descendant <img> hull art so the overlays stay
          upright for creator-side cards. */}
      <div
        className={`relative w-full min-h-0 shrink-0 border-solid bg-near-black [container-type:size] ${
          hideOuterFrame ? "border" : "border-y"
        } ${isGameCard ? "h-40" : "h-32"}`}
        style={{ borderColor: shipArtBorderColor }}
      >
        <div className={`h-full w-full ${isSosArt ? "overflow-visible" : "overflow-hidden"}`}>
          <div
            className={`relative h-full w-full origin-center ${
              isSosArt ? "sos-art-tilt rotate-[15deg]" : ""
            }`}
          >
            <div
              className={`relative h-full w-full ${
                isSosArt && flipShip
                  ? "sos-art-flip scale-x-[-1]"
                  : flipShip
                    ? "[&_img]:scale-x-[-1]"
                    : ""
              }`}
            >
              <div
                className={`h-full w-full ${hasMoved ? "grayscale" : ""} ${
                  data.isDestroyed ? "brightness-75 grayscale" : ""
                }`}
              >
                {shipImage}
              </div>
              {isSosArt && <SosHullFires shipId={data.id} />}
            </div>
          </div>
        </div>
        {isSosArt && data.rank > 0 && (
          <div
            className={`ship-rank-stars pointer-events-none absolute right-[2.5%] top-[5%] z-10 leading-none text-amber ${
              hasMoved ? "grayscale" : ""
            }`}
            style={{ fontSize: SHIP_IMAGE_RANK_STAR_BOX }}
          >
            {Array.from({ length: data.rank }, (_, i) => (
              <span key={i}>⭐</span>
            ))}
          </div>
        )}

        {/* Game view indicators for tooltip */}
        {isGameCard && inGameAttributes && (
          <>
            {/* Reactor critical marks */}
            {inGameAttributes.reactorCriticalTimer > 0 && (
              <div
                className={`absolute ${
                  flipShip ? "bottom-0 left-0" : "bottom-0 right-0"
                } m-1 flex items-center gap-0.5`}
              >
                {Array.from(
                  { length: Math.min(inGameAttributes.reactorCriticalTimer, 3) },
                  (_, index) => index,
                ).map((level) => (
                  <div
                    key={level}
                    className="flex shrink-0 items-center justify-center rounded-full bg-warning-red/90"
                    style={{
                      width: SHIP_IMAGE_RANK_STAR_BOX,
                      height: SHIP_IMAGE_RANK_STAR_BOX,
                      // Reference em size for the mark (calc(0.85 * clamp(...)) is often dropped by engines).
                      fontSize: SHIP_IMAGE_RANK_STAR_BOX,
                      lineHeight: 1,
                    }}
                  >
                    <span
                      className="font-mono block text-center leading-none"
                      style={{ fontSize: "0.85em", lineHeight: 1 }}
                    >
                      ✕
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Zero HP indicator */}
            {inGameAttributes.hullPoints === 0 && (
              tooltipMode ? (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-1 z-20 pointer-events-none">
                  <div className="w-5 h-5 flex items-center justify-center animate-pulse">
                    <span className="text-xs font-mono">[SOS]</span>
                  </div>
                </div>
              ) : (
                <div
                  className={`absolute w-5 h-5 flex items-center justify-center animate-pulse ${
                    gameViewMode
                      ? "top-0 left-1/2 -translate-x-1/2 mt-1"
                      : "top-0 right-0 m-1"
                  }`}
                >
                  <span className="text-xs font-mono">[SOS]</span>
                </div>
              )
            )}
          </>
        )}

        {/* The only chip on the art: the ship's status. */}
        {data.isConstructed && !isSosArt && (
          <span
            className={`pointer-events-none absolute top-2 z-10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-snug tracking-wider ${
              flipShip ? "right-2" : "left-2"
            }`}
            style={{ backgroundColor: statusColor, color: "var(--color-near-black)" }}
          >
            {statusLabel}
          </span>
        )}
        {tooltipMode && tooltipGridPosition != null && (
          <span
            className={`pointer-events-none absolute top-2 z-10 bg-near-black px-1.5 py-0.5 font-mono text-[10px] text-text-secondary ${flipShip ? "left-2" : "right-2"}`}
          >
            {formatGridPosition(tooltipGridPosition)}
          </span>
        )}
      </div>

      {/* Stats: hull, the four combat numbers in one row, weapon and special. */}
      <div className={`flex flex-col gap-2.5 text-sm ${pad} ${useCompactStatGrid ? "pt-1.5" : "py-2.5"}`}>
        {data.isConstructed ? (
          showInGameProperties ? (
            !inGameAttributes ? (
              <div className="text-center font-mono text-xs text-text-secondary">
                {attributesLoading ? "Loading attributes…" : "Attributes not available"}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider">
                  <span className="text-text-muted">HULL</span>
                  <div className="h-1.5 flex-1 bg-steel">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${
                          data.isDestroyed || inGameAttributes.maxHullPoints <= 0
                            ? 0
                            : (inGameAttributes.hullPoints / inGameAttributes.maxHullPoints) * 100
                        }%`,
                        backgroundColor: hullBarColor(inGameAttributes.hullPoints, inGameAttributes.maxHullPoints),
                      }}
                    />
                  </div>
                  {data.isDestroyed ? (
                    <span className="text-[11px] text-warning-red">DESTROYED</span>
                  ) : (
                    <span className="text-[11px]">
                      <b className="text-text-primary">{inGameAttributes.hullPoints}</b>
                      <span className="text-text-muted">/{inGameAttributes.maxHullPoints}</span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-[1fr_1fr_1fr_1.2fr] @max-[14rem]:grid-cols-2 @max-[14rem]:gap-y-2">
                  <StatCell label="DMG" value={inGameAttributes.gunDamage} first muted={statsMuted} compact={useCompactStatGrid} />
                  <StatCell label="RANGE" value={inGameAttributes.range} muted={statsMuted} compact={useCompactStatGrid} />
                  <StatCell label="MOVE" value={inGameAttributes.movement} muted={statsMuted} compact={useCompactStatGrid} />
                  <StatCell
                    label={data.equipment.shields > 0 ? "SHIELDS" : "ARMOR"}
                    value={`${inGameAttributes.damageReduction}%`}
                    title="Damage reduction"
                    muted={statsMuted}
                    compact={useCompactStatGrid}
                  />
                </div>
                <WeaponAndSpecial data={data} muted={statsMuted} />
              </>
            )
          ) : (
            // The ship's build (traits and equipment), outside a battle.
            <>
              <div className="grid grid-cols-3">
                <StatCell label="ACCURACY" value={data.traits.accuracy} first muted={statsMuted} />
                <StatCell label="HULL" value={data.traits.hull} muted={statsMuted} />
                <StatCell label="SPEED" value={data.traits.speed} muted={statsMuted} />
              </div>
              <div className="flex justify-between gap-2 font-mono text-[11px]">
                <span className="text-text-muted">{data.equipment.shields > 0 ? "Shields" : "Armor"}</span>
                <span className="text-right text-text-primary">
                  {data.equipment.shields > 0 ? getShieldName(data.equipment.shields) : getArmorName(data.equipment.armor)}
                </span>
              </div>
              <WeaponAndSpecial data={data} muted={statsMuted} />
            </>
          )
        ) : (
          <div className="px-2 py-4 text-center">
            <div className="font-mono text-sm font-bold text-text-muted">[CONSTRUCT SHIP]</div>
          </div>
        )}
        {fleetCompositionControls != null && (
          <div onClick={(e) => e.stopPropagation()} role="presentation">
            {fleetCompositionControls}
          </div>
        )}
        {selectionMode && isSelected && (
          <div className="text-center">
            <span className="text-sm font-bold text-phosphor-green">✓ SELECTED</span>
          </div>
        )}
        {costsVersionStale && costVersionSyncButton && (
          <div className="w-full" onClick={(e) => e.stopPropagation()} role="presentation">
            {costVersionSyncButton}
          </div>
        )}
      </div>

      {/* Footer: the card's tools, with words on them. */}
      {showFooter && (
        <div
          className={`mt-auto flex flex-wrap items-center gap-1.5 border-t border-solid border-gunmetal ${
            hideOuterFrame ? "pt-2" : "px-3 py-2"
          }`}
        >
          {!hideCheckbox && (
            <button
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              disabled={data.inFleet}
              title={data.inFleet ? "Ships in a fleet can't be selected" : undefined}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelection();
              }}
              className={`flex items-center gap-1.5 py-1 pr-1 font-mono text-[10px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:py-2 ${
                isSelected ? "text-cyan" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {isSelected ? (
                <span className="flex h-3.5 w-3.5 items-center justify-center bg-cyan" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <path d="M1.5 5 L4 7.5 L8.5 2.5" fill="none" stroke="var(--color-near-black)" strokeWidth="2" />
                  </svg>
                </span>
              ) : (
                <span className="h-3.5 w-3.5 border-2 border-solid border-current" aria-hidden="true" />
              )}
              {isSelected ? "Selected" : "Select"}
            </button>
          )}
          <span className="flex-1" />
          {showCustomize && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCustomizeClick?.();
              }}
              className={`${CARD_BUTTON} border-cyan text-cyan hover:bg-cyan/10`}
            >
              Customize
            </button>
          )}
          {!hideRecycle && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRecycleClick();
              }}
              disabled={data.inFleet}
              title={data.inFleet ? "Remove it from your fleet to recycle it" : undefined}
              className={`${CARD_BUTTON} border-warning-red text-warning-red hover:bg-warning-red/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
            >
              Recycle
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ShipCard;
