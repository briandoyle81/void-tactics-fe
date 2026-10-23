import type { DialogMission } from "../../types/dialog";
import type { DialogCharacterId } from "./characters";

// Who speaks each mission's description — the briefing shown as an
// "incoming transmission" in the node preview, before the mission starts.
//
// Each entry:
//   mission      — which mission: { kind: "campaign", nodeId: 5 },
//                  { kind: "roguelike", nodeId: 5 } (separate numbering),
//                  { kind: "tutorial" } (the first mission on the
//                  Operations map for players who haven't done it).
//   characterId  — who delivers the briefing (a key of DIALOG_CHARACTERS
//                  in characters.ts); their portrait, name and color frame
//                  the text.
//
// The briefing text itself isn't written here: it's the node's description
// in nodeContent.ts (web3; web2 keeps it in Postgres). A mission with no
// entry here shows its description as plain, unattributed text.
export const MISSION_BRIEFING_SPEAKERS: {
  mission: DialogMission;
  characterId: DialogCharacterId;
}[] = [
  { mission: { kind: "tutorial" }, characterId: "adjutant" },
  // Adjutant Bosch briefs every Operations mission with text in nodeContent.ts.
  { mission: { kind: "roguelike", nodeId: 1 }, characterId: "adjutant" }, // A Strange Encounter
  { mission: { kind: "roguelike", nodeId: 2 }, characterId: "adjutant" }, // Digging Deeper
  { mission: { kind: "roguelike", nodeId: 3 }, characterId: "adjutant" }, // Collision Course
  { mission: { kind: "roguelike", nodeId: 4 }, characterId: "adjutant" }, // Resupply Station
  { mission: { kind: "roguelike", nodeId: 5 }, characterId: "adjutant" }, // Shocking Revelation
  { mission: { kind: "roguelike", nodeId: 6 }, characterId: "adjutant" }, // Counterattack
  { mission: { kind: "roguelike", nodeId: 7 }, characterId: "adjutant" }, // Resupply Station
  { mission: { kind: "roguelike", nodeId: 16 }, characterId: "adjutant" }, // Sneak Attack
  { mission: { kind: "roguelike", nodeId: 31 }, characterId: "adjutant" }, // Repair Station DS7
];
