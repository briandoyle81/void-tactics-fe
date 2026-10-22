"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MUSIC_TRACK, NO_MUSIC } from "../config/music";

// Background music for the game client (credited on /audio-credits). Off
// by default, at 50% volume when on; both are remembered in this browser
// and set in the header's audio control (AudioControl) or Settings › Audio.
// `track` is the screen's track (useMusicTrack in AudioControl.tsx; the
// choices are in app/config/music.ts), or NO_MUSIC for silence. When it
// changes, the old one fades out and the new one fades in. Each track keeps
// its place, so going back to one resumes it.

const MUSIC_VOLUME = 0.35;
const DEFAULT_VOLUME = 0.5;
const FADE_MS = 600;
const STORAGE_KEY = "vt-music-enabled";
const VOLUME_KEY = "vt-music-volume";

function readVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const v = stored === null ? DEFAULT_VOLUME : Number(stored);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
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
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  /** The track playing (or last played), so a change fades it out. */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** One element per track, so each resumes where it left off. */
  const tracksRef = useRef(new Map<string, HTMLAudioElement>());
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
    const prev = audioRef.current;
    if (!enabled) {
      prev?.pause();
      return;
    }
    const cancels: Array<() => void> = [];
    const prevPlaying = prev != null && !prev.paused;

    if (track === NO_MUSIC) {
      // Silence: fade out whatever's playing (it resumes from here later).
      if (prev && prevPlaying) cancels.push(fadeTo(prev, 0, () => prev.pause()), () => prev.pause());
      return () => cancels.forEach((cancel) => cancel());
    }

    const target = MUSIC_VOLUME * volumeRef.current;
    let audio = tracksRef.current.get(track);
    if (!audio) {
      audio = new Audio(track);
      audio.loop = true;
      tracksRef.current.set(track, audio);
    }
    if (prev && prev !== audio && prevPlaying) {
      // Crossfade from the old track.
      cancels.push(fadeTo(prev, 0, () => prev.pause()), () => prev.pause());
      audio.volume = 0;
      cancels.push(fadeTo(audio, target));
    } else {
      audio.volume = target;
    }
    if (audio.paused && process.env.NODE_ENV !== "production") console.info("[music] playing", track);
    audioRef.current = audio;
    const playing = audio;
    // Browsers block playback until the page has had a click or tap (e.g.
    // after a reload with music on), so retry on the first one.
    const onGesture = () => {
      void playing.play().catch(() => {});
    };
    playing.play().catch(() => {
      window.addEventListener("pointerdown", onGesture, { once: true });
    });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      cancels.forEach((cancel) => cancel());
    };
  }, [enabled, track]);

  useEffect(() => {
    const tracks = tracksRef.current;
    return () => tracks.forEach((audio) => audio.pause());
  }, []);

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
