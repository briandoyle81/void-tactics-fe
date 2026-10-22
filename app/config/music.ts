// Which music plays where (all under public/music/, credited on
// /audio-credits). Every screen plays DEFAULT_MUSIC_TRACK, except battles,
// which are silent unless their mission has a track here. Battles ask with
// useMusicTrack (AudioControl.tsx); useGameMusic.ts plays it.

/** Every screen outside battle: the Command Deck, Operations, fleet selection... */
export const DEFAULT_MUSIC_TRACK = "/music/night-221519.mp3";

/** A battle with no track of its own (missions not listed here, PvP, spectating). */
export const NO_MUSIC = "";

/** The tutorial mission, First Contact. */
export const TUTORIAL_MUSIC = "/music/chill-synthwave-211190.mp3";

/** Operations missions with their own track, by roguelike node id (web3 and web2 share ids). */
const ROGUELIKE_MISSION_MUSIC: Record<number, string> = {
  // A Strange Encounter, the first onchain mission.
  1: "/music/dark-synth-wave-221328.mp3",
  // Digging Deeper.
  2: "/music/bransboynd-retro-game-402454.mp3",
  // Collision Course.
  3: "/music/tom091178-neon-dystopia-vaporwave-1-562018.mp3",
};

/**
 * A battle's track: its Operations mission's own track, or silence (other
 * missions, PvP and spectating don't have music yet).
 */
export function battleMusic(roguelikeNodeId: number | null | undefined): string {
  return roguelikeNodeId != null && roguelikeNodeId > 0
    ? (ROGUELIKE_MISSION_MUSIC[roguelikeNodeId] ?? NO_MUSIC)
    : NO_MUSIC;
}
