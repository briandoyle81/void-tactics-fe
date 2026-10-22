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
//                     { type: "shipsRetreated", side: "player" }   every time a
//                       ship leaves the board alive (retreated or rammed
//                       off); add count: 2 to fire once, at 2 ships
//                     { type: "resourceTileTaken", side: "enemy", count: 1 }
//                       when that side's ships have landed on that many
//                       different resource tiles (1 = the first landing)
//                     { type: "reactorDamaged", side: "player" }   every time;
//                       add count: 3 to fire once, at 3 reactor damage total
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
    canHide: true,
    variants: [
      "Target down. There's some sort of advanced computer core in the wreckage.  Sending a shuttle to retrieve it.",
      "Splash one. I think it dropped something.  We'll grab it and see what it is.",
      "Confirmed kill. Detecting a complex signal in the wreckage.  Bringing it aboard for analysis.",
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
      "Enemy ship disabled. It can't move or fire, and its failing reactor will finish it in a few rounds. It's still holding its position, though. If it's sitting somewhere we need, ram it and take its spot!",
    ],
  },
  {
    id: "generic-reactor-damage-player",
    characterId: "adjutant",
    trigger: { type: "reactorDamaged", side: "player", count: 1 },
    canHide: true,
    variants: [
      "Reactor damage on one of ours, Admiral. That kind of damage doesn't heal, and enough of it will take the ship with it. Keep it out of harm's way.",
      "One of our reactors just took damage. It won't recover, and it's one step closer to going critical. Watch that ship.",
      "Reactor warning on one of our ships. It's holding for now, but there's only so much it can take before it goes critical.",
    ],
  },
  {
    id: "generic-reactor-damage-enemy",
    characterId: "adjutant",
    trigger: { type: "reactorDamaged", side: "enemy", count: 1 },
    canHide: true,
    variants: [
      "We've damaged an enemy reactor, and that damage is permanent. Keep the pressure on and it'll tear itself apart.",
      "Enemy reactor damaged. It won't recover, and it's one step closer to going critical.",
      "Their reactor's failing, Admiral. That ship is living on borrowed time.",
    ],
  },
  {
    // The first time a ship lands on a resource tile.
    id: "generic-first-resource-player",
    characterId: "adjutant",
    trigger: { type: "resourceTileTaken", side: "player", count: 1 },
    canHide: true,
    variants: [
      "We're holding our first resource site, Admiral. Every round we keep a ship on it pays out, so hold that position.",
      "First claim secured. The extraction crews are already moving in. Keep that site covered and the points keep coming.",
      "That's our first site. Resources win this fight as much as firepower does, so let's keep it and take more.",
    ],
  },
  {
    id: "generic-first-resource-enemy",
    characterId: "adjutant",
    trigger: { type: "resourceTileTaken", side: "enemy", count: 1 },
    canHide: true,
    variants: [
      "They've claimed a resource site, Admiral. Every round they hold it, they pull further ahead. Knock them off it.",
      "Enemy ships are working one of the sites. We can't let them sit there uncontested.",
      "The enemy's moved onto a resource site. Push them off before it pays out, or they'll win this on points.",
    ],
  },
  {
    // Each time one of ours leaves the board alive: retreated or rammed off.
    id: "generic-ship-retreated-player",
    characterId: "adjutant",
    trigger: { type: "shipsRetreated", side: "player" },
    canHide: true,
    variants: [
      "That ship's out of this fight, Admiral, but it's not lost. Our crews will run combat repairs so it's ready for the next one.",
      "We've lost one from the line, but only for now. The repair teams will patch it up, and it'll be flying again next battle.",
      "That ship's no longer in the fight. We'll get combat repairs done on it so it's ready when we need it next.",
    ],
  },
  {
    // Each time one of theirs leaves the board alive: retreated or rammed off.
    id: "generic-ship-retreated-enemy",
    characterId: "adjutant",
    trigger: { type: "shipsRetreated", side: "enemy" },
    canHide: true,
    variants: [
      "One of theirs is out of the fight, Admiral. It'll live to fly again, but it's one less gun on the board today.",
      "Enemy ship's left the field. Not a kill, but it can't hurt us or hold ground for the rest of this one.",
      "That's one of theirs off the board. They'll patch it up for another day, but this fight just got easier.",
    ],
  },
  {
    id: "generic-hive-taunt",
    characterId: "hive",
    trigger: { type: "shipsDestroyed", side: "player", count: 3 },
    variants: ["Your hulls break so easily.", "We are many. You are fewer."],
  },
];
