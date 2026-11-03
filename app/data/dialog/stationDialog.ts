import type { DialogCharacterId } from "./characters";

// Lines shown at roguelike stations (not in battle), each in its own spot on
// the station screen.

/** In the repair box of a resupply station (RoguelikeResupplyPanel / Web2). */
export const RESUPPLY_REPAIR_LINE: { characterId: DialogCharacterId; text: string } = {
  characterId: "adjutant",
  text: "Admiral, the station has a repair service, but it isn't free. We'll need to pay in UTC to bring our ships back up to full strength.",
};
