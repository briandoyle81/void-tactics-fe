import type { MissionDialogEntry, MissionDialogLine } from "../../types/dialog";
import type { DialogCharacterId } from "./characters";

// Lines written for one specific mission, listed under the mission's node
// id: ROGUELIKE_MISSION_DIALOG[5] is roguelike node 5's lines (titled from
// nodeContent.ts in the comment above each), CAMPAIGN_MISSION_DIALOG[5]
// campaign node 5's (separate numbering), TUTORIAL_MISSION_DIALOG the
// tutorial's. To add a line, find its node (or add the node's key) and
// append it there.
//
// Each line:
//   id           — unique id, e.g. "roguelike-3-first-kill". Marks the line
//                  as played for a game; renaming it makes it play again.
//   characterId  — who speaks (a key of DIALOG_CHARACTERS in characters.ts).
//   text         — what they say. Short is best: the comms panel is small.
//                  It stays up until the player presses NEXT/OK. A
//                  missionStart line is the exception: it's shown in the
//                  round report at the start of the match, signed by its
//                  speaker, and its responses then play in the comms panel.
//   trigger      — when it plays:
//                    { type: "missionStart" }
//                    { type: "roundStart", round: 3 }   omit round = every round
//                    { type: "roundEnd", round: 2 }     omit round = every round
//                    { type: "shipsDisabled", side: "enemy", count: 1 }
//                    { type: "shipsDestroyed", side: "enemy", count: 1 }
//                    { type: "reactorOverloadWarning", side: "player", level: 2 }
//                      a ship on that side first reaches that overload
//                      level (one ship's pips, not the fleet total). Omit
//                      count to fire every time a new ship reaches it;
//                      add count: 1 to fire once, when the first ship does
//                    { type: "pointsScored", side: "player", points: 10 }
//                    { type: "shipsDamaged", side: "player", count: 1 }
//                    { type: "shipsDisabledOnResource", side: "enemy", count: 1 }
//                    { type: "shipsRepaired", faction: 2, count: 1 }   (see
//                      genericDialog.ts for these three)
//                    { type: "missionVictory" }   when the player wins
//                    { type: "missionDefeat" }    when the player loses (incl. retreat)
//                  side is "player" (you) or "enemy" (the AI). Ship and point
//                  triggers fire once, when the running total reaches the
//                  number.
//                  Disabled = knocked to 0 hull but still on the board (can
//                  be repaired or finished off); counts distinct ships over
//                  the game. Destroyed = removed from the game. A ship that's
//                  disabled then finished off fires both. Retreats are neither.
//                  Victory/defeat lines (and their responses) play as a
//                  debrief inside the result screen, after any final
//                  kill/score lines. A draw triggers neither.
//   when         — optional extra conditions: { playerFaction: 1 },
//                  { playerCanRepair: true } (see genericDialog.ts).
//   responses    — optional replies that play right after this line, in
//                  order, each by any character (same or different):
//                    responses: [
//                      { characterId: "commander", text: "Understood. Proceed." },
//                      { characterId: "adjutant", text: "Aye, Admiral." },
//                    ]
//                  Each reply is its own comms message; the player reads
//                  them one by one with NEXT.
//
// Rules:
// - Several lines with the same node and trigger play one after another,
//   in the order listed under that node. For a back-and-forth, `responses` on one line
//   keeps the exchange together in a single entry.
// - A mission line replaces the generic lines (genericDialog.ts) for that
//   event, so generic chatter never talks over written dialog.
// - Every roguelike combat node needs a missionStart line. A missing one
//   shows an error in game instead of a generic line (see
//   ENTRY_LINE_REQUIRED_KINDS in app/utils/missionDialog.ts).
// - The mission's title and description (the briefing in the node preview)
//   are in nodeContent.ts, with its speaker.
export const ROGUELIKE_MISSION_DIALOG: Record<
  number,
  MissionDialogEntry<DialogCharacterId>[]
> = {
  // A Strange Encounter
  1: [
    {
      id: "roguelike-1-start",
      characterId: "adjutant",
      text: "Admiral, we're at the coordinates Central sent. Unidentified contacts ahead. They look like standard-pattern vessels, but they're not broadcasting IFF and not responding to our hails. What is going on here?",
      trigger: { type: "missionStart" },
    },
    {
      id: "roguelike-1-first-kill",
      characterId: "adjutant",
      text: "We got one!  Maybe there will be clues in the wreckage.",
      trigger: { type: "shipsDestroyed", side: "enemy", count: 1 },
      responses: [
        {
          characterId: "prototypeDrone",
          text: "And from the deep there came, the metallic intelligence descended upon the fire, so that none aboard could distinguish machinery from omen.",
        },
        { characterId: "adjutant", text: "Who are we fighting?  Or what...?" },
      ],
    },
    {
      id: "roguelike-1-strange-message",
      characterId: "adjutant",
      text: "Hailing unknown vessels. What are your intentions?  Under Space Law, you cannot legally claim a resource site if you are not broadcasting IFF.",
      trigger: { type: "roundStart", round: 2 },
      responses: [
        {
          characterId: "prototypeDrone",
          text: "The deck trembled as if judgment had taken mechanical form. Now therefore, the fluke was numbered with the beam, and the apparatus was cast upon the depth, and every eye was turned toward the impossible light. For it was written.",
        },
        {
          characterId: "adjutant",
          text: "Unknown vessels, your last message was garbled.  Please repeat.",
        },
        {
          characterId: "prototypeDrone",
          text: "Hitherto authoritatively regarded as the monster as if in answer to the amazement was a matter almost indispensable to do; when all these ran into each other in three places, be the man on horseback, yet the arbitrary vein in which I fling half out to the fringing fibres of that tempestuous wind.",
        },
      ],
    },
    {
      id: "roguelike-1-strange-message-2",
      characterId: "prototypeDrone",
      text: "Now therefore: the captain crossed the valley of smoke, until the water shone like metal beneath a furnace. In those days: the old sailor beyond the cold moon, and the measure thereof was hidden from men. ",
      trigger: { type: "roundStart", round: 3 },
      responses: [
        {
          characterId: "adjutant",
          text: "You aren't making any sense. We claim this site under Section 10, Addendum 3. Leave, or be destroyed.",
        },
      ],
    },
    {
      id: "roguelike-1-victory",
      characterId: "adjutant",
      text: "That was really strange, Admiral.  They looked and fought like any other ship built in a drone factory, but those messages...",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "adjutant",
          text: "We'll investigate the site and the wreckage.  Maybe we'll find some answers.",
        },
      ],
    },
    {
      id: "roguelike-1-defeat",
      characterId: "adjutant",
      text: "We've lost, admiral.  The unknown vessels were too fast and too well-armed.  We couldn't hold them off.",
      trigger: { type: "missionDefeat" },
      responses: [
        {
          characterId: "adjutant",
          text: "Whatever is going on here, someone else will have to figure it out.",
        },
      ],
    },
  ],
  // Digging Deeper
  2: [
    {
      id: "roguelike-2-start",
      characterId: "adjutant",
      text: "We've reached the site and have more of those strange ships on scan.  They are now broadcasting IFF with a valid hexcode, but it doesn't match any in our records.  Whoever they are, Central will allow them to claim this site under Section 10.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "adjutant",
          text: "We're a little banged up from the last fight, so you might want to be cautious.  The layout of the dust clouds and debris fields favors our deployment.  Rather than fighting the enemy ships directly, you might want to focus on blocking them and securing the resource locations.",
        },
        {
          characterId: "prototypeDrone",
          text: "And with that keen steel deep into their faces flashed out pallid green, gentle, and humorously discourse of parlors, sofas, carpets, and the same time enforced a certain grizzled wittiness; such ceaseless shudderings shook him; that appears to the 10th claim",
        },
      ],
    },
    {
      id: "roguelike-2-enemy-wiped",
      characterId: "adjutant",
      text: "That was the last one!  We've wiped out the enemy forces.  Amazing!",
      trigger: { type: "shipsDestroyed", side: "enemy", count: 10 },
    },
    {
      id: "roguelike-2-victory",
      characterId: "adjutant",
      text: "We've secured the resource site and enemy forces seem to be adhering to Space Law.  We still don't know who they are, but great work, Admiral.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "prototypeDrone",
          text: "Import of all that region. Should you ever stand in the east, I am not free to ply her shuttle between given threads; 'Shall we?' cries the Captain, the whole striking contrast of the sea, and slippers, his partner, who have died exhaling it.",
        },
        {
          characterId: "adjutant",
          text: "...that almost sounded like they were conceding defeat.",
        },
      ],
    },
    {
      id: "roguelike-2-defeat",
      characterId: "adjutant",
      text: "We've lost, admiral.  The enemy can legally claim the site.  I guess we'll have to wait for Central to tell us what happened when they register the claim.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // Collision Course
  3: [
    {
      id: "roguelike-3-start",
      characterId: "adjutant",
      text: "Admiral, didn't we already destroy one of those ships earlier?  I guess it could be another ship with the same name, but I've never seen a name repeated in such a short time.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "adjutant",
          text: "As you know, the drone factories don't allow us to name our ships.  That means that while it's not too uncommon for two ships to have the same name, it's still really rare to see any given name repeated in such a short time.",
        },
        {
          characterId: "prototypeDrone",
          text: "Starbuck watched the fate of one of these cloudy black brigantines had risen to its place and time himself on his underlings to the copper cooler at the back; pinioned in the pit by sheer force of contrast, acted like a knot of numbed wasps.",
        },
        {
          characterId: "adjutant",
          text: "I'm not sure I understand.  Why is that significant?",
        },
        {
          characterId: "prototypeDrone",
          text: "Come hither and praying, and there have been shoals, what’s to me with the little tents really no oars.",
        },
      ],
    },
    {
      id: "roguelike-3-victory",
      characterId: "adjutant",
      text: "We've secured another site.  Let's clean up and get to the resupply station.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "prototypeDrone",
          text: "What news of whose fossil remains? Sing, I had passed through the honor; they say; her side to gaze curiously carved. The next generation awakens.",
        },
      ],
    },
    {
      id: "roguelike-3-defeat",
      characterId: "adjutant",
      text: "They beat us.  It was a hard fight, we did our best, but we just couldn't hold them off.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // Resupply Station
  4: [
    {
      id: "roguelike-4-start",
      characterId: "adjutant",
      text: "RED ALERT! RED ALERT!  Scanning the unknown ships.  Preliminary results suggests they're tougher than our ships.  Their weapons have huge power supplies, but focusing apertures suggest shorter range.  They're heavy, slow, and hit like a truck.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "adjutant",
          text: "I recommend you play to our strengths and their weaknesses.  Keep them at a distance and use the debris fields to control the fight.",
        },
      ],
    },
    {
      id: "roguelike-4-enemy-resources-1",
      characterId: "drone",
      text: "A moment! Pardon! ’tis now that — in the mines, they seemed abating their speed; gradually the ship holding the flesh fled the bottom forthwith from the drones. These temporary apprehensions, and even so, after concluding his contributory work for that accursed ore",
      trigger: { type: "resourceTileTaken", side: "enemy", count: 1 },
      responses: [
        {
          characterId: "adjutant",
          text: "I think they're telling us they've claimed the site? There are a lot of resources here.  It's time we teach whoever they are a lesson about Space Law!",
        },
      ],
    },
    {
      id: "roguelike-4-victory",
      characterId: "adjutant",
      text: "They're backing off!  Is it just more, or do they seem to be learning more about us and about how things work every encounter. Sending out scouts now to explore the area.  I'll report back with what we find.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "drone",
          text: "Is, then, how could I withstand them, drawing still further and more inconsiderable and scattered bones of the mass, curiously carved from the northwest. It was the strange life - like fin stands up and returned to them by Ahab — his living foot advanced upon him in the ceiling, lined, or to spread.",
        },
        {
          characterId: "adjutant",
          text: "Preliminary reports suggest we've got a couple of options to move forward.  We can either try to sneak through a gas cloud to approach an enemy base, or we can fight them head-on and capture a repair station that will allow us to bring our ships back to full strength.",
        },
        {
          characterId: "adjutant",
          text: "I'll prepare a briefing for each option.",
        },
      ],
    },
    {
      id: "roguelike-4-defeat",
      characterId: "adjutant",
      text: "They beat us.  Whatever those ships are, they're stronger than ours and we couldn't figure out how to fight them.",
      trigger: { type: "missionDefeat" },
      responses: [
        {
          characterId: "drone",
          text: "Whatsoever, my motion and nothing all the commonweal of that you are, he had gathered in my nerve and everlasting terra firma, while in the captain was a telegram, Senor; he were worn and the attention, ring! It is combustible flashes into the quiet lane were used to the air! ",
        },
      ],
    },
  ],
  // Shocking Revelation
  5: [
    {
      id: "roguelike-4-player-resources-1",
      characterId: "drone",
      text: "That head this substance, organics digging would be a long experience what had gone down a peep through the footpath. I had hurried across the expanse - crackers, pitch, and fences, loud little genial, now, and give the metal, and aft the life.",
      trigger: { type: "resourceTileTaken", side: "player", count: 1 },
      responses: [
        {
          characterId: "adjutant",
          text: "I don't think they liked that!",
        },
      ],
    },
    {
      id: "roguelike-5-start",
      characterId: "adjutant",
      text: "Admiral, get a look at that ship!  It's got some kind of unsanctioned modifications that make it as effective as a ship with a veteran crew.  I think that shipyard is putting on final finishing, which means the weapons aren't active and the reactor is cold.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "adjutant",
          text: "If we can chase off or destroy the enemy fleet, we can board the shipyard and claim the ship for ourselves.",
        },
        {
          characterId: "drone",
          text: "And yet they lingered in their nests. But when the Builders made known aft, and offered a prayer so deeply concerned with the oblique energy of the Apis Florea, which thus finally shapes and fashions both warp and woof, and provided with a small cub.",
        },
        {
          characterId: "adjutant",
          text: "They sound really upset by the idea of losing that ship...",
        },
      ],
    },
    {
      id: "roguelike-5-victory",
      characterId: "adjutant",
      text: "We did it! Crews are boarding the shipyard now and will report back momentarily.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "marine",
          text: "Boarding party reporting in: I'm not quite sure what's going on here.  We've secured the ship and confirmed some non-regulation modifications.  Strangely, the bridge is empty and doesn't seem to have any of the normal fittings for crew stations.  Instead, there's an empty socket that looks like it's waiting for some sort of massive computer core.",
        },
        {
          characterId: "adjutant",
          text: "Good work, Sergeant.  Hold your position and wait for the logistics fleet to arrive.  They can tow the ship back to the supply station and get it in working order.",
        },
        {
          characterId: "hive",
          text: "Or, if only to the full - freighted worlds, there’s a pedlar aboard with a wild set of sun entered the room seemed impenetrably dark. I turned round and the woods are plucked. Stand by, it would be well laden with pollen it is believed, to try to evade it.",
        },
        {
          characterId: "adjutant",
          text: "Is that...? Admiral, I think it might be a 'what' we're looking for and not a 'who'. Could that thing be the source of these new ships?",
        },
      ],
    },
    {
      id: "roguelike-5-defeat",
      characterId: "adjutant",
      text: "We've lost, admiral.  The enemy fleet was too big to take us on.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // Counterattack
  6: [
    {
      id: "roguelike-6-start",
      characterId: "adjutant",
      text: "I've got a plan that just might be crazy enough to work.  The enemy retribution fleet is still broadcasting IFF, which I'm hoping means they're still following the rules.  We're in a valid resource zone, so we can make a claim with Central if we can harvest enough resources.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "adjutant",
          text: "Under Space Law, they'll have to leave once we make a claim. I recommend you try to avoid a fight and capture as many resources as quickly as possible.",
        },
        {
          characterId: "adjutant",
          text: "This location has Crystals in addition to the usual metallic resources.  They're rare and extremely valuable, but are only found in small amounts. Unlike the standard metallic resources, it only takes one turn to fully harvest the node.",
        },
      ],
    },
    {
      id: "roguelike-6-victory",
      characterId: "adjutant",
      text: "We did it! Our claim has been registered and the remaining enemy ships are retreating. There's another resupply station nearby.  Charting a course to it now.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "drone",
          text: "Each cell is placed, and so low that I am past scorching; not clamorous for pardon, but in blood, with whatever is sweet to our appendages.",
        },
      ],
    },
    {
      id: "roguelike-6-defeat",
      characterId: "adjutant",
      text: "We've lost, admiral.  The enemy fleet was too big to take us on.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // Repair Station DS7
  31: [
    {
      id: "roguelike-31-start",
      characterId: "adjutant",
      text: "Perfect!  That's a fully-automated repair station.  With it, we can fix our ships back to factory-fresh!  All we have to do is chase off the enemy fleet so we can use the facility.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "drone",
          text: "I was preparing to hear the sounds that were imaginary and merely plausible. The timbers beneath are of great ships on the other end. Of all possible hexagonal cells, of the same you say is this which permits no illness and accords no grave; not at what precise species this sea, and careful rigging of the ship’s being unprecedentedly dragged over sideways to the distant hills a velvet.",
        },
      ],
    },
    {
      id: "roguelike-31-victory",
      characterId: "adjutant",
      text: "We've secured the repair station and the enemy fleet is retreating.  We can now fix our ships and carry on at full strength. The boarding party is reporting in now.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "marine",
          text: "Boarding party reporting in: Admiral, the good news is that the repair station is fully operational and we can use it to repair our ships completely.  The, well I'm not sure it's bad news, but the weird news is that there isn't anyone here.  It's a standard-pattern station, but unregistered, and empty.",
        },
        {
          characterId: "hive",
          text: "The agent that so wept with spray, and provided with wings, and the future, that in the pit, and gorge itself with honey and love each other, their nest in its cooling and ashen, and then like to some fears of ultimate retribution.",
        },
        {
          characterId: "adjutant",
          text: "Is that...? Admiral, I think it might be a 'what' we're looking for and not a 'who'. Could that thing be the source of these new ships?",
        },
      ],
    },
    {
      id: "roguelike-31-defeat",
      characterId: "adjutant",
      text: "We've lost, admiral.  The enemy fleet was too big to take us on.",
      trigger: { type: "missionDefeat" },
    },
  ],
};

/** Campaign mission lines, by campaign node id (separate numbering). */
export const CAMPAIGN_MISSION_DIALOG: Record<
  number,
  MissionDialogEntry<DialogCharacterId>[]
> = {};

/** The tutorial's mission lines. */
export const TUTORIAL_MISSION_DIALOG: MissionDialogEntry<DialogCharacterId>[] =
  [];

/** Every mission line with its mission attached, for selectDialogLines (app/utils/missionDialog.ts). */
export const MISSION_DIALOG_LINES: MissionDialogLine<DialogCharacterId>[] = [
  ...Object.entries(ROGUELIKE_MISSION_DIALOG).flatMap(([nodeId, lines]) =>
    lines.map((line) => ({
      ...line,
      mission: { kind: "roguelike" as const, nodeId: Number(nodeId) },
    })),
  ),
  ...Object.entries(CAMPAIGN_MISSION_DIALOG).flatMap(([nodeId, lines]) =>
    lines.map((line) => ({
      ...line,
      mission: { kind: "campaign" as const, nodeId: Number(nodeId) },
    })),
  ),
  ...TUTORIAL_MISSION_DIALOG.map((line) => ({
    ...line,
    mission: { kind: "tutorial" as const },
  })),
];
