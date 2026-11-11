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
import { getRankColor, getRankColorVar } from "../utils/shipLevel";
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

/** One stat tile on the card (design pass A): a label, a large number, a note. */
function StatTile({
  label,
  value,
  note,
  noteAccent = false,
  compact = false,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  noteAccent?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-col bg-near-black ${compact ? "gap-0 px-2 py-1.5" : "gap-0.5 px-2.5 py-2"}`}>
      <span className="text-[10px] tracking-wider text-text-secondary">{label}</span>
      <span className={`font-bold leading-tight ${compact ? "text-base" : "text-xl"}`}>{value}</span>
      {note && (
        <span className={`truncate text-[11px] ${noteAccent ? "text-cyan" : "text-text-secondary"}`}>{note}</span>
      )}
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
      // Rank-colored border (matches the R{rank} badge and purchase-tier
      // colors — see getRankColorVar). In-fleet ships keep this same color
      // rather than switching to amber; the card is dimmed instead so
      // "in fleet" reads as a card-level state, not a rank-colored one.
      // The amber "IN FLEET" status text elsewhere on the card is unrelated
      // and unchanged.
      const rankColor = getRankColorVar(data.rank);
      return {
        borderColor: rankColor,
        borderTopColor: rankColor,
        borderLeftColor: rankColor,
        backgroundColor: "var(--color-near-black)",
        opacity: data.inFleet ? 0.5 : 1,
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

  return (
    // A size container, so the header can stack when the card itself is
    // narrow (a phone's two-column list, the battle ship panel) whatever the
    // screen width.
    <div
      className={`@container h-full ${
        hideOuterFrame ? "" : "border border-solid p-4"
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
      {/* Ship Image - Bigger. Flip only descendant <img> hull art so rank
          stars and special overlays stay upright for creator-side cards. */}
      <div className="relative mb-3 h-48 w-full min-h-0 [container-type:size]">
        <div
          className={`h-full w-full border border-solid ${
            isSosArt ? "overflow-visible" : "overflow-hidden"
          }`}
          style={{
            borderColor: shipArtBorderColor,
            borderRadius: 0, // Square corners
          }}
        >
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
              <div className={`h-full w-full ${hasMoved ? "grayscale" : ""}`}>
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
        {(tooltipMode || gameViewMode) && inGameAttributes && (
          <>
            {/* Reactor critical skulls */}
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
                      // Reference em size for the skull (calc(0.85 * clamp(...)) is often dropped by engines).
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

        {/* Design pass A: status, rarity, rank and position sit on the art,
            out of the stat grid. Badges go on the side away from the
            reactor marks (which follow the ship's facing). */}
        {data.isConstructed && !isSosArt && (
          <span
            className="pointer-events-none absolute left-1.5 top-1.5 z-10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              fontFamily: "var(--font-jetbrains-mono), 'Courier New', monospace",
              backgroundColor: statusColor,
              color: "var(--color-near-black)",
            }}
          >
            {statusLabel}
          </span>
        )}
        {(!hideRarityLabel || (data.isConstructed && !hideRankLabel)) && (
          <div className={`absolute bottom-1.5 z-10 flex items-center gap-1.5 ${flipShip ? "right-1.5" : "left-1.5"}`}>
            {!hideRarityLabel && (
              <span
                className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap border border-solid px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  fontFamily: "var(--font-jetbrains-mono), 'Courier New', monospace",
                  backgroundColor: "var(--color-near-black)",
                  color: data.isShiny ? "var(--color-amber)" : "var(--color-text-secondary)",
                  borderColor: data.isShiny ? "var(--color-amber)" : "var(--color-gunmetal)",
                  borderRadius: 0,
                }}
              >
                {data.isShiny ? "SHINY ★" : "COMMON"}
              </span>
            )}
            {data.isConstructed && !hideRankLabel && (
              <div className="relative group">
                {/* Focusable so a tap shows the rank tooltip (hover-only before).
                    The tap still reaches the card, so it selects it too. */}
                <span
                  tabIndex={0}
                  className={`cursor-default border border-solid bg-near-black px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider outline-none focus-visible:ring-1 focus-visible:ring-cyan ${getRankColor(
                    data.rank,
                  )}`}
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), 'Courier New', monospace",
                    borderRadius: 0,
                  }}
                >
                  R{data.rank}
                </span>
                <div
                  className={`pointer-events-none absolute bottom-full mb-1 hidden min-w-max border border-solid px-2 py-1 text-xs group-hover:block group-focus-within:block z-20 ${
                    flipShip ? "right-0" : "left-0"
                  }`}
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), 'Courier New', monospace",
                    backgroundColor: "var(--color-slate)",
                    color: "var(--color-text-primary)",
                    borderColor: rankTooltipAccent,
                    borderTopColor: rankTooltipAccent,
                    borderLeftColor: rankTooltipAccent,
                    borderRadius: 0,
                    boxShadow: `0 0 12px color-mix(in srgb, ${rankTooltipAccent} 25%, transparent)`,
                  }}
                >
                  <div style={{ color: rankTooltipAccent }}>{rankTooltipLines[0]}</div>
                  <div className="opacity-80">{rankTooltipLines[1]}</div>
                </div>
              </div>
            )}
          </div>
        )}
        {tooltipMode && tooltipGridPosition != null && (
          <span
            className={`pointer-events-none absolute top-1.5 z-10 bg-near-black px-1.5 py-0.5 text-[10px] text-text-secondary ${flipShip ? "left-1.5" : "right-1.5"}`}
            style={{ fontFamily: "var(--font-jetbrains-mono), 'Courier New', monospace" }}
          >
            {formatGridPosition(tooltipGridPosition)}
          </span>
        )}
      </div>

      <div
        className={`flex justify-between items-start @max-[18rem]:flex-col @max-[18rem]:gap-1 ${
          useCompactStatGrid ? "mb-1.5" : "mb-3"
        }`}
      >
        <div
          className={`flex items-start min-w-0 ${
            useCompactStatGrid ? "gap-1.5" : "gap-2"
          }`}
          {...(layoutShipId ? { "data-ship-name-block": "" } : {})}
          style={
            nameBlockMinHeightPx && nameBlockMinHeightPx > 0
              ? { minHeight: nameBlockMinHeightPx }
              : undefined
          }
        >
          {/* Star icon where checkbox used to be */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar();
            }}
            className={`shrink-0 hover:bg-amber/10 rounded-none transition-all duration-200 ${
              useCompactStatGrid ? "p-0.5 mt-0" : "p-1 mt-0.5"
            }`}
          >
            <svg
              className={`w-4 h-4 ${
                isStarred
                  ? "text-amber fill-amber"
                  : "text-amber"
              }`}
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
          <h5
            className={`font-bold min-w-0 break-words leading-tight ${
              useCompactStatGrid ? "text-base" : "text-lg"
            }`}
          >
            {data.name || `Ship #${data.id}`}
          </h5>
        </div>
        {/* On a narrow card the icons and chips go on a second row under the
            name rather than squeezing it into a narrow column. */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 @max-[18rem]:justify-start @max-[18rem]:gap-1.5">
          {onCustomizeClick && data.isConstructed && !data.isDestroyed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCustomizeClick();
              }}
              className="p-1 text-cyan hover:text-cyan hover:bg-cyan/10 rounded-none transition-all duration-200 pointer-coarse:p-2"
              title="Customize ship"
              aria-label="Customize ship"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.42 15.17l-5.38 5.38a2.12 2.12 0 11-3-3l5.38-5.38m3 3l5.38-5.38a4.24 4.24 0 00-3-7.24 4.24 4.24 0 00-3 1.18L8.42 9.17m3 3l-3-3"
                />
              </svg>
            </button>
          )}
          {/* Recycle icon */}
          {!hideRecycle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRecycleClick();
              }}
              disabled={data.inFleet}
              className="p-1 text-warning-red hover:text-warning-red hover:bg-warning-red/10 rounded-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed pointer-coarse:p-2"
              title={
                data.inFleet
                  ? "Cannot recycle ship in fleet"
                  : "Recycle ship"
              }
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
          {/* Checkbox for selection */}
          {!hideCheckbox && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelection();
              }}
              onClick={(e) => e.stopPropagation()}
              disabled={data.inFleet}
              className="w-4 h-4 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                accentColor: "var(--color-cyan)",
                borderColor: isSelected ? "var(--color-cyan)" : "var(--color-cyan)",
                backgroundColor: isSelected
                  ? "var(--color-cyan)"
                  : "var(--color-near-black)",
                borderTopColor: isSelected ? "var(--color-cyan)" : "var(--color-cyan)",
                borderLeftColor: isSelected ? "var(--color-cyan)" : "var(--color-cyan)",
                borderRadius: 0, // Square checkbox
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                width: "16px",
                height: "16px",
                border: "2px solid",
                position: "relative",
              }}
            />
          )}
          {data.isConstructed && (
            <ThreatValue
              value={data.cost}
              iconSize={useCompactStatGrid ? 16 : 20}
              className={useCompactStatGrid ? "text-xl" : "text-3xl"}
            />
          )}
        </div>
      </div>

      {/* Stats (design pass A): hull as a bar, the combat numbers as tiles,
          then the loadout. Status and Threat are on the art and in the header. */}
      <div className="text-sm">
        {data.isConstructed ? (
          showInGameProperties ? (
            !inGameAttributes ? (
              <div className="text-center text-xs text-text-secondary">
                {attributesLoading ? "Loading attributes…" : "Attributes not available"}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-[10px] tracking-wider">
                    <span className="text-text-secondary">HULL</span>
                    <span>
                      <b
                        className="text-sm"
                        style={{ color: hullBarColor(inGameAttributes.hullPoints, inGameAttributes.maxHullPoints) }}
                      >
                        {inGameAttributes.hullPoints}
                      </b>
                      <span className="text-text-secondary"> / {inGameAttributes.maxHullPoints}</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-steel">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${inGameAttributes.maxHullPoints > 0 ? (inGameAttributes.hullPoints / inGameAttributes.maxHullPoints) * 100 : 0}%`,
                        backgroundColor: hullBarColor(inGameAttributes.hullPoints, inGameAttributes.maxHullPoints),
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-px bg-steel">
                  <StatTile
                    label="DAMAGE"
                    value={inGameAttributes.gunDamage}
                    note={getMainWeaponName(data.equipment.mainWeapon, data.traits.variant)}
                    noteAccent
                    compact={useCompactStatGrid}
                  />
                  <StatTile label="RANGE" value={inGameAttributes.range} note="tiles" compact={useCompactStatGrid} />
                  <StatTile label="MOVE" value={inGameAttributes.movement} note="tiles" compact={useCompactStatGrid} />
                  <StatTile
                    label={data.equipment.shields > 0 ? "SHIELDS" : "ARMOR"}
                    value={`${inGameAttributes.damageReduction}%`}
                    note="less damage taken"
                    compact={useCompactStatGrid}
                  />
                </div>
                <div className="flex justify-between gap-2 text-xs">
                  <span className="text-text-secondary">Special</span>
                  <span className="text-right">{getSpecialName(data.equipment.special, data.traits.variant)}</span>
                </div>
              </div>
            )
          ) : (
            // The ship's build (traits and equipment), outside a battle.
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-px bg-steel">
                <StatTile label="ACCURACY" value={data.traits.accuracy} compact />
                <StatTile label="HULL" value={data.traits.hull} compact />
                <StatTile label="SPEED" value={data.traits.speed} compact />
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-text-secondary">Weapon</span>
                  <span className="text-right text-cyan">{getMainWeaponName(data.equipment.mainWeapon, data.traits.variant)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-text-secondary">{data.equipment.shields > 0 ? "Shields" : "Armor"}</span>
                  <span className="text-right">
                    {data.equipment.shields > 0 ? getShieldName(data.equipment.shields) : getArmorName(data.equipment.armor)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-text-secondary">Special</span>
                  <span className="text-right">{getSpecialName(data.equipment.special, data.traits.variant)}</span>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-4 px-2">
            <div className="text-text-muted text-sm font-mono font-bold">
              [CONSTRUCT SHIP]
            </div>
          </div>
        )}
      </div>
      {fleetCompositionControls != null && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()} role="presentation">
          {fleetCompositionControls}
        </div>
      )}
      {/* Selection Indicator */}
      {selectionMode && isSelected && (
        <div className="mt-2 text-center">
          <span className="text-phosphor-green text-sm font-bold">✓ SELECTED</span>
        </div>
      )}
      {costsVersionStale && costVersionSyncButton && (
        <div
          className="mt-3 w-full"
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          {costVersionSyncButton}
        </div>
      )}
    </div>
  );
};

export default ShipCard;
