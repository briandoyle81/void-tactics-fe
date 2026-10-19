"use client";

import { useEffect, useId } from "react";
import {
  closeAlphaNotice,
  openAlphaNoticeIfFirstVisit,
  useAlphaNoticeOpen,
} from "../utils/alphaNotice";

const HEADING_FONT = "var(--font-rajdhani), 'Arial Black', sans-serif";
const MONO_FONT = "var(--font-jetbrains-mono), 'Courier New', monospace";

const NOTICE_LINES = [
  "It's undergoing active development and could be wiped at any time.",
  "What you see is not representative of the final product.",
];

/**
 * "Void Tactics is in Alpha". Opens by itself on a visitor's first visit
 * (website or game client) and again from any [ALPHA] badge
 * (HeaderAlphaBadge).
 */
export default function AlphaNoticeModal() {
  const titleId = useId();
  const open = useAlphaNoticeOpen();

  useEffect(() => {
    openAlphaNoticeIfFirstVisit();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAlphaNotice();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[610] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(8, 11, 16, 0.82)", backdropFilter: "blur(3px)" }}
      role="presentation"
      onClick={closeAlphaNotice}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto border border-solid"
        style={{
          backgroundColor: "var(--color-slate)",
          borderColor: "rgba(245, 158, 11, 0.55)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(245, 158, 11, 0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full" style={{ backgroundColor: "var(--color-amber)" }} />
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span
              className="border border-solid px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]"
              style={{
                fontFamily: MONO_FONT,
                color: "var(--color-amber)",
                borderColor: "rgba(245, 158, 11, 0.75)",
                backgroundColor: "var(--color-near-black)",
              }}
            >
              [ALPHA]
            </span>
            <button
              type="button"
              onClick={closeAlphaNotice}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center text-lg text-text-muted transition-colors hover:text-text-primary"
            >
              ×
            </button>
          </div>

          <h2
            id={titleId}
            className="mb-4 text-2xl font-black uppercase leading-tight tracking-[0.04em] text-text-primary sm:text-3xl"
            style={{ fontFamily: HEADING_FONT }}
          >
            Void Tactics is in <span style={{ color: "var(--color-amber)" }}>Alpha</span>
          </h2>

          <ul className="mb-6 space-y-3">
            {NOTICE_LINES.map((line) => (
              <li
                key={line}
                className="flex gap-3 text-sm leading-relaxed text-text-secondary"
                style={{ fontFamily: MONO_FONT }}
              >
                <span
                  aria-hidden
                  className="mt-[0.45rem] h-1.5 w-1.5 shrink-0"
                  style={{ backgroundColor: "var(--color-amber)" }}
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={closeAlphaNotice}
            className="w-full border border-solid px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] transition-colors hover:bg-amber/10"
            style={{
              fontFamily: HEADING_FONT,
              color: "var(--color-amber)",
              borderColor: "var(--color-amber)",
              backgroundColor: "var(--color-near-black)",
            }}
          >
            [Understood]
          </button>
        </div>
      </div>
    </div>
  );
}
