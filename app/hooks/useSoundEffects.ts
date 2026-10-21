"use client";

import { useCallback, useEffect, useState } from "react";

// Sound effects (turn alert, comms blip, weapons — credited on
// /audio-credits), set in the header's audio control (AudioControl) and
// Settings › Audio next to Music. On by default, at full volume; both are
// remembered in this browser. Every effect plays through playSoundEffect so
// the settings cover all of them.

const STORAGE_KEY = "vt-sfx-enabled";
const VOLUME_KEY = "vt-sfx-volume";
const SFX_VOLUME = 0.5;

// This page's choices, used when storage is unavailable.
let pageSetting = true;
let pageVolume = 1;

/** The player's volume for effects, 0-1 (scales SFX_VOLUME). */
function soundEffectsVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const v = stored === null ? pageVolume : Number(stored);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : pageVolume;
  } catch {
    return pageVolume;
  }
}

/** Read at play time, so a change applies to the next sound immediately. */
function areSoundEffectsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? pageSetting : stored !== "0";
  } catch {
    return pageSetting;
  }
}

type PitchAudio = HTMLAudioElement & { webkitPreservesPitch?: boolean; mozPreservesPitch?: boolean };

/**
 * Plays `src` (under /public) unless sound effects are off. `pitch` plays it
 * higher or lower by a fixed factor; `pitchVariation`
 * (e.g. 0.05) shifts each play's pitch by a random amount up to that much up
 * or down, so a sound repeated in quick succession doesn't sound mechanical.
 * It changes the playback rate with pitch correction off, so the length
 * shifts by the same amount. Returns the playing audio (so a long sound can
 * be stopped early), or null when sound effects are off.
 */
export function playSoundEffect(
  src: string,
  options?: {
    /** Fixed pitch (and speed) multiplier, e.g. 0.85 for 15% lower. */
    pitch?: number;
    /** Loudness relative to the other effects, e.g. 1.15 for 15% louder. */
    volume?: number;
    pitchVariation?: number;
    /** Seconds to skip at the start, e.g. a file's leading silence. */
    startAt?: number;
  },
): HTMLAudioElement | null {
  if (!areSoundEffectsEnabled()) return null;
  const audio = new Audio(src) as PitchAudio;
  audio.volume = Math.min(1, SFX_VOLUME * soundEffectsVolume() * (options?.volume ?? 1));
  if (options?.startAt) audio.currentTime = options.startAt;
  const pitch = options?.pitch ?? 1;
  const variation = options?.pitchVariation ?? 0;
  if (pitch !== 1 || variation > 0) {
    audio.preservesPitch = false;
    audio.webkitPreservesPitch = false;
    audio.mozPreservesPitch = false;
    audio.playbackRate = pitch * (1 + (Math.random() * 2 - 1) * variation);
  }
  audio.play().catch((err) => {
    // Most commonly a browser autoplay-policy rejection before any click.
    console.warn(`[playSoundEffect] ${src}: audio.play() failed:`, err);
  });
  return audio;
}

/** The sound-effects setting: on/off and volume (0-1). */
export function useSoundEffectsSetting() {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolumeState] = useState(1);

  useEffect(() => {
    setEnabled(areSoundEffectsEnabled());
    setVolumeState(soundEffectsVolume());
  }, []);

  const setOn = useCallback((next: boolean) => {
    pageSetting = next;
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // storage unavailable: setting lasts for this page only
    }
    setEnabled(next);
  }, []);

  const toggle = useCallback(() => setOn(!areSoundEffectsEnabled()), [setOn]);

  const setVolume = useCallback((next: number) => {
    const v = Math.min(1, Math.max(0, next));
    pageVolume = v;
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      // storage unavailable: setting lasts for this page only
    }
    setVolumeState(v);
  }, []);

  return { enabled, toggle, setEnabled: setOn, volume, setVolume };
}
