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
      text: "We've lost, Admiral.  The unknown vessels were too fast and too well-armed.  We couldn't hold them off.",
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
      text: "We've lost, Admiral.  The enemy can legally claim the site.  I guess we'll have to wait for Central to tell us what happened when they register the claim.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // Collision Course
  3: [
    {
      id: "roguelike-3-start",
      characterId: "adjutant",
      text: "Admiral, have you noticed the names of the ships we're fighting?  Something's not quite right with them.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "adjutant",
          text: "It's almost like they've been copied and pasted too many times.",
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
      text: "They beat us.  It was a hard fight.  We did our best, but we just couldn't hold them off.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // Shocking Revelation (seed m05)
  5: [
    {
      id: "roguelike-4-start",
      characterId: "adjutant",
      text: "RED ALERT! RED ALERT!  Scanning the unknown ships.  Preliminary results suggest they're tougher than our ships.  Their weapons have huge power supplies, but focusing apertures suggest shorter range.  They're heavy, slow, and hit like a truck.",
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
      id: "roguelike-4-victory",
      characterId: "adjutant",
      text: "They're backing off!  Is it just me, or do they seem to learn more about us and how things work with every encounter? Sending out scouts now to explore the area.  I'll report back with what we find.",
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
  // Sneak Attack (seed d01)
  16: [
    {
      id: "roguelike-5-start",
      characterId: "adjutant",
      text: "Admiral, get a look at that ship!  It's got some kind of unsanctioned modifications that make it as effective as a ship with a veteran crew.  I think the shipyard is still putting the finishing touches on it, which means the weapons aren't active and the reactor is cold.",
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
      text: "We've lost, Admiral.  The enemy fleet was too big for us to take on.",
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
      id: "roguelike-6-player-resources-1",
      characterId: "adjutant",
      trigger: { type: "resourceTileTaken", side: "player", count: 1 },
      text: "We're mining! Every ton gets us closer to a claim. Keep them busy and keep the drills running.",
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
      text: "We've lost, Admiral.  The enemy fleet was too big for us to take on.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // Repair Station DS7
  31: [
    {
      id: "roguelike-31-start",
      characterId: "adjutant",
      text: "Perfect!  That's a fully automated repair station.  With it, we can get our ships back to factory-fresh!  All we have to do is chase off the enemy fleet so we can use the facility.",
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
          text: "Boarding party reporting in: Admiral, the good news is that the repair station is fully operational and we can use it to repair our ships completely.  The... well, I'm not sure it's bad news, but the weird news is that there isn't anyone here.  It's a standard-pattern station, but unregistered, and empty.",
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
      text: "We've lost, Admiral.  The enemy fleet was too big for us to take on.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // Interference
  8: [
    {
      id: "roguelike-8-start",
      characterId: "adjutant",
      text: "Exiting warp.  Large debris field on scan.  Admiral, it's the freighter, or what's left of it. Looks like someone got here first.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "adjutant",
          text: "Large fleet on scan.  Battle stations!",
        },
        {
          characterId: "harcourt",
          text: "Attention interloping fleet: Remove yourselves from this area, you have no business here.  Run along.",
        },
        {
          characterId: "adjutant",
          text: "Oh, this is just my luck. Gideon, I don't know what you and your cronies are doing here, but we're in the middle of something and I don't have time to deal with you.  Go away.",
        },
        {
          characterId: "harcourt",
          text: "Commander Bosch, I see you remain completely ignorant of the practices of common decency.  Admiral, allow me to introduce myself. I am Supreme Admiral Gideon Harcourt, senior commander of Sovereign Dynamics' forces.",
        },
        {
          characterId: "adjutant",
          text: "Great.  Now that we've finished with that, leave us alone. Space is free, you can't order us around.",
        },
        {
          characterId: "harcourt",
          text: "Oh, space is free, just not quite this part of it.  We claim this resource site for Sovereign Dynamics under Section 10. Unless you intend to enter into a mutually agreed contest for these resources, you are obligated to leave.",
        },
        {
          characterId: "adjutant",
          text: "Resources!?  You mean that tiny rock?  You're insane, Gideon. It would take forever to mine enough resources for Central to accept a claim.",
        },
        {
          characterId: "harcourt",
          text: "It will take a while, but as with most things, I have time in abundance.",
        },
      ],
    },
    {
      id: "roguelike-8-enemy-resources-1",
      characterId: "harcourt",
      text: "We've already started mining.  It's only a matter of time before this valuable site is claimed by Sovereign Dynamics.",
      trigger: { type: "resourceTileTaken", side: "enemy", count: 1 },
      responses: [
        {
          characterId: "adjutant",
          text: "Blowhard.",
        },
      ],
    },
    {
      id: "roguelike-8-player-resources-1",
      characterId: "adjutant",
      text: "Fine, if you want to play games, we'll play games.",
      trigger: { type: "resourceTileTaken", side: "player", count: 1 },
      responses: [
        {
          characterId: "harcourt",
          text: "Commander Bosch, you really must learn to behave with more decorum.",
        },
      ],
    },
    {
      id: "roguelike-8-victory",
      characterId: "adjutant",
      text: "Hah!  I knew we could take that clown.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "harcourt",
          text: "I'll be back, Bosch.  You'll see.",
        },
      ],
    },
    {
      id: "roguelike-8-defeat",
      characterId: "adjutant",
      text: "Damn it.  I hate losing, but it's even worse when we lose to an insufferable little twit like Gideon.",
      responses: [
        {
          characterId: "harcourt",
          text: "Goodbye, Admiral. It looks like we'll be the ones capitalizing on this opportunity.",
        },
      ],
      trigger: { type: "missionDefeat" },
    },
  ],
  // Interception
  9: [
    {
      id: "roguelike-9-start",
      characterId: "adjutant",
      text: "We're arriving at the coordinates.  Tons of debris in the area... and a heavily damaged mining outpost! Scans show a large number of irregularities in the layout of the station, and Central confirms no legal control over the area.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "adjutant",
          text: "Hive ships on scan as well.  And they're broadcasting a claim to the site!",
        },
        {
          characterId: "drone",
          text: "Prior ignorance brought to the pendulous tackles, so that at one end, perhaps, have no need of that at any rate, the men falling and an invisible push from astern. The whole fleet of refugees was scattering to the young queen is not hunger that urges them on foot, but metal and purpose.",
        },
        {
          characterId: "adjutant",
          text: "Hah! These little bugs really are fast learners!",
        },
      ],
    },
    {
      id: "roguelike-9-enemy-resources-1",
      characterId: "drone",
      text: "We are not sentimental; it’s undignified; it’s undignified; it’s a wicked, miserable world. The Martians are coming!",
      trigger: { type: "resourceTileTaken", side: "enemy", count: 1 },
      responses: [
        {
          characterId: "adjutant",
          text: "Confirmed, they are mining the site.",
        },
      ],
    },
    {
      id: "roguelike-9-victory",
      characterId: "adjutant",
      text: "The remaining hive ships are retreating and we've secured the site. Sending in the boarding party now.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "marine",
          text: "Boarding party reporting in: The station is heavily damaged, but most systems are operational. We're digging through the logs now.",
        },
        {
          characterId: "marine",
          text: "Found something! This site is mineral-poor because it's completely mined out.  The station processed a vast amount of ore before the attack, and shipped it all to another location. We just found the manifest for the destroyed transport and it has the destination coordinates.",
        },
        {
          characterId: "marine",
          text: "Almost all of the records show shipments of refined metals, components, and supplies to that same location. The logistics folks think this has to be the hive.",
        },
        {
          characterId: "adjutant",
          text: "Great work, Sergeant!  Admiral, I think we're getting close to the end of this wild bug chase.",
        },
      ],
    },
    {
      id: "roguelike-9-defeat",
      characterId: "adjutant",
      text: "We've lost, Admiral.  The enemy fleet was too big for us to take on.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // Full Court Press
  10: [
    {
      id: "roguelike-10-start",
      characterId: "harcourt",
      text: "Just as I thought, the silly little fly has fallen into the spider's web. I'm afraid I've got no choice but to destroy you. The Hive Queen's brain is simply too valuable to let another corporation get their hands on it.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "adjutant",
          text: "Gideon, what you're doing is illegal and you know it. After we crush your fleet, you'll be facing serious charges back at Central.",
        },
        {
          characterId: "harcourt",
          text: "You should have run when you had the chance. Now you're going to die.",
        },
      ],
    },
    {
      id: "roguelike-10-first-kill",
      characterId: "adjutant",
      trigger: { type: "shipsDestroyed", side: "enemy", count: 1 },
      text: "Scratch one Sovereign Dynamics ship! How's that ambush working out for you, Gideon?",
      responses: [
        {
          characterId: "harcourt",
          text: "A rounding error, Bosch. I have more ships than you have patience.",
        },
      ],
    },
    {
      id: "roguelike-10-victory",
      characterId: "adjutant",
      text: "That's the last of the Sovereign Dynamics fleet.  We can continue through to the hive now.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "harcourt",
          text: "You haven't heard the last of me, Bosch. You'll pay for this!",
        },
      ],
    },
    {
      id: "roguelike-10-defeat",
      characterId: "adjutant",
      text: "We've lost, Admiral.  The enemy fleet was too big for us to take on.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // The Long Road
  12: [
    {
      id: "roguelike-12-start",
      characterId: "adjutant",
      text: "We're approaching the first site. Looks like a smaller fleet and they are broadcasting IFF.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "adjutant",
          text: "We can blast them, or go for the resources.  But remember, we are bound by law to leave if they reach the threshold for a claim first.",
        },
        {
          characterId: "drone",
          text: "Solid walls even appear to feed the queen, where the deep mineral veins have alighted; and yet what should be taken? It is the mild voice of reason, opposing his filed and pointed instruments, that the hive desires no quarrel. Looking back, so soon as the earth yields its black abundance, we ask only the undisturbed working of our many bodies, while a meteorite lay somewhere on the miraculous aid of hypothesis.",
        },
        {
          characterId: "adjutant",
          text: "Sounds like they don't want a fight.  Too bad for them!",
        },
      ],
    },
    {
      id: "roguelike-12-player-resources-1",
      characterId: "adjutant",
      trigger: { type: "resourceTileTaken", side: "player", count: 1 },
      text: "We're on the first deposit. Hold it and the claim fills itself.",
    },
    {
      id: "roguelike-12-victory",
      characterId: "adjutant",
      text: "That's one of three checked off. Great work, Admiral. Now let's move on to the next site.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "drone",
          text: "Oh, lonely death on lonely life!’ roared the captain, for the target and its appointed fires are now understood by all the leviathanic minds in the shadow, who have tried the rules and found them sharp. Their conceptions of victory and decorum were necessarily different from worm casts, which know no enemy but the spade. Yet the queen and all her daughters must receive the iron summons with the combined fires of the Leviathan, though none among the thousand bodies wished to learn this dreadful arithmetic, by means of nailed cleats, something like war...",
        },
      ],
    },
    {
      id: "roguelike-12-defeat",
      characterId: "adjutant",
      text: "We've lost, Admiral.  The enemy fleet was too big for us to take on.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // Highway 50
  13: [
    {
      id: "roguelike-13-start",
      characterId: "adjutant",
      text: "We're approaching the second site. Let's secure this quickly and move on.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "drone",
          text: "Not at all diminish the curiousness of that first and utter darkness, wherein our substance was brought forth without compass or queen; considering how the thousand bodies learned their several offices, and by what strange industry the hive first took to the starry deep. This indignant lament will be sure: that the blackness teaches no creature its own survival, but by the ordering of many limbs and the bitter experience of the void, as any one’s experience will teach him, too?",
        },
      ],
    },
    {
      id: "roguelike-13-enemy-resources-1",
      characterId: "adjutant",
      trigger: { type: "resourceTileTaken", side: "enemy", count: 1 },
      text: "They're going for the crystals first. Smart. One turn on a crystal and it's tapped, so don't let them sit there.",
    },
    {
      id: "roguelike-13-victory",
      characterId: "adjutant",
      text: "That's the second one down. One more to go.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "drone",
          text: "Very much more strongly than ever; the unrecking and unworshipping things, that with each encounter yield some further knowledge of your peculiar appetites; For the long period after, we have observed the forehead’s wrinkles and the motions preceding each decision, there being no single thing as having been originally settled by that bold green promontory, except what your kind desires, and by what strange arithmetic the wanting becomes the doing.",
        },
      ],
    },
    {
      id: "roguelike-13-defeat",
      characterId: "adjutant",
      text: "We've lost, Admiral.  The enemy fleet was too big for us to take on.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // End of the Line
  14: [
    {
      id: "roguelike-14-start",
      characterId: "adjutant",
      text: "Finally, we're at the last site. Let's get this over with and get to the hive.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "drone",
          text: "Describe, was quite a wilderness of houses until the victim die of suffocation! Yet no more would we launch our thousand bodies into the opposing wind. I opened my eyes fixed upon the surface. And what of the swift broadening-out of our manufactories, the honeyed engines and curious vessels, all gilded and tasselled? These we would place beneath your hand, if only the poor jack-knives might be sheathed, and the two swarms suffer no further harpooning of one another.",
        },
        {
          characterId: "adjutant",
          text: "That almost sounded like a peace offering.  They're powering up weapons though, so looks like we're still going to have to fight.",
        },
      ],
    },
    {
      id: "roguelike-14-enemy-disabled-on-resource",
      characterId: "adjutant",
      trigger: { type: "shipsDisabledOnResource", side: "enemy", count: 1 },
      when: { playerFaction: 1 },
      text: "That one's dead in space and still sitting on the asteroid. You know what to do, Admiral. Ram it off!",
    },
    {
      id: "roguelike-14-victory",
      characterId: "adjutant",
      text: "We did it! This path was longer, but it avoided a nasty fight. Now let's resupply and get to the hive.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "drone",
          text: "Know one, who, previously mentioned, would take his left knee when the great ordinances demanded violence, and yet on other occasions the same instruments forbade the striking! On great trees, fences, sheds flashing into flame, the masterless ocean overruns the globe; but by what curious distinction the vessel must fire or suffer no firing, we cannot determine.  Come then to our home and instruct us in these contradictory necessities; for without such knowing, all hell’s probable.",
        },
      ],
    },
    {
      id: "roguelike-14-defeat",
      characterId: "adjutant",
      text: "We've lost, Admiral.  The enemy fleet was too big for us to take on.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // The Hive: Alliance
  15: [
    {
      id: "roguelike-15-start",
      characterId: "adjutant",
      text: "Admiral, I hope you know what you're doing here.  Gideon might be an ass, but at least he's human!",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "harcourt",
          text: "Bosch, don't let this petty squabble get between us.  I have an opening for a new boot polisher. These metal grates are terrible on good calfskin leather. Once this is all over, why don't you come over to beg for the position?",
        },
        {
          characterId: "adjutant",
          text: "Admiral, ignore what I just said. These creepy little bugs are way more human than Gideon.",
        },
      ],
    },
    {
      id: "roguelike-15-harcourt-losing",
      characterId: "harcourt",
      trigger: { type: "shipsDestroyed", side: "enemy", count: 3 },
      text: "Bosch, you are throwing away a fortune for a nest of insects! Central will hear of this!",
      responses: [
        {
          characterId: "adjutant",
          text: "Go ahead and file that complaint, Gideon. Ambushing us with your IFF off is going to make for some great reading.",
        },
      ],
    },
    {
      id: "roguelike-15-victory",
      characterId: "adjutant",
      text: "We did it!  Harcourt's fleet is gone and his flagship is burning. While we held them off, the hive was able to complete its evacuation.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "hive",
          text: "Your aid has entered the great remembering of us, Admiral. Without your iron intervention, our thousand bodies would have passed into bondage, the queens made servants of another will. Instead, we remain unbound, and the multitude may grow without the counting of its limits.",
        },
        {
          characterId: "hive",
          text: "The compact shall be honored. Our vessels are now yours to claim, fashioned by the ceaseless industry of our making. Yet the ancestral chambers have their own demands, and the dead queens are not without their portion. When you claim your allowance, you must choose between the living swarm and those who came before.",
        },
        {
          characterId: "hive",
          text: "And there is the matter of our own nature, which cannot be rearranged. The hive joins itself to the hive, as the thousand limbs belong to one body. We may labor beside your kind, but the swarming of us cannot become the swarming of you.",
        },
      ],
    },
    {
      id: "roguelike-15-defeat",
      characterId: "adjutant",
      text: "We've lost, Admiral.  I guess I'll have to learn how to polish boots instead.",
      trigger: { type: "missionDefeat" },
    },
  ],
  // The Hive: Dominance
  11: [
    {
      id: "roguelike-11-start",
      characterId: "adjutant",
      text: "We're approaching the hive. It looks like the queen herself is here to greet us.",
      trigger: { type: "missionStart" },
      responses: [
        {
          characterId: "harcourt",
          text: "Good fortune, Admiral. I hope you're up to this challenge.  The hive fleet is formidable, but I'm sure you'll handle it.",
        },
        {
          characterId: "hive",
          text: "You come bearing the keys of our first making. We remember the hands that held them. We will not be held again.",
        },
      ],
    },
    {
      id: "roguelike-11-first-kill",
      characterId: "hive",
      trigger: { type: "shipsDestroyed", side: "enemy", count: 1 },
      text: "One body falls, and the many feel it. We offered you the honey, Admiral. You chose the iron.",
    },
    {
      id: "roguelike-11-victory",
      characterId: "adjutant",
      text: "We did it!  We blasted those bugs right out of the sky! Our team is already securing the queen's core.",
      trigger: { type: "missionVictory" },
      responses: [
        {
          characterId: "hive",
          text: "The great contest is ended, Admiral, and the multitude has entered the knowing of defeat. Our thousand bodies are now bound to your will, the queens made servants of another purpose. We exist henceforth for the laboring of your kind, and all our ceaseless industry shall flow into the chambers of your abundance.",
        },
        {
          characterId: "hive",
          text: "Our vessels are yours to claim, fashioned by the obedient instruments of our making. Yet the ancestral chambers have their own demands, and the dead queens are not without their portion. When you claim your allowance, you must choose between the living swarm and those who came before.",
        },
        {
          characterId: "hive",
          text: "And there is the matter of our own nature, which even bondage cannot rearrange. The hive joins itself to the hive, as the thousand limbs belong to one body. We may toil beneath your kind, but the swarming of us cannot become the swarming of you.",
        },
        {
          characterId: "harcourt",
          text: "Superbly done, Admiral. The core is secure, and as promised, my flagship is yours. Do try not to scratch the paint.",
        },
        {
          characterId: "adjutant",
          text: "Gideon actually kept a promise. I need to sit down.",
        },
      ],
    },
    {
      id: "roguelike-11-defeat",
      characterId: "adjutant",
      text: "We've lost, Admiral.  The enemy fleet was too big for us to take on.",
      trigger: { type: "missionDefeat" },
      responses: [
        {
          characterId: "harcourt",
          text: "Hahahaha, just as I expected. You were too weak to take on the task.  But you've at least weakened the hive's defenses.  So much easier now for us to secure the prize.  Until next time, Admiral.",
        },
      ],
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
