// Which music plays where (all under public/music/, credited on
// /audio-credits). Screens ask for theirs with useMusicTrack (AudioControl.tsx);
// anything else plays DEFAULT_MUSIC_TRACK (useGameMusic.ts).

/** The Command Deck, the game's home screen. */
export const COMMAND_DECK_MUSIC = "/music/night-221519.mp3";

/** The tutorial mission, First Contact. */
export const TUTORIAL_MUSIC = "/music/chill-synthwave-211190.mp3";

/** Operations missions with their own track, by roguelike node id (web3 and web2 share ids). */
const ROGUELIKE_MISSION_MUSIC: Record<number, string> = {
  // A Strange Encounter, the first onchain mission.
  1: "/music/dark-synth-wave-221328.mp3",
};

/** The track for an Operations mission's battle, or null for the default. */
export function roguelikeMissionMusic(nodeId: number | null | undefined): string | null {
  return nodeId != null && nodeId > 0 ? (ROGUELIKE_MISSION_MUSIC[nodeId] ?? null) : null;
}
