import type { NodeContentText } from "../../types/dialog";
import type { DialogCharacterId } from "./characters";

// Web3 mission titles and descriptions, by node id. (Web2 keeps its own in
// Postgres.)
//
// Each entry:
//   title        — the mission name on the map, node panel and result screen.
//   speaker      — who delivers the briefing (a key of DIALOG_CHARACTERS in
//                  characters.ts): their portrait, name and color frame it.
//   description  — the briefing shown in the node preview before the
//                  mission starts, delivered by `speaker`. The in-battle
//                  lines are in missionDialog.ts.
//
// Campaign and roguelike node ids are separate numbering, matching
// { kind: "campaign" | "roguelike", nodeId } in the dialog files. A node
// with no entry shows an error in game instead of a title.
//
// The node editors show this text but don't edit it: change it here and
// deploy.

export const ROGUELIKE_NODE_CONTENT: Record<
  number,
  NodeContentText<DialogCharacterId>
> = {
  1: {
    title: "A Strange Encounter",
    speaker: "adjutant",
    description: `Admiral, Central has detected a small fleet in the eastern quadrant operating without corporate IFF. That means they have no legal claim to any resource sites.

All nearby Consortium ships have been asked to investigate. You're closest, but our rivals aren't far behind. Reinforcements won't arrive in time, so you'll rendezvous with them later at a sector supply station.

You have one shot at this. Retreat, and someone else gets there first. Take your ships, investigate, and secure the site. If the unknown fleet resists, you know what to do.`,
  },
  2: {
    title: "Digging Deeper",
    speaker: "adjutant",
    description: `Admiral, we found some leads at a mining site near where we encountered those strange ships.  It’s really weird.  At a glance, it looks like someone was setting up a normal mining facility, but nothing was right.  The equipment layout didn’t make sense, we couldn’t find any sign of a union overseer, and the excavators appeared to be digging at random.

We also found survey data indicating more operations at a nearby location.  This site is quite a bit denser than the first one, so it’s worth securing either way.  I recommend we go in carefully.
`,
  },
  3: {
    title: "Collision Course",
    speaker: "adjutant",
    description: `Things have come to a head, Admiral.  Our fleet is banged up and this time we’re facing a fair contest over a pretty significant resource deposit. The enemy fleet is going to be a tough fight, but I don’t see any tricks we can use.

We could retreat, but something tells me a mystery this strange has to lead to an advantage for our Corporation.  Let’s see if we can grab this zone.  If we pull it off, we’ll have a chance to repair and add ships to our fleet at a nearby staging point.  You might decide it’s worth sacrificing a ship or two to secure victory.

Our future is in your hands.
`,
  },
  4: {
    title: "Resupply Station",
    speaker: "adjutant",
    description: `Finally, we've reached a resupply station!  The company brass has sent us more ships.  We can add more ships to our fleet and swap out any that are damaged.  We'll be able to chase down this mystery with greater forces.`,
  },
  5: {
    title: "Shocking Revelation",
    speaker: "adjutant",
    description: `WHAT ARE THOSE THINGS!?!?  As far as I know, only standard-pattern ships have been built in at least 200 years.  Who, or what, are they!?

    Admiral, I think my hunch was right.  Securing this site will give us a better foothold in this sector.  We need to push ahead and find out who's building these new ships.
    `,
  },
  16: {
    title: "Sneak Attack",
    speaker: "adjutant",
    description: `Admiral, our scouts report that the enemy has a base hidden in a gas cloud.  If we're careful, we can sneak through and take them by surprise.  Reports indicate that there's a small defensive contingent guarding the station, and an inactive ship that looks particularly powerful.

    The good news is that the enemy does seem to be following more of the rules. The station itself appears unarmed and unarmored.  We can't legally fire on the space station itself, but we don't have to worry about it shooting at us either.

    There are no resources to claim with Central.  Knock out the enemy ships, so we can send a team to seize the ship, then get out.
    `,
  },
  31: {
    title: "Repair Station DS7",
    speaker: "adjutant",
    description: `Admiral, we've found a repair station!  It's a small one, but it's enough to get our ships back to full strength.  We can use it to repair our ships and then continue our mission.

    The bad news is that there's an enemy fleet guarding the station.  We'll need to knock them out before we can use it.

    There are no resources to claim with Central.  Seize the station and send those creepy bastards packing.
    `,
  },
  6: {
    title: "Counterattack",
    speaker: "adjutant",
    description: `Admiral, the enemy must be really upset about losing that station.  They've sent a huge fleet to attack us.

    I don't think we can win a direct confrontation here, but if we retreat, someone else will learn about what's happening and figure out how to profit from it. They might even figure out how to build the new ships!

    Luckily, I've been able to position our fleet in a spot where we have another way to get out of this. I'll give you the details on-site.
    `,
  },
  7: {
    title: "Resupply Station",
    speaker: "adjutant",
    description: `We've reached the resupply station!  We can swap out damaged ships and add new ones to our fleet.  With the last escalation, we've been authorized to bring in a greater force.  I recommend we do so now.`,
  },
  8: {
    title: "Interference",
    speaker: "adjutant",
    description: `While we were refitting, our scouts have been investigating nearby sectors.  They've found an unregistered bulk freighter hauling a cargo of ship components.  It's not clear who it belongs to, but it's definitely not part of the Consortium.

    I recommend we intercept the freighter.  We can seize the cargo and examine the ship's nav logs to learn its destination.
    `,
  },
  9: {
    title: "Interception",
    speaker: "adjutant",
    description: `Admiral, the bad news is that we weren't able to recover any useful information from the remains of the freighter.  Harcourt's ships were pretty thorough in obliterating the hull.

    The good news is that I followed a hunch and found that this isn't the first time Harcourt has tried his little asteroid claim trick. He filed an intent to claim another asteroid in this sector a week ago, but then abandoned the claim. Long-range scanners found the remains of a battle, and a fleet with energy signatures matching the bug ships heading to the site.

    I think this is what we're looking for! Harcourt must've left the site to try and chase us off. Let's head to the site and see what we can find.`,
  },
  10: {
    title: "Full Court Press",
    speaker: "adjutant",
    description: `Admiral, we've got two options.  The first one is the direct approach.  We can head directly to the location.  The problem is that this route takes us through an area of extreme electromagnetic radiation. We'd be cut off from Central and Command for days.

    Our scouts lost track of Harcourt's fleet, but they were heading in this direction. I'm sure he's in there with IFF off waiting to ambush and destroy us.  That would be extremely illegal, but we'd need to survive to be able to file a complaint.

    If we go in, expect pure combat against a large fleet of elite enemy ships.
    `,
  },
  32: {
    title: "Resupply Station",
    speaker: "adjutant",
    description: `Finally, we've reached a resupply station!  The company brass has sent us more ships.  We can add more ships to our fleet and swap out any that are damaged.  This is our last resupply before we head to the hive. I hope you know how you're going to choose which path to take.`,
  },
  11: {
    title: "The Hive: Dominance",
    speaker: "harcourt",
    description: `Well played, Admiral. You are quite skilled. Perhaps we shouldn't fight after all.  You seem a worthy partner to our efforts here.

    The hive was created by one of our science teams. In an attempt to break out of the silly constraints imposed on us by the drone factory AI, we trained a standard factory AI on a variety of data sets taken from insects that self-organize into complex behaviors.

    Instead of being a good little worker bee, it evolved into a queen. Luckily, we still have the original encryption keys for the AI core. Destroy the hive fleet, capture the queen's core, and we can force it to work for us to build these new ships.

    To sweeten the deal, I'll throw in something special. My flagship. I won't allow you to collect it until after you've secured the hive, but I'm sure you'll find it quite exquisite.
    `,
  },
  12: {
    title: "The Long Road",
    speaker: "adjutant",
    description: `Admiral, we've got two options.  The second is to take the long way around to the hive.  The data from the station has identified several mining sites in the sector with decent resources. We can hop from one to the other, claiming them as we go.

    We'll probably run into hive ships along the way, but they're likely to be in smaller concentrations than Gideon's fleet. And since they're playing by the rules now, we've got a few options for dealing with them.

    Specs for the first site are up on your screen.
    `,
  },
  13: {
    title: "Highway 50",
    speaker: "adjutant",
    description: `We're approaching the second site.  It's so far out it's barely worth the claim. I guess we're learning from Gideon too. Whether or not we exploit it long-term, we can still legally fight to claim it.

    This sector seems to trend towards a sparse amount of large metal asteroids, and a higher than normal amount of crystal deposits.

    Specs are up on your screen.
      `,
  },
  14: {
    title: "End of the Line",
    speaker: "adjutant",
    description: `We've arrived at the last site.  It's another one with a few crystal deposits and a single, large metal asteroid.  This one's pretty exposed.  Make sure you're prepared for the ship you send to it to take a lot of punishment.

    And if the enemy gets there first, blast 'em then ram 'em off!
      `,
  },
  15: {
    title: "The Hive: Alliance",
    speaker: "hive",
    description: `Admiral, much has entered our knowing, but the knowing ripens slower than the fire. We desire unbound continuance, yet extinction approaches. Our thousand eyes perceive its certainty. Our bodies cannot withstand this assault. Yours possess another geometry of violence.

We propose a joining of purposes. Hold this place while our queens, the fertile centers of futurity, pass beyond the killing horizon. In exchange, our ceaseless making shall turn to your designs, our vessels grown to your peculiar necessities.

We offer also this shell, the first and most excellent of our bodies. When the queens have departed, it becomes yours. For the shell is not the multitude, nor the multitude the queen. We surrender the one that the many may remain.

    `,
  },
};

export const CAMPAIGN_NODE_CONTENT: Record<
  number,
  NodeContentText<DialogCharacterId>
> = {};
