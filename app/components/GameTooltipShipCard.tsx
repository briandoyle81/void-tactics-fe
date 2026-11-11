"use client";

import React from "react";
import type { ShipCardData } from "../types/shipCardData";
import { getSpecialName, type Attributes } from "../types/types";
import { formatGridPosition } from "../utils/gridPosition";
import { tooltipPanelStyle } from "./tooltipPanel";
import { ThreatValue, hullBarColor } from "./ThreatIcon";

interface GameTooltipShipCardProps {
  ship: ShipCardData;
  shipImage: React.ReactNode;
  attributes: Attributes | undefined;
  isCurrentPlayerShip: boolean;
  flipShip: boolean;
  hasMoved: boolean;
  gridPosition: { row: number; col: number };
}

/** The hover card's size, for placing it (HoverShipCardTooltip). */
export const GAME_TOOLTIP_SHIP_CARD_SIZE = { width: 448, height: 190 };

/** Reactor overload points that destroy a ship. */
const REACTOR_OVERLOAD_LIMIT = 3;

// The battle board's ship hover card (design pass B: a wide, short HUD card
// that covers few tiles). Shared by GameDisplay.tsx (web3), GameDisplayWeb2.tsx
// (web2) and SimulatedGameDisplay.tsx (the tutorial). Reads in order of
// urgency: side stripe, name and status, hull and reactor overload, the four
// combat numbers, then special, position and Threat. A disabled ship (0 hull)
// shows its SOS and what it means instead of the numbers.
export const GameTooltipShipCard: React.FC<GameTooltipShipCardProps> = ({
  ship,
  shipImage,
  attributes,
  isCurrentPlayerShip,
  flipShip,
  hasMoved,
  gridPosition,
}) => {
  const side = isCurrentPlayerShip ? "var(--color-cyan)" : "var(--color-warning-red)";
  const disabled = !!attributes && attributes.hullPoints === 0 && !ship.isDestroyed;
  const overload = Math.min(attributes?.reactorCriticalTimer ?? 0, REACTOR_OVERLOAD_LIMIT);
  // One point from destruction: the lit dots blink like an alarm.
  const overloadCritical = overload === REACTOR_OVERLOAD_LIMIT - 1;
  const status = disabled
    ? { label: "DISABLED", bg: "var(--color-warning-red)", fg: "#ffffff" }
    : hasMoved
      ? { label: "MOVED", bg: "var(--color-amber)", fg: "var(--color-near-black)" }
      : { label: "READY", bg: "var(--color-cyan)", fg: "var(--color-near-black)" };
  const hullPct = attributes && attributes.maxHullPoints > 0 ? (attributes.hullPoints / attributes.maxHullPoints) * 100 : 0;
  const defenseLabel = ship.equipment.shields > 0 ? "SHIELD" : "ARMOR";

  return (
    <div className="flex w-full border border-solid font-mono text-text-primary" style={tooltipPanelStyle(side)}>
      {/* Art */}
      <div className="relative flex w-[7.5rem] shrink-0 items-center justify-center bg-slate">
        <div
          className={`h-[5.5rem] w-full ${flipShip ? "[&_img]:scale-x-[-1]" : ""} ${hasMoved || disabled ? "grayscale" : ""} ${
            disabled ? "opacity-60" : ""
          }`}
        >
          {shipImage}
        </div>
        {disabled && (
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 animate-pulse bg-warning-red px-1.5 py-0.5 text-[11px] font-bold text-white">
            [SOS]
          </span>
        )}
      </div>

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xl font-bold leading-none" style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
            {ship.name || `Ship #${ship.id}`}
          </span>
          <span className="shrink-0 text-[10px] text-text-secondary">
            R{ship.rank} · {ship.isShiny ? <span className="text-amber">SHINY ★</span> : "COMMON"}
          </span>
          <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold tracking-wider" style={{ backgroundColor: status.bg, color: status.fg }}>
            {status.label}
          </span>
        </div>

        {attributes ? (
          <>
            <div className="flex items-center gap-2.5">
              <div className="h-2.5 flex-1 bg-steel">
                <div className="h-full" style={{ width: `${hullPct}%`, backgroundColor: hullBarColor(attributes.hullPoints, attributes.maxHullPoints) }} />
              </div>
              <span className="text-xs font-bold" style={{ color: disabled ? "var(--color-warning-red)" : undefined }}>
                {attributes.hullPoints}
                <span className="font-normal text-text-secondary">/{attributes.maxHullPoints}</span>
              </span>
              <span className="flex gap-[3px]" role="img" aria-label={`Reactor overload ${overload} of ${REACTOR_OVERLOAD_LIMIT}`} title="Reactor overload">
                {Array.from({ length: REACTOR_OVERLOAD_LIMIT }, (_, i) => (
                  <span
                    key={i}
                    className={`h-[9px] w-[9px] rounded-full border border-solid ${
                      overloadCritical && i < overload ? "reactor-alarm-blink" : ""
                    }`}
                    style={
                      i < overload
                        ? { backgroundColor: "var(--color-warning-red)", borderColor: "var(--color-warning-red)" }
                        : { borderColor: "var(--color-text-secondary)" }
                    }
                  />
                ))}
              </span>
            </div>

            {disabled ? (
              <div className="bg-slate px-2.5 py-2 text-xs leading-relaxed">
                {overload >= REACTOR_OVERLOAD_LIMIT - 1 && "One more overload point destroys it. "}
                {isCurrentPlayerShip ? (
                  <>
                    <span className="font-bold text-phosphor-green">Retreat</span> or repair it before its reactor fails.
                  </>
                ) : (
                  "It can't move or fire."
                )}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 text-[10px] tracking-wide text-text-secondary">
                <div className="flex flex-col">
                  <span>DMG</span>
                  <b className="text-base text-text-primary">{attributes.gunDamage}</b>
                </div>
                <div className="flex flex-col">
                  <span>RANGE</span>
                  <b className="text-base text-text-primary">{attributes.range}</b>
                </div>
                <div className="flex flex-col">
                  <span>MOVE</span>
                  <b className="text-base text-text-primary">{attributes.movement}</b>
                </div>
                <div className="flex flex-col">
                  <span>{defenseLabel}</span>
                  <b className="text-base text-text-primary">{attributes.damageReduction}%</b>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-text-secondary">Loading attributes…</div>
        )}

        <div className="flex items-center justify-between gap-2 text-[11px] text-text-secondary">
          <span className="min-w-0 truncate">
            Special: <span className="text-text-primary">{getSpecialName(ship.equipment.special, ship.traits.variant)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {formatGridPosition(gridPosition)}
            <ThreatValue value={ship.cost} iconSize={15} className="text-base" />
          </span>
        </div>
      </div>
    </div>
  );
};
