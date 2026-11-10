"use client";

import React from "react";
import { battleMusic, musicTrackTitle, NO_MUSIC } from "../../config/music";
import { useAudioSettings } from "../AudioControl";

// The node editor's Music row: the battle track assigned to the node
// (app/config/music.ts, edited by hand) and a button that plays it in place
// of the screen's music, through the game's own music player (so it follows
// Settings › Audio). It stops when the editor closes.
export function NodeMusicPreview({ nodeId }: { nodeId: number }) {
  const { music, requestMusicTrack, openAudioSettings } = useAudioSettings();
  const track = battleMusic(nodeId);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => setPlaying(false), [nodeId]);
  React.useEffect(() => {
    if (!playing || track === NO_MUSIC) return;
    return requestMusicTrack(track);
  }, [playing, track, requestMusicTrack]);

  return (
    <div className="flex flex-col gap-1 text-xs text-text-muted">
      Music
      {track === NO_MUSIC ? (
        <span className="text-sm text-text-secondary">None (the battle is silent)</span>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={playing}
            onClick={() => setPlaying((p) => !p)}
            className="shrink-0 border-2 border-cyan px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan hover:bg-cyan/10"
            style={{ borderRadius: 0 }}
          >
            {playing ? "■ Stop" : "▶ Play"}
          </button>
          <span className="text-sm text-cyan">{musicTrackTitle(track)}</span>
        </div>
      )}
      {playing && !music.enabled && (
        <button
          type="button"
          onClick={openAudioSettings}
          className="self-start text-[11px] text-amber underline underline-offset-2"
        >
          Music is off: turn it on in Audio settings
        </button>
      )}
      <p className="text-[11px] text-text-muted">Battle music ships with the app: edit app/config/music.ts.</p>
    </div>
  );
}
