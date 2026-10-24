"use client";

import { createContext, useContext } from "react";
import type { ActivePlayback, PlaybackPhase } from "../hooks/useMovePlayback";

// The move playing back (useMovePlayback), handed from GameGrid's `playback`
// prop to MovePlaybackLayer and to the cells (which hide the ship that's
// sliding or fleeing) without threading it through every board component.

export interface MovePlaybackValue {
  active: ActivePlayback | null;
  onPhaseDone: (key: string, phase: PlaybackPhase) => void;
  hiddenShipIds: Set<number>;
  /** The map's background image (mapBackgroundFor), for the combat cinematic's panels. */
  background: string;
}

const NOOP = () => {};
const NO_IDS = new Set<number>();

export const MovePlaybackContext = createContext<MovePlaybackValue>({
  active: null,
  onPhaseDone: NOOP,
  hiddenShipIds: NO_IDS,
  background: "",
});

export function useMovePlaybackContext(): MovePlaybackValue {
  return useContext(MovePlaybackContext);
}
