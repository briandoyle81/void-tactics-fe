"use client";

import React from "react";
import { TurnCountdownBar, TurnCountdownText } from "./TurnCountdown";

// The phone-landscape battle rail's shared pieces, used by GameDisplay,
// GameDisplayWeb2 and SimulatedGameDisplay: a one-row header (Back, round,
// turn and score, with everything else behind a ⋯ menu), the icon tab row,
// and the ship-selected sheet (ship, its staged move, Submit pinned at the
// bottom). The rail is 12–18rem wide, so every row is built to fit 12rem.

const STYLE_LABEL: React.CSSProperties = {
  fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
};

export interface RailMenuItem {
  label: string;
  onClick: () => void;
  tone?: "default" | "warn" | "danger";
  disabled?: boolean;
}

const MENU_TONE_CLASS: Record<NonNullable<RailMenuItem["tone"]>, string> = {
  default: "text-text-primary",
  warn: "text-amber",
  danger: "text-warning-red",
};

/** A ⋯ button that opens a short menu under it. */
export function RailMenu({
  items,
  label,
  align = "right",
  compact = false,
}: {
  items: RailMenuItem[];
  label: string;
  align?: "left" | "right";
  /** 36px wide instead of 40, for the header row. */
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;
  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 ${compact ? "w-9" : "w-10"} items-center justify-center border border-gunmetal bg-steel text-text-secondary hover:text-cyan`}
        style={{ borderRadius: 0 }}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
          <circle cx="3.5" cy="9" r="1.6" />
          <circle cx="9" cy="9" r="1.6" />
          <circle cx="14.5" cy="9" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={`absolute top-[calc(100%+4px)] z-[280] flex min-w-[10rem] flex-col border border-gunmetal bg-near-black shadow-[0_8px_24px_rgba(0,0,0,0.6)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`flex min-h-11 items-center border-b border-gunmetal/60 px-3 text-left text-sm font-semibold uppercase tracking-wider last:border-b-0 hover:bg-steel disabled:cursor-not-allowed disabled:opacity-40 ${
                MENU_TONE_CLASS[item.tone ?? "default"]
              }`}
              style={STYLE_LABEL}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type RailTurnTone = "mine" | "theirs" | "over";

const TURN_COLOR: Record<RailTurnTone, string> = {
  mine: "var(--color-cyan)",
  theirs: "var(--color-warning-red)",
  over: "var(--color-phosphor-green)",
};

/**
 * One 44px row: Back, then the round and whose turn (with the clock when the
 * battle has one), the score, and a ⋯ menu for the rest (Sync, Reset, ...).
 */
export function LandscapeBattleHeader({
  onBack,
  round,
  turnLabel,
  turnTone,
  showClock = false,
  myScore,
  opponentScore,
  maxScore,
  menuItems,
}: {
  onBack?: () => void;
  round: number | bigint;
  turnLabel: string;
  turnTone: RailTurnTone;
  /** Needs a TurnCountdownProvider above it. */
  showClock?: boolean;
  myScore: number;
  opponentScore: number;
  maxScore: number;
  menuItems: RailMenuItem[];
}) {
  return (
    <div className="mb-1.5 shrink-0 border border-gunmetal bg-near-black">
      <div className="flex h-11 items-center gap-1 px-0.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-10 w-9 shrink-0 items-center justify-center border border-gunmetal bg-steel text-text-secondary hover:text-cyan"
            style={{ borderRadius: 0 }}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 3 L5 8 L10 13" />
            </svg>
          </button>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center px-0.5">
          <p
            className="truncate text-[11px] font-semibold uppercase leading-tight tracking-wide"
            style={{ ...STYLE_LABEL, color: TURN_COLOR[turnTone] }}
          >
            R{round.toString()} · {turnLabel}
            {showClock && turnTone !== "over" && (
              <>
                {" · "}
                <TurnCountdownText />
              </>
            )}
          </p>
          <p className="truncate font-mono text-xs leading-tight" aria-label={`Score ${myScore} to ${opponentScore}, ${maxScore} to win`}>
            <span className="text-cyan">{myScore}</span>
            <span className="text-text-muted"> – </span>
            <span className="text-warning-red">{opponentScore}</span>
            <span className="text-text-muted"> /{maxScore}</span>
          </p>
        </div>
        <RailMenu items={menuItems} label="Battle options" compact />
      </div>
      {showClock && turnTone !== "over" && (
        <div className="h-0.5 w-full overflow-hidden bg-gunmetal">
          <TurnCountdownBar />
        </div>
      )}
    </div>
  );
}

export type RailTabId = "tutorial" | "status" | "actions" | "events" | "fleets";

const TAB_LABELS: Record<RailTabId, string> = {
  tutorial: "Briefing",
  status: "Status",
  actions: "Actions",
  events: "Events",
  fleets: "Fleets",
};

const TAB_ICON_PATHS: Record<RailTabId, string> = {
  tutorial: "M5 3 h10 l4 4 v14 H5 Z M8 10 h8 M8 14 h8 M8 18 h5",
  status: "M4 20 V12 M10 20 V6 M16 20 V9 M22 20 H2",
  actions: "M12 3 v4 M12 17 v4 M3 12 h4 M17 12 h4 M12 8 a4 4 0 1 0 0 8 a4 4 0 1 0 0 -8 Z",
  events: "M4 6 h16 M4 12 h16 M4 18 h10",
  fleets: "M3 15 L9 7 L15 15 L9 13 Z M11 19 L16 12 L21 19 L16 17 Z",
};

/**
 * The rail's tabs as one row of icons (labels for screen readers and on
 * hover), so five fit in 12rem without wrapping. `fleets` is an action (it
 * opens the fleet sheet), drawn in green.
 */
export function LandscapeRailTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: RailTabId[];
  active: RailTabId | null;
  onSelect: (tab: RailTabId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Battle panels"
      className="mb-1.5 grid shrink-0 gap-1"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const isActive = tab === active;
        const isFleets = tab === "fleets";
        return (
          <button
            key={tab}
            type="button"
            role={isFleets ? undefined : "tab"}
            aria-selected={isFleets ? undefined : isActive}
            aria-label={TAB_LABELS[tab]}
            title={TAB_LABELS[tab]}
            onClick={() => onSelect(tab)}
            className={`flex h-11 items-center justify-center border ${
              isActive
                ? "border-cyan bg-cyan/[0.12] text-cyan"
                : isFleets
                  ? "border-gunmetal bg-steel text-phosphor-green"
                  : "border-gunmetal bg-steel text-text-secondary"
            }`}
            style={{ borderRadius: 0 }}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d={TAB_ICON_PATHS[tab]} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function hullColor(percent: number): string {
  if (percent < 35) return "var(--color-warning-red)";
  if (percent < 70) return "var(--color-amber)";
  return "var(--color-phosphor-green)";
}

/**
 * The ship-selected sheet over the rail: the ship (thumbnail, name, hull)
 * with its ⋯ menu (Retreat) and Close at the top, the staged move and the
 * ship's details scrolling in the middle, and the footer (Cancel / Submit)
 * pinned at the bottom so it's always on screen.
 */
export function LandscapeShipSheet({
  above,
  shipImage,
  shipName,
  hullPercent,
  menuItems,
  onClose,
  wrapClose,
  footer,
  children,
}: {
  /** A line above the ship (the tutorial step). */
  above?: React.ReactNode;
  shipImage: React.ReactNode;
  shipName: string;
  /** 0–100; omitted while unknown. */
  hullPercent?: number;
  menuItems: RailMenuItem[];
  onClose: () => void;
  /** Wraps the Close button, e.g. in a TutorialTarget. */
  wrapClose?: (button: React.ReactElement) => React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close ship panel"
      className="flex h-10 w-10 shrink-0 items-center justify-center border border-gunmetal bg-steel text-lg leading-none text-text-secondary hover:text-text-primary"
      style={{ borderRadius: 0 }}
    >
      ×
    </button>
  );
  return (
    <div
      className="absolute inset-0 z-[260] flex flex-col bg-near-black"
    >
      {above}
      <div className="flex shrink-0 items-center gap-2 border-b border-gunmetal pb-1.5">
        <div className="h-11 w-11 shrink-0 overflow-hidden border border-steel bg-black/40">{shipImage}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-bold uppercase leading-tight tracking-wider text-text-primary" style={STYLE_LABEL}>
            {shipName}
          </span>
          {hullPercent != null && (
            <div
              className="h-1 w-full bg-steel"
              role="meter"
              aria-label="Hull"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(hullPercent)}
            >
              <div className="h-full" style={{ width: `${hullPercent}%`, backgroundColor: hullColor(hullPercent) }} />
            </div>
          )}
        </div>
        <RailMenu items={menuItems} label="Ship options" />
        {wrapClose ? wrapClose(closeButton) : closeButton}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5">{children}</div>
      {footer != null && <div className="shrink-0 border-t border-gunmetal pt-1.5">{footer}</div>}
    </div>
  );
}

export interface StagedMoveTarget {
  /** Stringified ship id, so web3 (bigint) and web2 (number) share this. */
  id: string;
  name: string;
}

/**
 * The ship sheet's staged move: where the ship goes (or that it holds, or
 * retreats), then the targets for the weapon chosen on the board. Shared
 * by the three battle views, which adapt their own ids to strings.
 */
export function LandscapeStagedMove({
  from,
  to,
  retreating = false,
  weaponLabel,
  targets,
  selectedTargetId,
  repair = false,
  onSelectTarget,
  wrapTarget,
}: {
  from: { row: number; col: number };
  to: { row: number; col: number };
  retreating?: boolean;
  weaponLabel: string;
  targets: StagedMoveTarget[];
  selectedTargetId: string | null;
  /** The weapon repairs (cyan) rather than damages (red). */
  repair?: boolean;
  onSelectTarget: (id: string) => void;
  /** Wraps a target button, e.g. in a TutorialTarget. */
  wrapTarget?: (id: string, button: React.ReactElement) => React.ReactNode;
}) {
  const accent = repair ? "var(--color-cyan)" : "var(--color-warning-red)";
  const holds = from.row === to.row && from.col === to.col;
  return (
    <div className="flex flex-col gap-2 border border-gunmetal bg-near-black p-2">
      <p className="font-mono text-xs text-text-secondary">
        <span className="uppercase tracking-wide text-text-muted">Move · </span>
        {retreating ? "Retreat off the map" : holds ? "Hold position" : `To (${to.row}, ${to.col})`}
      </p>
      {!retreating && targets.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[11px] uppercase tracking-wide text-text-secondary">
            Target · {weaponLabel}
          </p>
          {targets.map((target) => {
            const isSelected = target.id === selectedTargetId;
            const button = (
              <button
                type="button"
                onClick={() => onSelectTarget(target.id)}
                aria-pressed={isSelected}
                className="flex min-h-10 w-full items-center border-2 px-2 text-left text-sm font-semibold uppercase tracking-wide"
                style={{
                  ...STYLE_LABEL,
                  color: accent,
                  borderColor: isSelected ? accent : "var(--color-gunmetal)",
                  backgroundColor: isSelected ? "var(--color-steel)" : "var(--color-slate)",
                  borderRadius: 0,
                }}
              >
                <span className="truncate">{target.name}</span>
              </button>
            );
            return (
              <React.Fragment key={target.id}>
                {wrapTarget ? wrapTarget(target.id, button) : button}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
