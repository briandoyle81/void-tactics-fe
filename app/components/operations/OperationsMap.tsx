"use client";

import { useEffect, useState, type ReactNode } from "react";

// The Operations run map: the star chart on the left, the selected
// mission's drawer as a permanent column on the right (a third of the
// width; the chart is never drawn behind it), and the action bar along the
// bottom with the primary action at the right. On phones the mission is a
// one-tap bar under the chart (title, kind, the briefing's opening line) that
// expands into a sheet over the chart, so the route stays visible until the
// player asks to read. Shared by RoguelikeGraph (web3) and RoguelikeGraphWeb2.

export interface MissionPeek {
  title: string;
  kindLabel: string;
  /** The briefing text; the bar shows its opening line. */
  teaser?: string;
}

const DISPLAY_FONT = { fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" } as const;

export function OperationsMap({
  toolbar,
  banner,
  canvas,
  drawer,
  peek,
  actionBar,
}: {
  /** Controls at the top right (retreat, edit mode, ...); null for none. */
  toolbar: ReactNode | null;
  /** A notice under the toolbar, e.g. connect-mode instructions. */
  banner?: ReactNode;
  canvas: ReactNode;
  /** Drawer content; null when nothing is selected (or in Edit Mode): the chart takes the full width. */
  drawer: ReactNode | null;
  /** The phone bar for the selected mission; without it phones get the desktop toggle. */
  peek?: MissionPeek | null;
  actionBar?: ReactNode;
}) {
  // Phones only (below md): whether the peek bar is expanded into the sheet.
  // Starts collapsed for every newly selected mission.
  const [phoneExpanded, setPhoneExpanded] = useState(false);
  const peekKey = peek ? `${peek.title}|${peek.kindLabel}` : null;
  const [lastPeekKey, setLastPeekKey] = useState(peekKey);
  if (peekKey !== lastPeekKey) {
    setLastPeekKey(peekKey);
    setPhoneExpanded(false);
  }
  const hasPeek = peek != null && drawer != null;
  const showPhoneSheet = hasPeek && phoneExpanded;

  // Escape closes the phone sheet (the desktop column stays).
  useEffect(() => {
    if (!showPhoneSheet) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setPhoneExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPhoneSheet]);

  // Phones with a peek bar show the drawer only while it's expanded.
  const phoneVisibility = hasPeek && !showPhoneSheet ? "max-md:hidden" : "";

  return (
    <div className="flex flex-col border-2 border-solid" style={{ borderColor: "var(--color-steel)" }}>
      {toolbar != null && (
        <div
          className="flex flex-wrap items-center justify-end gap-2 border-b px-3 py-2"
          style={{ borderColor: "var(--color-gunmetal)", backgroundColor: "var(--color-near-black)" }}
        >
          {toolbar}
        </div>
      )}
      {banner}

      <div className="relative flex overflow-hidden">
        <div className="min-w-0 flex-1">{canvas}</div>

        {drawer != null && (
          // Desktop: a column beside the chart, its height the chart's,
          // scrolling on its own. Phones: a sheet over the chart.
          <aside
            aria-label="Mission"
            className={`absolute inset-x-0 bottom-0 z-20 overflow-y-auto border-t-2 bg-near-black md:relative md:inset-auto md:z-auto md:w-[33.4%] md:shrink-0 md:overflow-visible md:border-l md:border-t-0 ${
              hasPeek ? "max-md:top-0" : "max-h-[75%] md:max-h-none"
            } ${phoneVisibility}`}
            style={{ borderColor: "var(--color-cyan)" }}
          >
            {hasPeek && (
              <button
                type="button"
                onClick={() => setPhoneExpanded(false)}
                aria-label="Close mission panel"
                className="absolute right-1 top-1 z-10 flex h-10 w-10 items-center justify-center text-xl leading-none text-text-muted hover:text-text-primary md:hidden"
              >
                ×
              </button>
            )}
            <div className="h-full md:absolute md:inset-0 md:overflow-y-auto">{drawer}</div>
          </aside>
        )}
      </div>

      {/* Phones: the mission bar and the action are pinned together above
          the bottom nav (GameNav sets --vt-bottom-nav-h, safe area included;
          0 when it isn't shown), so the main action stays on screen while
          the page scrolls. */}
      {(hasPeek || actionBar != null) && (
        <div className="sticky bottom-[var(--vt-bottom-nav-h,0px)] z-30 md:static">
          {hasPeek && (
            <button
              type="button"
              onClick={() => setPhoneExpanded((v) => !v)}
              aria-expanded={showPhoneSheet}
              className="flex w-full items-center gap-3 border-t-2 border-cyan bg-near-black px-3.5 py-2.5 text-left md:hidden"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-lg font-bold uppercase leading-tight tracking-wider text-cyan" style={DISPLAY_FONT}>
                    {peek.title}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-secondary">{peek.kindLabel}</span>
                </span>
                {peek.teaser && !showPhoneSheet && (
                  <span className="truncate font-mono text-xs text-text-secondary">{peek.teaser}</span>
                )}
              </span>
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-cyan">
                {showPhoneSheet ? "Close ▼" : "Read briefing ▲"}
              </span>
            </button>
          )}
          {actionBar}
        </div>
      )}
    </div>
  );
}
