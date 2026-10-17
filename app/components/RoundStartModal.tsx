"use client";

import React from "react";
import { usePressStartedHere } from "../hooks/usePressStartedHere";
import { STYLE_LABEL, STYLE_MONO } from "../styles/fontStyles";
import type { DialogCharacterId } from "../data/dialog/characters";
import {
  CrewReportLetterhead,
  CrewReportSignature,
  DEFAULT_REPORTER,
  useCrewReporter,
  useReportArrivalSound,
} from "./CrewReport";

interface RoundStartModalProps {
  round: number | bigint;
  /** True when the local player acts first this round. */
  isMyTurnFirst: boolean;
  onClose: () => void;
  /** Points each side gained during the round that just ended (not
   * cumulative totals) — omitted on the very first showing (game start),
   * where there's no prior round to diff against. */
  myRoundScore?: number;
  opponentRoundScore?: number;
  /** Cumulative totals as of right now (game start or after the round that
   * just ended), shown alongside the round deltas. */
  myScore?: number;
  opponentScore?: number;
  /** Cumulative target needed to win. */
  maxScore?: number;
  /** Who files the report (a dialog character). Defaults to the adjutant. */
  reporterId?: DialogCharacterId;
  /** The reporter's own words, above the signature (e.g. the tutorial's
   * end-of-round briefing). */
  note?: React.ReactNode;
}

// Shared between GameDisplay.tsx, GameDisplayWeb2.tsx and
// SimulatedGameDisplay.tsx (tutorial) — announces a new round, who acts first
// and the score, as a report filed by a crew member (`reporterId`, any
// dialog character; the adjutant by default). It reads as a document, not a
// comms line, and the round/first player/score stay the headline. Stays up
// until the player acknowledges it, so it can't be missed. Animates in and
// out (round-start-* classes in globals.css); the exit plays before onClose
// unmounts it. Same z-index and backdrop as GameResultModal.tsx.
/** Length of the exit animation (round-start-out in globals.css). */
const EXIT_MS = 200;

export function RoundStartModal({
  round,
  isMyTurnFirst,
  onClose,
  myRoundScore,
  opponentRoundScore,
  myScore,
  opponentScore,
  maxScore,
  reporterId = DEFAULT_REPORTER,
  note,
}: RoundStartModalProps) {
  const hasRoundScore = myRoundScore != null && opponentRoundScore != null;
  const hasCurrentScore = myScore != null && opponentScore != null;
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const [isClosing, setIsClosing] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play the exit, then close. Reduced motion skips the wait.
  const close = React.useCallback(() => {
    if (closeTimerRef.current) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      onCloseRef.current();
      return;
    }
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => onCloseRef.current(), EXIT_MS);
  }, []);

  React.useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  // Only a press that starts on OK closes it (see usePressStartedHere).
  const pressProps = usePressStartedHere();

  const accentColor = isMyTurnFirst
    ? "var(--color-cyan)"
    : "var(--color-warning-red)";
  const reporter = useCrewReporter(reporterId);
  useReportArrivalSound();

  return (
    <div
      className={`round-start-backdrop fixed inset-0 z-[500] flex items-center justify-center bg-black/90 p-4 [@media(max-height:500px)]:p-2 ${
        // Ignore input while fading out so the board is clickable right away.
        isClosing ? "round-start-closing pointer-events-none" : ""
      }`}
      role="presentation"
    >
      <div
        // Capped to the screen (a phone in landscape is ~340px tall): the body
        // scrolls, and Acknowledged stays pinned at the bottom so it can
        // always be reached. Short screens also get a tighter layout.
        className="round-start-card relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden border-2 bg-near-black font-mono [@media(max-height:500px)]:max-h-[calc(100dvh-1rem)] [@media(max-height:500px)]:max-w-xl"
        style={{ borderColor: accentColor, borderRadius: 0 }}
        role="dialog"
        aria-label={`Round ${round.toString()} report`}
      >
        <div
          className="round-start-sweep absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: accentColor }}
          aria-hidden
        />

        <CrewReportLetterhead
          title="Round report"
          subtitle={`No. ${round.toString().padStart(2, "0")}`}
          reporter={reporter}
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 text-center [@media(max-height:500px)]:px-4 [@media(max-height:500px)]:pt-3">
          <div
            className="text-4xl font-bold uppercase tracking-widest text-text-primary [@media(max-height:500px)]:text-2xl"
            style={STYLE_LABEL}
          >
            Round {round.toString()}
          </div>
          <div
            className="mt-1 text-2xl font-bold uppercase tracking-widest [@media(max-height:500px)]:text-lg"
            style={{ ...STYLE_LABEL, color: accentColor }}
          >
            {isMyTurnFirst ? "You go first" : "Opponent goes first"}
          </div>

          {(hasRoundScore || hasCurrentScore) && (
            <table className="mt-5 w-full border-collapse text-left text-xs [@media(max-height:500px)]:mt-2" style={STYLE_MONO}>
              <thead>
                <tr
                  className="border-b border-solid text-[10px] uppercase tracking-widest text-text-muted"
                  style={{ borderColor: "var(--color-gunmetal)" }}
                >
                  <th className="py-1 font-normal" />
                  <th className="py-1 text-right font-normal">You</th>
                  <th className="py-1 text-right font-normal">Enemy</th>
                </tr>
              </thead>
              <tbody>
                {hasRoundScore && (
                  <tr className="border-b border-dashed" style={{ borderColor: "var(--color-gunmetal)" }}>
                    <td className="py-2 uppercase tracking-wider text-text-muted">Last round</td>
                    <td className="py-2 text-right text-xl font-bold tabular-nums" style={{ color: "var(--color-cyan)" }}>
                      +{myRoundScore}
                    </td>
                    <td className="py-2 text-right text-xl font-bold tabular-nums" style={{ color: "var(--color-warning-red)" }}>
                      +{opponentRoundScore}
                    </td>
                  </tr>
                )}
                {hasCurrentScore && (
                  <tr>
                    <td className="py-2 uppercase tracking-wider text-text-muted">
                      Score
                      {maxScore != null && (
                        <span className="block text-[10px] normal-case tracking-normal">
                          {maxScore} to win
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right text-3xl font-bold tabular-nums" style={{ color: "var(--color-cyan)" }}>
                      {myScore}
                    </td>
                    <td className="py-2 text-right text-3xl font-bold tabular-nums" style={{ color: "var(--color-warning-red)" }}>
                      {opponentScore}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {note && (
            <div
              className="mt-5 space-y-2 border-l-2 pl-3 text-left text-sm leading-relaxed text-text-primary [@media(max-height:500px)]:mt-3"
              style={{ ...STYLE_MONO, borderColor: reporter.color }}
            >
              {note}
            </div>
          )}

          <div className="mt-4 pb-1 [@media(max-height:500px)]:mt-2">
            <CrewReportSignature reporter={reporter} />
          </div>
        </div>

        <div className="shrink-0 px-6 pb-6 pt-4 [@media(max-height:500px)]:px-4 [@media(max-height:500px)]:pb-3 [@media(max-height:500px)]:pt-2">
          <button
            type="button"
            {...pressProps(close)}
            className="w-full border-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors hover:bg-white/5"
            style={{ ...STYLE_LABEL, borderColor: accentColor, color: accentColor, borderRadius: 0 }}
          >
            Acknowledged
          </button>
        </div>
      </div>
    </div>
  );
}
