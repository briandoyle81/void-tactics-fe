"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { isClientPathname } from "../utils/hostRouting";

/** Matches Tailwind `md` (768px): show only below that width. */
const MOBILE_MAX_WIDTH_QUERY = "(max-width: 767px)";

const SESSION_DISMISS_KEY = "void-tactics-mobile-alpha-notice-dismissed";

/**
 * The notice is about the game client, so it only opens there, not over the
 * website: everywhere on the play host (NEXT_PUBLIC_PLAY_URL, which serves
 * the client at "/"), and on client paths (/play, /<gameId>, ...) elsewhere.
 */
function isInGameClient(pathname: string | null): boolean {
  const playUrl = process.env.NEXT_PUBLIC_PLAY_URL;
  if (playUrl) {
    try {
      if (window.location.host === new URL(playUrl).host) return true;
    } catch {
      // malformed URL: fall back to the path
    }
  }
  return pathname != null && isClientPathname(pathname);
}

function isDismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissedThisSession() {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
  } catch {
    /* private mode */
  }
}

export default function MobileAlphaNoticeModal() {
  const titleId = useId();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const syncVisibility = useCallback(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(MOBILE_MAX_WIDTH_QUERY);
    setVisible(mq.matches && isInGameClient(pathname) && !isDismissedThisSession());
  }, [pathname]);

  useEffect(() => {
    syncVisibility();
    const mq = window.matchMedia(MOBILE_MAX_WIDTH_QUERY);
    const onChange = () => syncVisibility();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, [syncVisibility]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDismissedThisSession();
        setVisible(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  const dismiss = useCallback(() => {
    setDismissedThisSession();
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(12, 17, 23, 0.85)" }}
      role="presentation"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md border-2 border-solid p-5"
        style={{
          backgroundColor: "var(--color-slate)",
          borderColor: "var(--color-cyan)",
          borderTopColor: "var(--color-steel)",
          borderLeftColor: "var(--color-steel)",
          borderRadius: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="mb-3 text-lg font-bold uppercase tracking-wider text-cyan"
          style={{
            fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
          }}
        >
          Mobile client in development
        </h2>
        <p
          className="mb-3 text-sm leading-relaxed"
          style={{
            fontFamily:
              "var(--font-jetbrains-mono), 'Courier New', monospace",
            color: "var(--color-text-secondary)",
          }}
        >
          Our mobile client is currently under development. For the best
          experience right now, we recommend playing on desktop.
        </p>
        <p
          className="mb-4 border border-solid px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider"
          style={{
            fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
            color: "var(--color-amber)",
            borderColor: "var(--color-amber)",
            backgroundColor: "var(--color-near-black)",
            borderRadius: 0,
          }}
        >
          Please give us feedback on Discord
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="w-full border-2 border-solid px-4 py-3 font-mono font-bold uppercase tracking-wider transition-colors"
          style={{
            borderColor: "var(--color-cyan)",
            color: "var(--color-cyan)",
            backgroundColor: "var(--color-near-black)",
            borderRadius: 0,
            fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
          }}
        >
          [Got it]
        </button>
      </div>
    </div>
  );
}
