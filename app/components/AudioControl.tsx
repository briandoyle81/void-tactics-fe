"use client";

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { HudIconButton } from "./HudIconButton";
import { playSoundEffect, useSoundEffectsSetting } from "../hooks/useSoundEffects";
import { useGameMusic } from "../hooks/useGameMusic";

// The game client's audio: AudioSettingsProvider (in app/(client)/layout.tsx)
// owns the music and the sound-effects setting, so music keeps playing
// across screens, and renders the one audio modal (on/off and volume for
// each, Mute all). Open it with AudioControl (a speaker showing whether
// anything is on: the HUD header and each battle's title row) or
// openAudioSettings (the landscape battle Menu). Settings › Audio uses the
// same settings.

const MONO_FONT = "var(--font-jetbrains-mono), 'Courier New', monospace";
const LABEL_FONT = "var(--font-rajdhani), 'Arial Black', sans-serif";
/** Played when the effects slider is let go, so the level can be heard. */
const SAMPLE_SOUND = "/sound/laser-snap.wav";

interface AudioChannel {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      {on ? (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 5a10 10 0 0 1 0 14" />
        </>
      ) : (
        <>
          <path d="m22 9-6 6" />
          <path d="m16 9 6 6" />
        </>
      )}
    </svg>
  );
}

function ChannelRow({
  label,
  channel,
  onRelease,
}: {
  label: string;
  channel: AudioChannel;
  /** After the slider is let go (e.g. play a sample). */
  onRelease?: () => void;
}) {
  const sliderId = useId();
  const percent = Math.round(channel.volume * 100);
  return (
    <div className="flex flex-col gap-2 border-t border-gunmetal py-3 first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={sliderId}
          className="text-base font-bold uppercase tracking-wider text-text-primary"
          style={{ fontFamily: LABEL_FONT }}
        >
          {label}
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={channel.enabled}
          aria-label={`${label} ${channel.enabled ? "on" : "off"}`}
          onClick={() => channel.setEnabled(!channel.enabled)}
          className={`h-8 min-w-[4.25rem] border px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
            channel.enabled
              ? "border-phosphor-green/60 bg-phosphor-green/10 text-phosphor-green"
              : "border-gunmetal bg-steel/40 text-text-muted hover:text-text-secondary"
          }`}
          style={{ fontFamily: MONO_FONT, borderRadius: 0 }}
        >
          {channel.enabled ? "On" : "Off"}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          step={5}
          value={percent}
          onChange={(e) => {
            channel.setVolume(Number(e.target.value) / 100);
            // Moving the slider means the player wants to hear it.
            if (!channel.enabled) channel.setEnabled(true);
          }}
          onPointerUp={onRelease}
          onKeyUp={onRelease}
          aria-valuetext={`${percent}%`}
          className={`h-8 flex-1 accent-cyan ${channel.enabled ? "" : "opacity-50"}`}
        />
        <span className="w-10 text-right text-xs text-text-secondary" style={{ fontFamily: MONO_FONT }}>
          {percent}%
        </span>
      </div>
    </div>
  );
}

type AudioSettings = {
  soundEffects: AudioChannel & { toggle: () => void };
  music: AudioChannel & { toggle: () => void };
  openAudioSettings: () => void;
};

const AudioSettingsContext = createContext<AudioSettings | null>(null);

export function useAudioSettings(): AudioSettings {
  const ctx = useContext(AudioSettingsContext);
  if (!ctx) throw new Error("useAudioSettings needs an AudioSettingsProvider (app/(client)/layout.tsx)");
  return ctx;
}

export function AudioSettingsProvider({ children }: { children: React.ReactNode }) {
  const soundEffects = useSoundEffectsSetting();
  const music = useGameMusic();
  const [open, setOpen] = useState(false);
  const openAudioSettings = useCallback(() => setOpen(true), []);
  const value = useMemo(
    () => ({ soundEffects, music, openAudioSettings }),
    [soundEffects, music, openAudioSettings],
  );
  return (
    <AudioSettingsContext.Provider value={value}>
      {children}
      {open && <AudioSettingsModal soundEffects={soundEffects} music={music} onClose={() => setOpen(false)} />}
    </AudioSettingsContext.Provider>
  );
}

/** The speaker button: waves when anything is on, muted when nothing is. Opens the audio modal. */
export function AudioControl() {
  const { soundEffects, music, openAudioSettings } = useAudioSettings();
  const anyOn = soundEffects.enabled || music.enabled;
  return (
    <HudIconButton
      label={anyOn ? "Sound on: audio settings" : "Sound off: audio settings"}
      onClick={openAudioSettings}
    >
      <span className={anyOn ? "" : "text-text-muted"}>
        <SpeakerIcon on={anyOn} />
      </span>
    </HudIconButton>
  );
}

function AudioSettingsModal({
  soundEffects,
  music,
  onClose,
}: {
  soundEffects: AudioChannel;
  music: AudioChannel;
  onClose: () => void;
}) {
  const anyOn = soundEffects.enabled || music.enabled;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleAll = () => {
    soundEffects.setEnabled(!anyOn);
    music.setEnabled(!anyOn);
  };

  return createPortal(
    // Above GameNav (z-250), the header's menus and the battle overlays (up to z-[700]).
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-control-title"
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto border bg-near-black p-4"
        style={{ borderColor: "var(--color-cyan)", borderTopColor: "var(--color-steel)", borderLeftColor: "var(--color-steel)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2
            id="audio-control-title"
            className="text-xl font-bold uppercase tracking-widest text-cyan"
            style={{ fontFamily: LABEL_FONT }}
          >
            Audio
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center text-lg text-text-secondary hover:text-cyan"
          >
            ×
          </button>
        </div>

        <ChannelRow label="Sound effects" channel={soundEffects} onRelease={() => playSoundEffect(SAMPLE_SOUND)} />
        <ChannelRow label="Music" channel={music} />

        <button
          type="button"
          onClick={toggleAll}
          className="mt-2 h-11 w-full border border-gunmetal bg-steel text-sm font-bold uppercase tracking-[0.1em] text-text-primary transition-colors hover:border-cyan hover:text-cyan"
          style={{ fontFamily: LABEL_FONT, borderRadius: 0 }}
        >
          {anyOn ? "Mute all" : "Unmute all"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
