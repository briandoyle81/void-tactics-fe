"use client";

import React from "react";
import { DIALOG_CHARACTERS, type DialogCharacterId } from "../data/dialog/characters";
import type { DialogQueueItem } from "../utils/missionDialog";
import { HighlightedText } from "./HighlightedText";

/**
 * Puts a mission's opening line in the round report, the way the tutorial
 * shows Bosch's words: as the report's note, signed by whoever says it
 * (useMissionDialog's openingLine). Closing the report marks the line read,
 * so it doesn't play again in the comms panel; its replies play there next.
 * Shared by GameDisplay and GameDisplayWeb2. Returns RoundStartModal props.
 */
export function useOpeningLineReport(
  openingLine: DialogQueueItem | null,
  takeOpeningLine: () => void,
  onClose: () => void,
): { note?: React.ReactNode; reporterId?: DialogCharacterId; onClose: () => void } {
  return React.useMemo(
    () => ({
      note: openingLine ? (
        <p>
          <HighlightedText text={openingLine.text} />
        </p>
      ) : undefined,
      reporterId:
        openingLine && Object.hasOwn(DIALOG_CHARACTERS, openingLine.characterId)
          ? (openingLine.characterId as DialogCharacterId)
          : undefined,
      onClose: () => {
        takeOpeningLine();
        onClose();
      },
    }),
    [openingLine, takeOpeningLine, onClose],
  );
}
