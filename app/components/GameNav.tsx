"use client";

import { useEffect, useRef } from "react";

// Primary navigation for the game client: shoulder tabs under the HUD on
// desktop (Q/E cycle them, like a controller's shoulder buttons) and a
// bottom tab bar on phones.

export type GameSection = "Play" | "Fleet" | "Store" | "Battles" | "Profile";

export const GAME_SECTIONS: readonly GameSection[] = ["Play", "Fleet", "Store", "Battles", "Profile"];

// Drawn on one 24px grid and stroke so they match on every phone (text
// glyphs fell back to whatever font the device had, and ⚔ could render as
// an emoji).
const SECTION_ICON_PATHS: Record<GameSection, string> = {
  Play: "M12 3 L21 12 L12 21 L3 12 Z M10 9 L15 12 L10 15 Z",
  Fleet: "M3 16 L12 5 L21 16 L12 13 Z M8 19 h8",
  Store: "M4 8 L12 4 L20 8 V16 L12 20 L4 16 Z M4 8 L12 12 L20 8 M12 12 V20",
  Battles: "M5 5 L19 19 M19 5 L5 19 M5 15 v4 h4 M19 15 v4 h-4",
  Profile: "M12 12 a4 4 0 1 0 0 -8 a4 4 0 1 0 0 8 Z M4 21 c1.5 -4 4.5 -6 8 -6 s6.5 2 8 6",
};

function SectionIcon({ section }: { section: GameSection }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={SECTION_ICON_PATHS[section]} />
    </svg>
  );
}

const DISPLAY_FONT = { fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" } as const;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function GameNav({
  active,
  onSelect,
  battlesAlert,
}: {
  active: GameSection;
  onSelect: (section: GameSection) => void;
  /** Shows a dot on Battles (it's your turn in a PvP game). */
  battlesAlert: boolean;
}) {
  // Publishes the phone bar's height (0 while hidden, md and up) as
  // --vt-bottom-nav-h, for content pinned above it (the run map's action).
  const bottomNavRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = bottomNavRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => {
      root.style.setProperty("--vt-bottom-nav-h", `${nav.offsetHeight}px`);
    });
    ro.observe(nav);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--vt-bottom-nav-h");
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      // A modal is open (checkout, confirmations, editors): switching the
      // section behind it would unmount the screen it belongs to.
      if (document.querySelector('[aria-modal="true"], [role="alertdialog"]')) return;
      const key = event.key.toLowerCase();
      if (key !== "q" && key !== "e") return;
      const index = GAME_SECTIONS.indexOf(active);
      const step = key === "e" ? 1 : -1;
      onSelect(GAME_SECTIONS[(index + step + GAME_SECTIONS.length) % GAME_SECTIONS.length]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onSelect]);

  return (
    <>
      <nav
        aria-label="Game sections"
        className="hidden items-stretch justify-center gap-1 border-b px-4 py-2 md:flex"
        style={{ borderColor: "var(--color-gunmetal)", backgroundColor: "var(--color-near-black)" }}
      >
        <kbd className="self-center border px-1.5 font-mono text-[11px] text-text-muted" style={{ borderColor: "var(--color-gunmetal)" }} title="Previous section">
          Q
        </kbd>
        {GAME_SECTIONS.map((section) => {
          const isActive = section === active;
          return (
            <button
              key={section}
              type="button"
              onClick={() => onSelect(section)}
              aria-current={isActive ? "page" : undefined}
              className={`relative border-b-2 px-6 py-1.5 text-lg font-bold uppercase tracking-[0.12em] transition-colors duration-150 ${
                isActive ? "border-cyan text-cyan" : "border-transparent text-text-secondary hover:text-cyan"
              }`}
              style={DISPLAY_FONT}
            >
              {section}
              {section === "Battles" && battlesAlert && (
                <span className="absolute right-2 top-1.5 h-2 w-2 bg-phosphor-green" aria-label="Your turn" />
              )}
            </button>
          );
        })}
        <kbd className="self-center border px-1.5 font-mono text-[11px] text-text-muted" style={{ borderColor: "var(--color-gunmetal)" }} title="Next section">
          E
        </kbd>
      </nav>

      <nav
        ref={bottomNavRef}
        aria-label="Game sections"
        className="fixed inset-x-0 bottom-0 z-[250] grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:hidden"
        style={{ borderColor: "var(--color-gunmetal)", backgroundColor: "var(--color-slate)" }}
      >
        {GAME_SECTIONS.map((section) => {
          const isActive = section === active;
          return (
            <button
              key={section}
              type="button"
              onClick={() => onSelect(section)}
              aria-current={isActive ? "page" : undefined}
              className={`relative grid justify-items-center gap-1 border-t-2 pb-2.5 pt-2 text-[11px] uppercase tracking-wider ${
                isActive ? "border-cyan text-cyan" : "border-transparent text-text-muted"
              }`}
              style={DISPLAY_FONT}
            >
              <SectionIcon section={section} />
              {section}
              {section === "Battles" && battlesAlert && (
                <span className="absolute right-[30%] top-1.5 h-2 w-2 bg-phosphor-green" aria-label="Your turn" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
