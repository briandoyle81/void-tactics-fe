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
//
// Played through Web Audio from a fully decoded buffer, not an <audio>
// element: an element streams and decodes as it plays, so a busy tab or a
// slow range request drops out mid-track, and its loop leaves a gap. A
// looping AudioBufferSourceNode plays from memory on the audio thread, and
// the fades are gain ramps there too.

const MUSIC_VOLUME = 0.35;
const DEFAULT_VOLUME = 0.5;
const FADE_S = 0.6;
const STORAGE_KEY = "vt-music-enabled";
const VOLUME_KEY = "vt-music-volume";
/** Decoded tracks kept in memory (about 50 MB each); older ones are decoded again if needed. */
const MAX_DECODED_TRACKS = 3;

function readVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const v = stored === null ? DEFAULT_VOLUME : Number(stored);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

interface TrackState {
  src: string;
  gain: GainNode;
  buffer: AudioBuffer | null;
  loading: Promise<AudioBuffer | null> | null;
  source: AudioBufferSourceNode | null;
  /** Context time the source started, and the track offset it started at. */
  startedAt: number;
  startOffset: number;
  /** Where to resume, in seconds into the track. */
  offset: number;
  /** Pending stop after a fade out. */
  stopTimer: number | null;
  lastUsed: number;
}

let sharedContext: AudioContext | null = null;
function getContext(): AudioContext | null {
  if (sharedContext) return sharedContext;
  const Ctor =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  // iOS silences Web Audio with the ring switch unless the session is "playback".
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
  } catch {
    // not supported
  }
  sharedContext = new Ctor();
  return sharedContext;
}

function rampGain(ctx: AudioContext, gain: GainNode, to: number, seconds: number) {
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  if (seconds > 0) gain.gain.linearRampToValueAtTime(to, now + seconds);
  else gain.gain.setValueAtTime(to, now);
}

/** Stops the track's source, remembering where it was. */
function stopSource(ctx: AudioContext, t: TrackState) {
  if (t.stopTimer != null) {
    window.clearTimeout(t.stopTimer);
    t.stopTimer = null;
  }
  if (!t.source || !t.buffer) return;
  t.offset = (t.startOffset + (ctx.currentTime - t.startedAt)) % t.buffer.duration;
  try {
    t.source.stop();
  } catch {
    // already stopped
  }
  t.source.disconnect();
  t.source = null;
}

function startSource(ctx: AudioContext, t: TrackState) {
  if (t.source || !t.buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = t.buffer;
  source.loop = true;
  source.connect(t.gain);
  t.startOffset = t.offset % t.buffer.duration;
  t.startedAt = ctx.currentTime;
  source.start(0, t.startOffset);
  t.source = source;
}

export function useGameMusic(track: string = DEFAULT_MUSIC_TRACK) {
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  /** The track playing (or last played), so a change fades it out. */
  const currentRef = useRef<string | null>(null);
  /** One state per track, so each resumes where it left off. */
  const tracksRef = useRef(new Map<string, TrackState>());
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
    const ctx = sharedContext;
    const t = currentRef.current ? tracksRef.current.get(currentRef.current) : undefined;
    if (ctx && t?.source) rampGain(ctx, t.gain, MUSIC_VOLUME * volume, 0.05);
  }, [volume]);

  useEffect(() => {
    const tracks = tracksRef.current;
    const prevSrc = currentRef.current;
    const prev = prevSrc ? tracks.get(prevSrc) : undefined;
    const ctx = enabled ? getContext() : sharedContext;
    if (!ctx) return;

    const fadeOut = (t: TrackState) => {
      if (!t.source) return;
      rampGain(ctx, t.gain, 0, FADE_S);
      if (t.stopTimer != null) window.clearTimeout(t.stopTimer);
      t.stopTimer = window.setTimeout(() => {
        t.stopTimer = null;
        stopSource(ctx, t);
      }, FADE_S * 1000 + 50);
    };

    if (!enabled) {
      if (prev) stopSource(ctx, prev);
      return;
    }
    if (track === NO_MUSIC) {
      // Silence: fade out whatever's playing (it resumes from here later).
      if (prev) fadeOut(prev);
      return;
    }

    let t = tracks.get(track);
    if (!t) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      t = {
        src: track,
        gain,
        buffer: null,
        loading: null,
        source: null,
        startedAt: 0,
        startOffset: 0,
        offset: 0,
        stopTimer: null,
        lastUsed: 0,
      };
      tracks.set(track, t);
    }
    const target = t;
    target.lastUsed = performance.now();
    const crossfade = !!prev && prev !== target && !!prev.source;
    if (prev && prev !== target) fadeOut(prev);
    currentRef.current = track;

    let cancelled = false;
    const begin = () => {
      if (cancelled || !target.buffer) return;
      if (target.stopTimer != null) {
        // Coming back before the fade out finished: keep the source going.
        window.clearTimeout(target.stopTimer);
        target.stopTimer = null;
      }
      const wasPlaying = !!target.source;
      startSource(ctx, target);
      rampGain(ctx, target.gain, MUSIC_VOLUME * volumeRef.current, crossfade || wasPlaying ? FADE_S : 0.05);
      if (process.env.NODE_ENV !== "production" && !wasPlaying) console.info("[music] playing", track);
    };

    if (target.buffer) {
      begin();
    } else {
      if (!target.loading) {
        target.loading = fetch(track)
          .then((res) => {
            if (!res.ok) throw new Error(`${res.status}`);
            return res.arrayBuffer();
          })
          .then((data) => ctx.decodeAudioData(data))
          .then((buffer) => {
            target.buffer = buffer;
            return buffer;
          })
          .catch((err) => {
            console.warn("[music] couldn't load", track, err);
            return null;
          })
          .finally(() => {
            target.loading = null;
          });
      }
      void target.loading.then(begin);
    }

    // Drop the decoded audio of tracks not heard in a while.
    const idle = [...tracks.values()]
      .filter((s) => s !== target && !s.source && s.buffer)
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(MAX_DECODED_TRACKS - 1);
    for (const s of idle) s.buffer = null;

    // Browsers keep the context suspended until the page has had a click or
    // tap (e.g. after a reload with music on), so resume on the first one.
    const onGesture = () => {
      void ctx.resume().catch(() => {});
    };
    if (ctx.state !== "running") {
      void ctx.resume().catch(() => {});
      window.addEventListener("pointerdown", onGesture, { once: true });
      window.addEventListener("keydown", onGesture, { once: true });
    }
    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [enabled, track]);

  useEffect(() => {
    const tracks = tracksRef.current;
    return () => {
      const ctx = sharedContext;
      if (ctx) tracks.forEach((t) => stopSource(ctx, t));
    };
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
