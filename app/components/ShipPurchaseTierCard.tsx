"use client";

import React from "react";
import { getRankColorVar } from "../utils/shipLevel";
import {
  BADGE_CHAMFER,
  BAY_SCANLINES,
  CARD_CHAMFER,
  ROW_CHAMFER,
  TAG_CHAMFER,
  bayBackground,
  rankFrameFill,
} from "../utils/cardFrame";

// Shared between ShipPurchaseInterface.tsx (web3), ShipPurchaseInterfaceWeb2.tsx
// and StoreWeb2.tsx (web2): one ship pack in the look of the ship cards (design
// pass G), as store design L lays it out. The top pack is the featured card,
// the others are rows of a price ladder, and checkout shows a compact summary.
// Callers supply pre-rendered preview images (`ShipImage` vs `ShipImageWeb2`,
// render-prop pattern per the number-native-shared-components rule); only the
// first is drawn. A card is wrapped in the caller's button (TIER_CARD_BUTTON_CLASS)
// and draws its buy button as a label, so there's no button inside a button.

export type ShipPurchaseTierCardLayout = "featured" | "row" | "summary";

interface ShipPurchaseTierCardProps {
  layout: ShipPurchaseTierCardLayout;
  /** The pack's tier index (0 = Entry Pack); tier N wears rank N+1's color. */
  tier: number;
  tierCallout: string;
  badge: string | null;
  /** The price, e.g. "$49.99". */
  priceLabel: string;
  shipsCount: number;
  /** Guaranteed ranks above R1, highest first (getGuaranteedVeteranRanks). */
  veteranRanks: number[];
  previewShipImages: React.ReactNode[];
}

/** The button a caller wraps a pack card in. */
export const TIER_CARD_BUTTON_CLASS =
  "group relative block h-full w-full text-left font-mono tracking-wider disabled:cursor-not-allowed disabled:opacity-50";

const HEADING_FONT = { fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" };

function Diamond({ color, size = 6 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rotate-45"
      style={{ width: size, height: size, background: color, boxShadow: `0 0 5px ${color}` }}
    />
  );
}

function RankChip({ rank, large = false }: { rank: number; large?: boolean }) {
  const color = getRankColorVar(rank);
  return (
    <span
      className={`inline-flex items-center gap-1.5 border border-solid font-bold tracking-[0.08em] ${
        large ? "px-1.5 py-0.5 text-[12px]" : "px-1.5 py-px text-[10px]"
      }`}
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
    >
      <Diamond color={color} />R{rank}
    </span>
  );
}

function RankChips({ ranks, large = false }: { ranks: number[]; large?: boolean }) {
  if (ranks.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {ranks.map((rank, i) => (
        <RankChip key={i} rank={rank} large={large} />
      ))}
    </span>
  );
}

/** A badge with cut corners: filled on the featured card, outlined on a row. */
function TierBadge({ text, color, filled }: { text: string; color: string; filled: boolean }) {
  return (
    <span className="inline-block p-px" style={{ background: color, clipPath: TAG_CHAMFER }}>
      <span
        className="block whitespace-nowrap py-0.5 pl-2 pr-2.5 text-[9px] font-bold tracking-[0.12em]"
        style={{
          clipPath: TAG_CHAMFER,
          background: filled ? color : "var(--color-near-black)",
          color: filled ? "var(--color-near-black)" : color,
        }}
      >
        {text}
      </span>
    </span>
  );
}

/** A label over a large value, as on the ship cards. */
function Plate({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="border-t-2 border-solid bg-white/[0.04] px-2 pb-1 pt-1" style={{ borderColor: color }}>
      <div className="text-[9px] tracking-[0.14em] text-text-muted">{label}</div>
      <div className="text-2xl font-bold leading-none text-text-primary" style={HEADING_FONT}>
        {value}
      </div>
    </div>
  );
}

/** The buy button's look. The whole card is the caller's button. */
function BuyLabel({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="block w-full py-2 text-center text-sm font-bold tracking-[0.06em] text-near-black transition-[filter] duration-150 group-hover:brightness-125 group-disabled:brightness-100"
      style={{ background: color, clipPath: BADGE_CHAMFER, ...HEADING_FONT }}
    >
      {text}
    </span>
  );
}

/** The art bay with the pack's lead preview ship. */
function ArtBay({
  image,
  glow,
  className,
  artClassName,
}: {
  image: React.ReactNode;
  glow: string;
  className: string;
  artClassName: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: bayBackground(glow) }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: BAY_SCANLINES }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`aspect-square h-full [&_img]:[image-rendering:pixelated] ${artClassName}`}
          style={{ filter: `drop-shadow(0 0 14px ${glow})` }}
        >
          {image}
        </div>
      </div>
    </div>
  );
}

function veteranLine(shipsCount: number, veterans: number): string {
  if (veterans === 0) return `${shipsCount} ships.`;
  if (veterans === 1) return `${shipsCount} ships, one of them a guaranteed veteran.`;
  return `${shipsCount} ships, ${veterans} of them guaranteed veterans.`;
}

export function ShipPurchaseTierCard({
  layout,
  tier,
  tierCallout,
  badge,
  priceLabel,
  shipsCount,
  veteranRanks,
  previewShipImages,
}: ShipPurchaseTierCardProps) {
  const color = getRankColorVar(tier + 1);
  const glow = `color-mix(in srgb, ${color} 26%, transparent)`;
  const leadImage = previewShipImages[0];
  const topRank = veteranRanks.length > 0 ? `R${Math.max(...veteranRanks)}` : "R1";
  const chamfer = layout === "featured" ? CARD_CHAMFER : ROW_CHAMFER;

  const plates = (
    <div className="grid grid-cols-3 gap-1.5">
      <Plate label="SHIPS" value={shipsCount} color={color} />
      <Plate label="VETERANS" value={veteranRanks.length} color={color} />
      <Plate label="TOP RANK" value={topRank} color={color} />
    </div>
  );

  const title = (size: string) => (
    <div className={`font-bold uppercase leading-none ${size}`} style={{ ...HEADING_FONT, color }}>
      {tierCallout}
    </div>
  );

  let content: React.ReactNode;
  if (layout === "featured") {
    content = (
      <div className="flex h-full flex-col">
        <div className="relative">
          {leadImage && (
            <ArtBay image={leadImage} glow={glow} className="h-64 sm:h-80 lg:h-[22rem]" artClassName="scale-[1.3]" />
          )}
          {badge && (
            <span className="absolute left-3.5 top-3.5 z-10">
              <TierBadge text={badge} color={color} filled />
            </span>
          )}
        </div>
        <div
          className={`relative px-4 pb-2 pt-3 sm:px-5 ${leadImage ? "-mt-9" : ""}`}
          style={{ background: "linear-gradient(180deg, transparent, var(--color-near-black) 2.25rem)" }}
        >
          <div className="[text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">{title("text-3xl sm:text-4xl")}</div>
          <div className="mt-1.5 text-xs text-text-secondary">{veteranLine(shipsCount, veteranRanks.length)}</div>
        </div>
        <div className="mt-auto flex flex-col gap-3.5 px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
          <RankChips ranks={veteranRanks} large />
          {plates}
          <BuyLabel text={`Buy for ${priceLabel}`} color={color} />
        </div>
      </div>
    );
  } else if (layout === "row") {
    content = (
      <div className="flex h-full min-h-24 items-stretch">
        {leadImage ? (
          <ArtBay image={leadImage} glow={glow} className="w-24 shrink-0 sm:w-36" artClassName="scale-[1.15]" />
        ) : (
          <div className="w-24 shrink-0 sm:w-36" />
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-3 py-3 sm:px-4">
          {title("text-lg sm:text-xl")}
          {(veteranRanks.length > 0 || badge) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <RankChips ranks={veteranRanks} />
              {badge && <TierBadge text={badge} color={color} filled={false} />}
            </div>
          )}
        </div>
        <div className="hidden w-24 shrink-0 flex-col justify-center gap-0.5 border-l border-solid border-gunmetal px-3 sm:flex">
          <span className="text-3xl font-bold leading-none text-text-primary" style={HEADING_FONT}>
            {shipsCount}
          </span>
          <span className="text-[9px] tracking-[0.12em] text-text-muted">SHIPS</span>
        </div>
        <div className="flex w-24 shrink-0 flex-col justify-center gap-1 pr-3 sm:w-36 sm:pr-4">
          <span className="text-center text-[10px] tracking-[0.12em] text-text-muted sm:hidden">
            {shipsCount} SHIPS
          </span>
          <BuyLabel text={priceLabel} color={color} />
        </div>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col">
        {leadImage && <ArtBay image={leadImage} glow={glow} className="h-40" artClassName="scale-[1.3]" />}
        <div className="flex flex-col gap-3 px-3.5 pb-3.5 pt-3">
          <div className="flex items-start justify-between gap-2">
            {title("text-2xl")}
            {badge && <TierBadge text={badge} color={color} filled={false} />}
          </div>
          <RankChips ranks={veteranRanks} />
          {plates}
          <div className="flex items-baseline justify-between text-[11px] tracking-[0.12em] text-text-muted">
            PRICE
            <span className="text-xl font-bold text-text-primary" style={HEADING_FONT}>
              {priceLabel}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full p-0.5 transition-[filter] duration-150 group-hover:brightness-110 group-disabled:brightness-100"
      style={{ background: rankFrameFill(color), clipPath: chamfer }}
    >
      <div className="h-full bg-near-black" style={{ clipPath: chamfer }}>
        {content}
      </div>
    </div>
  );
}
