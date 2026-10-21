"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  FULLSCREEN_CHANGE_EVENTS,
  enterFullscreen,
  fullscreenSupported,
  isFullscreen,
  isStandaloneDisplay,
} from "../utils/fullscreen";

const STYLE_LABEL: CSSProperties = {
  fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
};

// "Not now" lasts for the browser session (this tab).
const DISMISSED_KEY = "void-tactics-fullscreen-prompt-dismissed";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * "Go fullscreen" over the landscape battle view on a phone, the companion
 * of RotateToLandscapePrompt: the browser's bars take a big share of a
 * phone held sideways. Shown by every battle view (GameDisplay,
 * GameDisplayWeb2, SimulatedGameDisplay) in its landscape layout. Hidden
 * where the page can't go fullscreen (iPhone Safari), when it already is
 * (or runs as an installed app), and after "Not now" for this session. It
 * comes back if the player leaves fullscreen without choosing "Not now".
 * Above the battle's own overlays (round report, comms: up to z-[610]), so
 * it's the first thing answered.
 */
export function FullscreenPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!fullscreenSupported() || isStandaloneDisplay()) return;
    const update = () => setVisible(!isFullscreen() && !readDismissed());
    update();
    FULLSCREEN_CHANGE_EVENTS.forEach((e) => document.addEventListener(e, update));
    return () => FULLSCREEN_CHANGE_EVENTS.forEach((e) => document.removeEventListener(e, update));
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage blocked: it just hides until the next battle.
    }
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fullscreen-prompt-title"
      className="fixed inset-0 z-[700] flex items-center justify-center bg-near-black/95 px-6"
      style={{
        paddingLeft: "max(1.5rem, env(safe-area-inset-left))",
        paddingRight: "max(1.5rem, env(safe-area-inset-right))",
      }}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div
          aria-hidden="true"
          className="relative"
          style={{ width: "5.1rem", height: "3rem", border: "3px solid var(--color-cyan)", borderRadius: "6px" }}
        >
          {/* Corner marks: the "expand" sign. */}
          {[
            "left-1 top-1 border-l-2 border-t-2",
            "right-1 top-1 border-r-2 border-t-2",
            "bottom-1 left-1 border-b-2 border-l-2",
            "bottom-1 right-1 border-b-2 border-r-2",
          ].map((c) => (
            <span key={c} className={`absolute h-2.5 w-2.5 border-cyan ${c}`} />
          ))}
        </div>
        <h2
          id="fullscreen-prompt-title"
          className="text-[28px] font-bold uppercase leading-none tracking-wider text-cyan"
          style={STYLE_LABEL}
        >
          Go fullscreen
        </h2>
        <p className="max-w-[22rem] text-sm leading-relaxed text-text-secondary">
          The browser&apos;s bars take up a lot of a phone held sideways. Hide
          them to give the battle board the whole screen.
        </p>
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="h-12 flex-1 border border-gunmetal bg-steel text-[15px] font-bold uppercase tracking-[0.1em] text-text-primary transition-colors hover:border-cyan hover:text-cyan"
            style={{ ...STYLE_LABEL, borderRadius: 0 }}
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void enterFullscreen()}
            className="h-12 flex-[2] border border-cyan bg-cyan/15 text-[15px] font-bold uppercase tracking-[0.1em] text-cyan transition-colors hover:bg-cyan/25"
            style={{ ...STYLE_LABEL, borderRadius: 0 }}
          >
            Go fullscreen
          </button>
        </div>
      </div>
    </div>
  );
}
