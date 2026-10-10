"use client";

import React from "react";
import { STYLE_LABEL, STYLE_MONO } from "../styles/fontStyles";
import { getDialogCharacter, type DialogCharacterId } from "../data/dialog/characters";
import { playSoundEffect } from "../hooks/useSoundEffects";
import { DialogPortrait } from "./DialogPortrait";

// Pieces for a report filed by a crew member: the round report
// (RoundStartModal) and the battle/mission report (GameResultModal). A
// report reads as a document (letterhead, ruled table, signature), not a
// comms line; the facts stay the headline. Any dialog character can file
// one; the adjutant does by default.

export const DEFAULT_REPORTER: DialogCharacterId = "adjutant";

export function useCrewReporter(reporterId: DialogCharacterId = DEFAULT_REPORTER) {
  const character = getDialogCharacter(reporterId);
  return {
    character,
    name: character?.name ?? "Adjutant",
    color: character?.textColor ?? "var(--color-amber)",
  };
}

/** The comms blip once when a report opens (muted by Settings › Audio). */
export function useReportArrivalSound() {
  React.useEffect(() => {
    playSoundEffect("/sound/comms.mp3");
  }, []);
}

/** Report type (and number) on the left, who filed it on the right. */
export function CrewReportLetterhead({
  title,
  subtitle,
  reporter,
}: {
  title: string;
  subtitle?: string;
  reporter: ReturnType<typeof useCrewReporter>;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-solid px-4 pb-2 pt-3"
      style={{ borderColor: "var(--color-gunmetal)" }}
    >
      <div
        className="text-left text-[10px] uppercase leading-tight tracking-[0.25em] text-text-muted"
        style={STYLE_MONO}
      >
        {title}
        {subtitle && <div className="tabular-nums">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-2 text-right">
        <div className="text-[10px] uppercase leading-tight tracking-widest" style={STYLE_MONO}>
          <div className="text-text-muted">Filed by</div>
          <div className="font-bold" style={{ ...STYLE_LABEL, color: reporter.color }}>
            {reporter.name}
          </div>
        </div>
        <DialogPortrait
          character={reporter.character}
          name={reporter.name}
          color={reporter.color}
          sizeClass="h-10 w-10"
        />
      </div>
    </div>
  );
}

export function CrewReportSignature({ reporter }: { reporter: ReturnType<typeof useCrewReporter> }) {
  return (
    <div className="text-right text-[11px] italic" style={{ ...STYLE_MONO, color: reporter.color }}>
      — {reporter.name}
    </div>
  );
}
