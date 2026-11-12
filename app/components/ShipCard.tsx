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

/** The card's outlined buttons, as on the Loadouts tiles. */
const CARD_BUTTON =
  "border border-solid px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors duration-150 pointer-coarse:py-2";

/** Cut corners for the card frame and its inner panel (design pass G). */
const CARD_CHAMFER =
  "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)";
/** A small padlock for free ships (they can't be recycled). */
function LockGlyph({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <rect x="3" y="7" width="10" height="7.5" fill="currentColor" />
      <path d="M5 7 V5 a3 3 0 0 1 6 0 V7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
const BADGE_CHAMFER =
  "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)";
/** The frame's foil in a rank color: light, dark, and back, so it catches the light. */
function rankFrameFill(color: string): string {
  return `linear-gradient(150deg, color-mix(in srgb, ${color} 70%, white), color-mix(in srgb, ${color} 55%, black) 50%, ${color})`;
}
/** The art bay: a few stars, scanlines and a glow in the rarity color. */
const BAY_STARS =
  "radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,0.55), transparent 60%)," +
  "radial-gradient(1px 1px at 78% 14%, rgba(255,255,255,0.45), transparent 60%)," +
  "radial-gradient(1px 1px at 64% 72%, rgba(255,255,255,0.35), transparent 60%)," +
  "radial-gradient(1.5px 1.5px at 30% 80%, rgba(255,255,255,0.4), transparent 60%)," +
  "radial-gradient(1px 1px at 90% 58%, rgba(255,255,255,0.5), transparent 60%)," +
  "radial-gradient(1px 1px at 45% 10%, rgba(255,255,255,0.35), transparent 60%)";
const HULL_SEGMENTS = 12;

/** One stat on a small plate (design pass G): a label over a large number. */
function StatPlate({
  label,
  value,
  muted = false,
  compact = false,
  title,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  compact?: boolean;
  title?: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-0.5 border-t-2 border-solid bg-steel/55 ${
        compact ? "px-1.5 py-1" : "px-[7px] pb-[7px] pt-1.5"
      } ${muted ? "border-text-muted" : "border-cyan"}`}
      title={title}
    >
      <span className="truncate font-mono text-[9px] tracking-[0.12em] text-text-muted">{label}</span>
      <span
        className={`font-sans font-bold leading-none ${compact ? "text-lg" : "text-[22px]"} ${
          muted ? "text-text-secondary" : "text-text-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/** Hull as a row of segments. */
function HullSegments({ hull, maxHull, destroyed }: { hull: number; maxHull: number; destroyed: boolean }) {
  const filled = destroyed || maxHull <= 0 ? 0 : Math.round((HULL_SEGMENTS * hull) / maxHull);
  // A ship with any hull left shows at least one lit segment.
  const lit = !destroyed && hull > 0 ? Math.max(filled, 1) : filled;
  const color = hullBarColor(hull, maxHull);
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider">
      <span className="text-text-muted">HULL</span>
      <div
        className="flex flex-1 gap-0.5"
        role="img"
        aria-label={destroyed ? "Hull: destroyed" : `Hull ${hull} of ${maxHull}`}
      >
        {Array.from({ length: HULL_SEGMENTS }, (_, i) => (
          <span
            key={i}
            className="h-[7px] flex-1"
            style={
              i < lit
                ? { backgroundColor: color, boxShadow: `0 0 6px color-mix(in srgb, ${color} 40%, transparent)` }
                : { backgroundColor: "var(--color-steel)" }
            }
          />
        ))}
      </div>
      {destroyed ? (
        <span className="text-[11px] text-warning-red">DESTROYED</span>
      ) : (
        <span className="text-[11px]">
          <b className="text-text-primary">{hull}</b>
          <span className="text-text-muted">/{maxHull}</span>
        </span>
      )}
    </div>
  );
}

/** The weapon and the special as two tags. */
function LoadoutTags({ data, muted }: { data: ShipCardData; muted: boolean }) {
  const special = getSpecialName(data.equipment.special, data.traits.variant);
  const noSpecial = special === "None";
  return (
    <div className="flex gap-1.5 font-mono text-[10px] tracking-wide">
      <span
        className={`min-w-0 flex-1 truncate border border-solid px-1.5 py-1 ${
          muted ? "border-text-muted/40 text-text-muted" : "border-cyan/40 text-cyan"
        }`}
        title="Weapon"
      >
        ⌁ {getMainWeaponName(data.equipment.mainWeapon, data.traits.variant)}
      </span>
      <span
        className={`min-w-0 flex-1 truncate border border-solid border-gunmetal px-1.5 py-1 ${
          noSpecial ? "text-text-muted" : "text-text-primary"
        }`}
        title="Special"
      >
        ✦ {noSpecial ? "No special" : special}
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
  // The ship's rank color: the store's tier colors (R1 gray, R2 green, R3
  // cyan, R4 purple, R5 amber, then red), see getRankColorVar.
  const rankColor = getRankColorVar(data.rank);
  const rankTooltipAccent = rankColor;

  // Design pass G (foil frame): a trading card. A frame with cut corners in
  // the ship's rank color (the store's tier colors), a sheen across a shiny
  // ship's art, the ship
  // large in a starfield bay with Threat and status on it, the name plate
  // over the bottom of the art, then hull, the stats, and the loadout. The
  // tools sit under the card, outside the frame.
  const isGameCard = tooltipMode || gameViewMode;
  const showRankLine = data.isConstructed && !hideRankLabel;
  const showRarityLine = !hideRarityLabel;
  const showCustomize = !!onCustomizeClick && data.isConstructed && !data.isDestroyed;
  const showTools = !hideCheckbox || !hideRecycle || showCustomize;
  const statsMuted = data.isDestroyed;
  const showSheen = data.isShiny && !data.isDestroyed && !isSosArt;
  // State frames (selected, destroyed, stale, team colors in a battle) are
  // solid; a plain Fleet card shows its rank color.
  const frameIsRank =
    !isGameCard &&
    data.isConstructed &&
    !data.isDestroyed &&
    !isSelected &&
    !(costsVersionStale && !data.inFleet);
  const frameFill = frameIsRank ? rankFrameFill(rankColor) : borderStyle.borderColor;
  const bayGlow = data.isDestroyed
    ? "rgba(255,77,77,0.16)"
    : data.isShiny
      ? "rgba(255,184,77,0.26)"
      : `color-mix(in srgb, ${rankColor} 24%, transparent)`;
  const artFilter = [
    // A destroyed ship's wreck stays in color; a ship that moved this round
    // is grey.
    hasMoved ? "grayscale(1)" : `drop-shadow(0 0 14px ${bayGlow})`,
  ]
    .filter(Boolean)
    .join(" ");
  const panelBackground = tooltipMode ? "var(--color-slate)" : "var(--color-near-black)";
  const frameVars = { "--ship-card-frame": frameFill } as React.CSSProperties;

  const card = (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Art bay. Flip only descendant <img> hull art so the overlays stay
          upright for creator-side cards. */}
      <div
        className={`relative w-full min-h-0 shrink-0 overflow-hidden [container-type:size] ${
          useCompactStatGrid ? "h-36" : isGameCard ? "h-44" : "h-48"
        } ${hideOuterFrame ? "border border-solid" : ""}`}
        style={{
          borderColor: shipArtBorderColor,
          background: `${BAY_STARS}, radial-gradient(ellipse 70% 60% at 50% 55%, ${bayGlow}, transparent 70%), linear-gradient(180deg, #111a24, var(--color-near-black))`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)" }}
        />
        <div className={`h-full w-full ${isSosArt ? "overflow-visible" : ""}`}>
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
              {/* The art is drawn larger than its square so the hull fills
                  the bay's width (the square's top and bottom are empty). */}
              <div
                className="h-full w-full scale-[1.3] [&_img]:[image-rendering:pixelated]"
                style={artFilter ? { filter: artFilter } : undefined}
              >
                {shipImage}
              </div>
              {isSosArt && <SosHullFires shipId={data.id} />}
            </div>
          </div>
        </div>
        {showSheen && <div className="ship-card-sheen pointer-events-none absolute inset-0" aria-hidden="true" />}
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
                className={`absolute z-10 ${
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
              <div className="pointer-events-none absolute left-1/2 top-0 z-20 mt-1 flex h-5 w-5 -translate-x-1/2 animate-pulse items-center justify-center">
                <span className="text-xs font-mono">[SOS]</span>
              </div>
            )}
          </>
        )}

        {/* Status top left, Threat top right (mirrored for a flipped ship). */}
        {data.isConstructed && !isSosArt && (
          <span
            className={`pointer-events-none absolute top-2.5 z-10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-snug tracking-wider ${
              flipShip ? "right-2.5" : "left-2.5"
            }`}
            style={{ backgroundColor: statusColor, color: "var(--color-near-black)" }}
          >
            {statusLabel}
          </span>
        )}
        {data.isConstructed && (
          // The outline is a filled chamfer under a 1px-inset one (as the card
          // frame), since a CSS border is cut off on clipped corners and edges.
          <span
            className={`absolute top-2 z-10 bg-amber/55 p-px ${flipShip ? "left-2" : "right-2"}`}
            style={{ clipPath: BADGE_CHAMFER }}
          >
            <span className="block bg-near-black py-1 pl-2.5 pr-3" style={{ clipPath: BADGE_CHAMFER }}>
              <ThreatValue
                value={data.cost}
                iconSize={useCompactStatGrid ? 13 : 16}
                className={`font-sans ${useCompactStatGrid ? "text-lg" : "text-[22px]"}`}
              />
            </span>
          </span>
        )}
        {tooltipMode && tooltipGridPosition != null && (
          <span
            className={`pointer-events-none absolute bottom-2 z-10 bg-near-black/90 px-1.5 py-0.5 font-mono text-[10px] text-text-secondary ${flipShip ? "right-2" : "left-2"}`}
          >
            {formatGridPosition(tooltipGridPosition)}
          </span>
        )}
      </div>

      {/* Name plate, over the bottom of the art. */}
      <div
        className={`relative -mt-7 flex flex-col gap-1.5 pb-2.5 pt-2.5 ${hideOuterFrame ? "" : "px-3"}`}
        style={{ background: `linear-gradient(180deg, transparent, ${panelBackground} 26px)` }}
      >
        <div className="flex items-start gap-2">
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
            className="flex min-w-0 flex-1 flex-col gap-1.5"
            {...(layoutShipId ? { "data-ship-name-block": "" } : {})}
            style={
              nameBlockMinHeightPx && nameBlockMinHeightPx > 0
                ? { minHeight: nameBlockMinHeightPx }
                : undefined
            }
          >
            <h5
              className={`line-clamp-2 break-words font-sans font-bold uppercase leading-[1.05] tracking-[0.06em] [text-shadow:0_1px_6px_rgba(0,0,0,0.8)] ${
                data.isShiny ? "text-amber" : "text-text-primary"
              } ${useCompactStatGrid ? "text-base" : "text-xl"}`}
            >
              {data.name || `Ship #${data.id}`}
            </h5>
            {(showRankLine || showRarityLine || data.isFree) && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-text-secondary">
                {showRankLine && (
                  <div className="group relative">
                    {/* Focusable so a tap shows the rank tooltip. The tap
                        still reaches the card, so it selects it too. */}
                    <span
                      tabIndex={0}
                      className="flex cursor-default items-center gap-1.5 outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                      aria-label={`Rank ${data.rank}`}
                    >
                      {data.rank > 0 && (
                        <span className={`flex items-center gap-1 ${getRankColor(data.rank)}`} aria-hidden="true">
                          {Array.from({ length: data.rank }, (_, i) => (
                            <span
                              key={i}
                              className="inline-block h-[7px] w-[7px] rotate-45 bg-current shadow-[0_0_5px_currentColor]"
                            />
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
                {data.isFree && (
                  <>
                    {(showRankLine || showRarityLine) && <span className="text-text-muted">·</span>}
                    <span
                      className="inline-flex items-center gap-1 border border-solid border-cyan/40 px-1.5 leading-[13px] text-cyan"
                      title="A free ship: it can't be recycled"
                    >
                      <LockGlyph />
                      Free
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`h-px ${hideOuterFrame ? "" : "mx-3"}`}
        style={{ background: "linear-gradient(90deg, transparent, var(--color-gunmetal), transparent)" }}
      />

      {/* Hull, the stats on plates, and the loadout tags. */}
      <div
        className={`flex flex-1 flex-col gap-2.5 text-sm ${hideOuterFrame ? "" : "px-3"} ${
          useCompactStatGrid ? "pt-2" : "pb-3.5 pt-2.5"
        }`}
      >
        {data.isConstructed ? (
          showInGameProperties ? (
            !inGameAttributes ? (
              <div className="text-center font-mono text-xs text-text-secondary">
                {attributesLoading ? "Loading attributes…" : "Attributes not available"}
              </div>
            ) : (
              <>
                <HullSegments
                  hull={inGameAttributes.hullPoints}
                  maxHull={inGameAttributes.maxHullPoints}
                  destroyed={data.isDestroyed}
                />
                <div className="grid grid-cols-[1fr_1fr_1fr_1.25fr] gap-1 @max-[14rem]:grid-cols-2">
                  <StatPlate label="DMG" value={inGameAttributes.gunDamage} muted={statsMuted} compact={useCompactStatGrid} />
                  <StatPlate label="RANGE" value={inGameAttributes.range} muted={statsMuted} compact={useCompactStatGrid} />
                  <StatPlate label="MOVE" value={inGameAttributes.movement} muted={statsMuted} compact={useCompactStatGrid} />
                  <StatPlate
                    label={data.equipment.shields > 0 ? "SHIELDS" : "ARMOR"}
                    value={`${inGameAttributes.damageReduction}%`}
                    title="Damage reduction"
                    muted={statsMuted}
                    compact={useCompactStatGrid}
                  />
                </div>
                <LoadoutTags data={data} muted={statsMuted} />
              </>
            )
          ) : (
            // The ship's build (traits and equipment), outside a battle.
            <>
              <div className="grid grid-cols-3 gap-1">
                <StatPlate label="ACCURACY" value={data.traits.accuracy} muted={statsMuted} />
                <StatPlate label="HULL" value={data.traits.hull} muted={statsMuted} />
                <StatPlate label="SPEED" value={data.traits.speed} muted={statsMuted} />
              </div>
              <div className="flex justify-between gap-2 font-mono text-[11px]">
                <span className="text-text-muted">{data.equipment.shields > 0 ? "Shields" : "Armor"}</span>
                <span className="text-right text-text-primary">
                  {data.equipment.shields > 0 ? getShieldName(data.equipment.shields) : getArmorName(data.equipment.armor)}
                </span>
              </div>
              <LoadoutTags data={data} muted={statsMuted} />
            </>
          )
        ) : (
          <div className="px-2 py-4 text-center">
            <div className="font-mono text-sm font-bold text-text-muted">[CONSTRUCT SHIP]</div>
          </div>
        )}
        {selectionMode && isSelected && (
          <div className="text-center">
            <span className="text-sm font-bold text-phosphor-green">✓ SELECTED</span>
          </div>
        )}
      </div>
      {/* The card's tools, along its bottom (the right inset clears the cut corner). */}
      {showTools && (
        <div
          className={`flex flex-wrap items-center gap-1.5 border-t border-solid border-gunmetal pb-2.5 pt-2 ${
            hideOuterFrame ? "" : "pl-3 pr-4"
          }`}
        >
          {!hideCheckbox && (
            <button
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              // Selecting is for recycling, so a free ship can't be selected.
              disabled={data.inFleet || data.isFree}
              title={
                data.inFleet
                  ? "Ships in a fleet can't be selected"
                  : data.isFree
                    ? "Free ships can't be recycled"
                    : undefined
              }
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
          {!hideRecycle && data.isFree && (
            <span
              className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted"
              title="Free ships can't be recycled"
            >
              <LockGlyph size={11} />
              No recycle
            </span>
          )}
          {!hideRecycle && !data.isFree && (
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

  return (
    // A size container, so the card can rearrange when it is itself narrow
    // (a phone's two-column list, the battle ship panel) whatever the screen
    // width.
    <div
      className={`@container flex h-full flex-col ${
        selectionMode && canSelect ? "cursor-pointer" : ""
      } ${selectionMode && !canSelect ? "opacity-50" : ""}`}
      {...(layoutShipId ? { "data-ship-id": layoutShipId } : {})}
      style={frameVars}
      onClick={handleCardClick}
      onMouseEnter={(e) => {
        if (selectionMode && canSelect && !isSelected) {
          e.currentTarget.style.setProperty("--ship-card-frame", "var(--color-cyan)");
        }
      }}
      onMouseLeave={(e) => {
        if (selectionMode && canSelect && !isSelected) {
          e.currentTarget.style.setProperty("--ship-card-frame", frameFill);
        }
      }}
    >
      {hideOuterFrame ? (
        card
      ) : (
        <div
          className="flex min-h-0 flex-1 flex-col p-0.5 transition-[background] duration-150"
          style={{ background: "var(--ship-card-frame)", clipPath: CARD_CHAMFER }}
        >
          <div className="flex min-h-0 flex-1 flex-col" style={{ clipPath: CARD_CHAMFER, backgroundColor: panelBackground }}>
            {card}
          </div>
        </div>
      )}

      {/* Under the card: the Manage Navy extras. */}
      {fleetCompositionControls != null && (
        <div className="pt-2" onClick={(e) => e.stopPropagation()} role="presentation">
          {fleetCompositionControls}
        </div>
      )}
      {costsVersionStale && costVersionSyncButton && (
        <div className="w-full pt-2" onClick={(e) => e.stopPropagation()} role="presentation">
          {costVersionSyncButton}
        </div>
      )}
    </div>
  );
};

export default ShipCard;
