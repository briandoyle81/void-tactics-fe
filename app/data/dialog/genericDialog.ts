import type { GenericDialogLine } from "../../types/dialog";
import type { DialogCharacterId } from "./characters";

// Lines that can fire in any campaign or roguelike mission (never the
// tutorial) — general chatter for missions without written dialog.
//
// Each entry:
//   id            — unique id, e.g. "generic-first-loss".
//   characterId   — who speaks (a key of DIALOG_CHARACTERS in characters.ts).
//   trigger       — when it plays; same options as missionDialog.ts:
//                     { type: "missionStart" }
//                     { type: "roundStart", round: 3 }   omit round = every round
//                     { type: "roundEnd", round: 2 }     omit round = every round
//                     { type: "shipsDisabled", side: "enemy", count: 1 }
//                     { type: "shipsDestroyed", side: "enemy", count: 1 }
//                     { type: "pointsScored", side: "player", points: 10 }
//                     { type: "missionVictory" }   when the player wins
//                     { type: "missionDefeat" }    when the player loses (incl. retreat)
//   variants      — alternative wordings; one is picked each time the line
//                   fires (the pick is stable per game, so a reload doesn't
//                   change it). Add as many as you like. A variant is either
//                   plain text, or text with its own replies (so the reply
//                   always matches the wording that was picked):
//                     "Target down.",
//                     {
//                       text: "Splash one.",
//                       responses: [{ characterId: "commander", text: "Good. Next target." }],
//                     },
//   missionKinds  — optional: ["campaign"] or ["roguelike"] to limit where
//                   the line can fire. Omit for both.
//   canHide       — optional: true adds a "Don't show again" checkbox to the
//                   line. Ticking it stops the line playing again, in any
//                   game, on that device. Use it for explanations a player
//                   only needs once.
//
// Rules:
// - If a mission has its own line for an event (missionDialog.ts), generic
//   lines for that event are skipped.
// - If several generic lines match the same event, only one of them plays
//   (picked per game), so it's fine to have alternatives with different
//   speakers for the same trigger.
// - Roguelike missions never use a generic missionStart line: every
//   roguelike node must have its own entry line (see missionDialog.ts).
export const GENERIC_DIALOG_LINES: GenericDialogLine<DialogCharacterId>[] = [
  {
    id: "generic-mission-start",
    characterId: "adjutant",
    trigger: { type: "missionStart" },
    variants: [
      "All ships, weapons free. Let's get this done.",
      "Contact ahead. Stay in formation and watch your flanks.",
      "Another sector, another swarm. You know the drill.",
    ],
  },
  {
    id: "generic-first-loss",
    characterId: "adjutant",
    trigger: { type: "shipsDestroyed", side: "player", count: 1 },
    variants: [
      "We've lost a ship. Tighten up.",
      "Hull breach confirmed. That one's gone.",
      "First casualty. I hope you know what you're doing, admiral.",
    ],
  },
  {
    id: "generic-first-kill",
    characterId: "adjutant",
    trigger: { type: "shipsDestroyed", side: "enemy", count: 1 },
    variants: [
      "Target down.",
      "Splash one.",
      "Confirmed kill. Keep the pressure on.",
    ],
  },
  {
    id: "generic-ship-disabled-player",
    characterId: "adjutant",
    trigger: { type: "shipsDisabled", side: "player", count: 1 },
    canHide: true,
    variants: [
      "One of our ships is disabled, Admiral. It's dead in space: no engines, no weapons. Its reactor is failing, and unless we repair it or order it to retreat, we'll lose it in a few rounds.",
    ],
  },
  {
    id: "generic-ship-disabled-enemy",
    characterId: "adjutant",
    trigger: { type: "shipsDisabled", side: "enemy", count: 1 },
    canHide: true,
    variants: [
      "Enemy ship disabled. It can't move or fire, and its failing reactor will finish it in a few rounds. It's still holding its position, though. If it's sitting somewhere we need, finish it off.  Or ram it and take it's spot!",
    ],
  },
  {
    id: "generic-hive-taunt",
    characterId: "hive",
    trigger: { type: "shipsDestroyed", side: "player", count: 2 },
    variants: ["Your hulls break so easily.", "We are many. You are fewer."],
  },
];
