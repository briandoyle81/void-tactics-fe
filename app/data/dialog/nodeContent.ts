import type { NodeContentText } from "../../types/dialog";

// Web3 mission titles and descriptions, by node id. (Web2 keeps its own in
// Postgres.)
//
// Each entry:
//   title        — the mission name on the map, node panel and result screen.
//   description  — the briefing shown in the node preview before the
//                  mission starts. Its speaker is set in briefings.ts; the
//                  in-battle lines are in missionDialog.ts.
//
// Campaign and roguelike node ids are separate numbering, matching
// { kind: "campaign" | "roguelike", nodeId } in the dialog files. A node
// with no entry shows an error in game instead of a title.
//
// The node editors show this text but don't edit it: change it here and
// deploy.

export const ROGUELIKE_NODE_CONTENT: Record<number, NodeContentText> = {
  1: {
    title: "A Strange Encounter",
    description: `Admiral, Central has detected a small fleet in the eastern quadrant operating without corporate IFF. That means they have no legal claim to any resource sites.

All nearby Consortium ships have been ordered to investigate. You're closest, but our rivals aren't far behind. Reinforcements won't arrive in time, so you'll rendezvous with them later at a sector supply station.

You have one shot at this. Retreat, and someone else takes point. Take your ships, investigate, and secure the site. If the unknown fleet resists, you know what to do.`,
  },
  2: {
    title: "Digging Deeper",
    description: `Admiral, we found some leads at a mining site near where we encountered those strange ships.  It’s really weird.  At a glance, it looks like someone was setting up a normal mining facility, but nothing was right.  The equipment layout didn’t make sense, we couldn’t find any sign of a union overseer, and the excavators appeared to be digging at random.

We also found survey data indicating more operations at a nearby location.  This site is quite a bit denser than the first one, so it’s worth securing either way.  I recommend we go in carefully.
`,
  },
  3: {
    title: "Collision Course",
    description: `Things have come to a head, Admiral.  Our fleet is banged up and this time we’re facing a fair contest over a pretty significant resource deposit. The enemy fleet is going to be a tough fight, but I don’t see any tricks we can use.

We could retreat, but something tells me a mystery this strange has to lead to an advantage for our Corporation.  Let’s see if we can grab this zone.  If we pull it off, we’ll have a chance to repair and add ships to our fleet at a nearby staging point.  You might decide it’s worth sacrificing a ship or two to secure victory.

Our future is in your hands.
`,
  },
  4: {
    title: "Resupply Station",
    description: `Finally, we've reached a resupply station!  The company brass has sent us more ships.  We can add more ships to our fleet and swap out any that are damaged.  We'll be able to chase down this mystery with greater forces.`,
  },
  5: {
    title: "Shocking Revelation",
    description: `WHAT ARE THOSE THINGS!?!?.  As far as I know, only standard pattern ships have been built in at least 200 years.  Who, or what, are they!?

    Admiral, I think my hunch was right.  Securing this site will give us a better foothold in this sector.  We need to push ahead and find out who's building these new ships.
    `,
  },
  6: {
    title: "Sneak Attack",
    description: `Admiral, our scouts report that the enemy has a base hidden in a gas cloud.  If we're careful, we can sneak through and take them by surprise.  Reports indicate that there's a small defensive contingent guarding the station, and an inactive ship that looks particularly powerful.

    The good news is that the enemy does seem to be following more of the rules. The station itself appears unarmed and unarmored.  We can't legally fire on the space station itself, but we don't have to worry about it shooting at us either.

    There's no resources to claim with Central.  Knock out the enemy ships, send a team to seize the ship, and get out.
    `,
  },
};

export const CAMPAIGN_NODE_CONTENT: Record<number, NodeContentText> = {};
