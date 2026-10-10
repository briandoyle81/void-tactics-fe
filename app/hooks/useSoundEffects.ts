"use client";

import { useCallback, useEffect, useState } from "react";

// Sound effects (turn alert, comms blip — credited on /audio-credits), toggled
// in Settings › Audio next to Music. On by default; the setting is
// remembered in this browser. Every effect plays through playSoundEffect so
// the toggle covers all of them.

const STORAGE_KEY = "vt-sfx-enabled";
const SFX_VOLUME = 0.5;

// This page's choice, used when storage is unavailable.
let pageSetting = true;

/** Read at play time, so a change applies to the next sound immediately. */
function areSoundEffectsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? pageSetting : stored !== "0";
  } catch {
    return pageSetting;
  }
}

/** Plays `src` (under /public) unless sound effects are off. */
export function playSoundEffect(src: string) {
  if (!areSoundEffectsEnabled()) return;
  const audio = new Audio(src);
  audio.volume = SFX_VOLUME;
  audio.play().catch((err) => {
    // Most commonly a browser autoplay-policy rejection before any click.
    console.warn(`[playSoundEffect] ${src}: audio.play() failed:`, err);
  });
}

/** The Settings › Audio toggle. */
export function useSoundEffectsSetting() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(areSoundEffectsEnabled());
  }, []);

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on;
      pageSetting = next;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // storage unavailable: setting lasts for this page only
      }
      return next;
    });
  }, []);

  return { enabled, toggle };
}
