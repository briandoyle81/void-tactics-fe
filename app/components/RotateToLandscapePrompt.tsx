"use client";

import type { CSSProperties } from "react";
import { TurnCountdownProvider, TurnCountdownText } from "./TurnCountdown";

const STYLE_LABEL: CSSProperties = {
  fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
};

export type RotatePromptTurnTone = "mine" | "theirs" | "over";

const TURN_COLORS: Record<RotatePromptTurnTone, string> = {
  mine: "var(--color-phosphor-green)",
  theirs: "var(--color-warning-red)",
  over: "var(--color-cyan)",
};

/**
 * Whose turn, or the result once the battle is over. `short` for the
 * landscape rail's header, which has about 100px for it.
 */
export function rotatePromptTurnLabel(
  winner: "me" | "opponent" | "tie" | null | undefined,
  isMyTurn: boolean,
  short = false,
): string {
  if (winner === "tie") return "Tie";
  if (winner === "me") return "Victory";
  if (winner === "opponent") return "Defeat";
  if (isMyTurn) return "Your turn";
  return short ? "Their turn" : "Opponent's turn";
}

/**
 * Full-screen "turn your phone sideways" prompt, shown by every battle view
 * (GameDisplay, GameDisplayWeb2, SimulatedGameDisplay) on a phone held
 * upright. The card at the top keeps the battle's state in view (whose turn,
 * and the turn clock, which keeps running), and Back sits at thumb height.
 */
export function RotateToLandscapePrompt({
  title,
  round,
  turnLabel,
  turnTone,
  clock,
  onBack,
}: {
  /** Mission or opponent, e.g. the mission title. */
  title?: string;
  round?: number | bigint;
  turnLabel?: string;
  turnTone?: RotatePromptTurnTone;
  /** Turn clock; omitted when the battle has none (vs AI, tutorial). */
  clock?: { turnTimeSec: number; turnStartTimeMs: number };
  onBack?: () => void;
}) {
  const hasContext = Boolean(title || round != null || turnLabel);
  const tone = turnTone ?? "theirs";

  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col bg-near-black px-5"
      style={{
        paddingTop: "max(1.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))",
      }}
    >
      {hasContext && (
        <div className="flex flex-col gap-1.5 border border-gunmetal bg-steel/40 px-4 py-3.5">
          {(title || round != null) && (
            <p className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-text-secondary">
              {title}
              {title && round != null ? " · " : ""}
              {round != null ? `Round ${round.toString()}` : ""}
            </p>
          )}
          {turnLabel && (
            <p
              className="text-[22px] font-bold uppercase leading-tight tracking-wider"
              style={{ ...STYLE_LABEL, color: TURN_COLORS[tone] }}
            >
              {turnLabel}
            </p>
          )}
          {clock && tone !== "over" && (
            <TurnCountdownProvider
              turnTimeSec={clock.turnTimeSec}
              turnStartTimeMs={clock.turnStartTimeMs}
            >
              <p className="font-mono text-xs text-amber">
                <TurnCountdownText /> left on the clock.
                {tone === "mine" ? " It keeps running." : ""}
              </p>
            </TurnCountdownProvider>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div
          aria-hidden="true"
          className="animate-phone-rotate"
          style={{
            width: "3rem",
            height: "5.1rem",
            border: "3px solid var(--color-cyan)",
            borderRadius: "6px",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "6px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "0.9rem",
              height: "3px",
              backgroundColor: "var(--color-cyan)",
              borderRadius: "1px",
            }}
          />
        </div>
        <h2
          className="text-[34px] font-bold uppercase leading-none tracking-wider text-cyan"
          style={STYLE_LABEL}
        >
          Turn your phone sideways
        </h2>
        <p className="max-w-[18rem] text-sm leading-relaxed text-text-secondary">
          The battle board needs the full width. It opens as soon as you
          rotate.
        </p>
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="h-[3.25rem] w-full border border-gunmetal bg-steel text-[17px] font-bold uppercase tracking-[0.1em] text-text-primary transition-colors hover:border-cyan hover:text-cyan"
          style={{ ...STYLE_LABEL, borderRadius: 0 }}
        >
          Back
        </button>
      )}
    </div>
  );
}
