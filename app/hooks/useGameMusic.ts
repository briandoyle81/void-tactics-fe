"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Background music for the game client (credited on /audio-credits). Off
// by default, at full volume when on; both are remembered in this browser
// and set in the header's audio control (AudioControl) or Settings › Audio.
// `track` is the screen's track (useMusicTrack in AudioControl.tsx); when it
// changes, the old one fades out and the new one fades in.

/** The track for screens that don't ask for one. */
export const DEFAULT_MUSIC_TRACK = "/music/synthwave-80s-robot-swarm-218092.mp3";
const MUSIC_VOLUME = 0.35;
const FADE_MS = 600;
const STORAGE_KEY = "vt-music-enabled";
const VOLUME_KEY = "vt-music-volume";

function readVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const v = stored === null ? 1 : Number(stored);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  } catch {
    return 1;
  }
}

/** Ramps `audio` to `to` over FADE_MS; returns a cancel function. */
function fadeTo(audio: HTMLAudioElement, to: number, onDone?: () => void): () => void {
  const from = audio.volume;
  const start = performance.now();
  const timer = window.setInterval(() => {
    const u = Math.min(1, (performance.now() - start) / FADE_MS);
    audio.volume = from + (to - from) * u;
    if (u >= 1) {
      window.clearInterval(timer);
      onDone?.();
    }
  }, 30);
  return () => window.clearInterval(timer);
}

export function useGameMusic(track: string = DEFAULT_MUSIC_TRACK) {
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // storage unavailable: stay off
    }
    setVolumeState(readVolume());
  }, []);

  // A volume change applies to the playing track at once.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = MUSIC_VOLUME * volume;
  }, [volume]);

  useEffect(() => {
    if (!enabled) {
      audioRef.current?.pause();
      return;
    }
    const target = MUSIC_VOLUME * volumeRef.current;
    const cancels: Array<() => void> = [];
    const current = audioRef.current;
    const switching = current != null && !current.src.endsWith(track);
    if (switching) {
      // Fade the old track out, then let it go (at once if this is cut short).
      const old = current;
      cancels.push(fadeTo(old, 0, () => old.pause()), () => old.pause());
    } else if (current) {
      // Same track: undo any fade that was cut short.
      current.volume = target;
    }
    if (!current || switching) {
      const audio = new Audio(track);
      audio.loop = true;
      audio.volume = switching ? 0 : target;
      audioRef.current = audio;
      if (switching) cancels.push(fadeTo(audio, target));
    }
    const audio = audioRef.current!;
    // Browsers block playback until the page has had a click or tap (e.g.
    // after a reload with music on), so retry on the first one.
    const onGesture = () => {
      void audio.play().catch(() => {});
    };
    audio.play().catch(() => {
      window.addEventListener("pointerdown", onGesture, { once: true });
    });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      cancels.forEach((cancel) => cancel());
    };
  }, [enabled, track]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const setOn = useCallback((next: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // storage unavailable: setting lasts for this page only
    }
    setEnabled(next);
  }, []);

  const toggle = useCallback(() => setEnabled((on) => {
    const next = !on;
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // storage unavailable: setting lasts for this page only
    }
    return next;
  }), []);

  const setVolume = useCallback((next: number) => {
    const v = Math.min(1, Math.max(0, next));
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      // storage unavailable: setting lasts for this page only
    }
    setVolumeState(v);
  }, []);

  return { enabled, toggle, setEnabled: setOn, volume, setVolume };
}
