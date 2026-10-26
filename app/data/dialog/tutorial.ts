// All of the tutorial's ("First Contact") player-facing text: Adjutant
// Bosch's briefing on the Operations map, each step's panel (title, what she
// says, and the numbered orders), and the completion card. The step logic
// lives in app/data/tutorialSteps.ts; the panels are built in
// TutorialGridPanelConfigs.tsx.
//
// Emphasis markup: wrap words in {tone|...} to color them, e.g.
//   "We've traded losses with the {red|enemy}."
// Tones:
//   cyan    ours, names of our ships, UI labels   cyan!   bold cyan
//   amber   stakes, key terms                     amber!  bold amber
//   red     the enemy, their ships                green   movement, Submit
//   purple  nebulae, reactor damage, Last Move    dust    places (dim amber)
//   plasma  weapon names (dim cyan)
// Icons: {icon|reactor} draws the board's reactor-damage marker (a red
// circle with a white X).
// Anything else is plain text. Each brief entry is one paragraph.
// On touch screens "Hover"/"hover" reads as "Tap"/"tap" automatically.

export interface TutorialPanelText {
  title: string;
  /** Paragraphs, in order. */
  brief: string[];
  /** The numbered orders under the brief. */
  tasks?: string[];
  /**
   * Paragraphs Bosch adds to the round report (the between-rounds modal)
   * when this step opens a new round.
   */
  roundReport?: string[];
}

/** Before the battle: the "First Contact" node on the Operations map. */
export const TUTORIAL_PRELUDE = {
  title: "First Contact",
  /** Who delivers the briefing (a key of DIALOG_CHARACTERS). */
  speaker: "adjutant" as const,
  briefing:
    "Admiral, welcome aboard. I'm Adjutant Bosch, your second in command. I'm glad Headquarters sent you to help us out. There's an engagement already underway in the outer dust belts. I'll be on comms the whole way and walk you through it.",
};

/** Each step's panel, by step id (app/data/tutorialSteps.ts). */
export const TUTORIAL_PANELS: Record<string, TutorialPanelText> = {
  welcome: {
    title: "Welcome aboard",
    brief: [],
    // In the round 1 report instead of a panel.
    roundReport: [
      "{cyan!|Admiral}, welcome aboard. You're arriving mid-fight. We're {amber|behind on the board}, but with {cyan!|you on station} we can turn this around.",
      "We're fighting in the {dust|outer dust belts} over {amber|sparse resources}. Under {amber|Space Law}, whoever exploits a site first keeps it. Out here, that's the rule that matters.",
    ],
  },
  goals: {
    title: "How we win",
    brief: [
      "Each round, ships mine resources they control. {cyan|Central} has set the claim minimum at {amber!|100} tons to claim this {dust|resource cluster}.",
      "Current tally: {cyan|60} tons us, {red|70} tons them. We're {amber|in the hole}, but {cyan!|the fight is still yours to take}.",
    ],
  },
  "select-ship": {
    title: "Select a Ship",
    brief: [
      "{amber|What's left of} our {cyan|fleet} is ready for your {amber|inspection}.",
      "Click to see a ship's move and threat range, hover for details.",
    ],
  },
  "view-enemy": {
    title: "Inspect Enemy Ships",
    brief: [
      "The {red|enemy} holds the {dust|right side} of the map. Our sensors can show us their stats and abilities.",
      "Enemy ships appear in {red|red} in the {cyan|FLEET STATUS} panel — use it to quickly locate them on the grid.",
    ],
  },
  "move-ship": {
    title: "Move Your Ship",
    brief: [
      "The {cyan|Sentinel} is damaged. You can protect it by moving it into a {purple|nebula}.",
      "Nebula tiles block line of sight. Inside a nebula, ships can only shoot or be shot by ships exactly {amber|1 tile} away.",
    ],
  },
  "wait-for-opponent": {
    title: "Previous Position",
    brief: [
      "After a ship moves, both you and your opponent can see the {purple|Last Move} of the ship on the map.",
      "This helps you track how ships moved during the turn so you can see what changed.",
    ],
  },
  "score-points": {
    title: "Scoring zones",
    brief: [
      "At round end, each scoring zone we {amber|controlled} by a functioning ship (not disabled) counts toward points.",
      "The enemy destroyer moved to capture a resource. Respond by moving the {cyan|Resolute} to claim one for us.",
    ],
  },
  shoot: {
    title: "Move and Return Fire",
    brief: [
      "The {red|Hammer} just hit the {cyan|Resolute} with a plasma shot!",
      "Answer with the {cyan|Vigilant}. It has a long range railgun, so you can move to secure a resource and still shoot back.",
    ],
  },
  "end-of-round": {
    title: "End of round",
    brief: [],
    // Shown in the round report (the game's between-rounds modal) instead
    // of the panel.
    roundReport: [
      "When {amber|both sides} have moved all their ships, the round ends, and points are awarded for resources held. Movement markers clear and the {cyan|first player} swaps: whoever went second last round leads this one.",
    ],
  },
  "special-emp": {
    title: "EMP",
    brief: [
      "The {red|Anvil} just blasted the {cyan|Resolute}!",
      "We have a powerful gun, but we still can't knock it out in one hit. Luckily, the {red|Anvil} has {purple|reactor damage} ({icon|reactor}) from earlier in the fight. We can bypass its defenses and kill it instantly with an {cyan|EMP}!",
    ],
  },
  "ship-destruction": {
    title: "Aftermath",
    brief: [
      "Resolute's EMP pushed the {red|Anvil}'s reactor past {amber|three overload points}. The stack detonates in a blinding flash and the ship is destroyed!",
      "No ship survives once its reactor reaches three overload points ({icon|reactor}).",
    ],
  },
  rescue: {
    title: "Hard choice",
    brief: [
      "The {red|enemy} retaliated by disabling the {cyan|Resolute}. It also has {purple|reactor damage} ({icon|reactor}), so one more hit and it's gone! Even worse, your repair ship is too far away to reach it in time.",
      "We're at the end: Whoever holds the center wins. What matters the most to you?",
    ],
    tasks: [
      "{cyan|Save your ship:} select the Resolute and {green|submit} Retreat to leave the map.",
      "{cyan|Sacrifice for victory:} select the Vigilant, target the {red|Hammer}, then {green|submit} the shot.",
    ],
  },
  "rescue-outcome-sniper": {
    title: "Accepting a Sacrifice",
    brief: [
      "As expected, the {red|Hammer} destroyed the {cyan|Resolute}.",
      "You traded that ship for the ability to retake the center resource. The resource point is open now. Take it with the {cyan|Sentinel}.",
    ],
  },
  "rescue-outcome-retreat": {
    title: "The Resolute is Safe",
    brief: [
      "The {cyan|Resolute} is safely off the map!",
      "You saved the hull, but the middle resource tile is undefended. The {red|Hammer} can step in and secure it. That puts them over the threshold and {cyan|Central} will award them control of this region.",
    ],
  },
  "completion-sniper": {
    title: "Victory Achieved!",
    brief: [
      "{green|Victory}! You secured the center resource and guaranteed the win!",
      "You gave up the {cyan|Resolute} to earn that opening. In the outer dust clouds, victory comes at a cost.",
    ],
  },
  "completion-retreat": {
    title: "Planning Ahead",
    brief: [
      "{amber|Live to fight again.} The {red|Hammer} claimed the center resource, which puts the {red|enemy} over the threshold.",
      "You {amber|lost} this engagement, but you kept your most {cyan|powerful ship}. Sometimes you must accept the loss of a battle to win the war.",
    ],
  },
};

/** The toast when the player tries something the current step doesn't allow. */
export const TUTORIAL_NOT_ALLOWED = {
  select: "Selection Not Allowed Now",
  move: "Move Not Allowed Now",
  /** A move step, but not to one of the marked tiles. */
  moveToMarked: "Move to Marked Spot",
  shoot: "Shot Not Allowed Now",
  special: "Special Not Allowed Now",
  assist: "Assist Not Allowed Now",
  claim: "Claim Not Allowed Now",
  other: "Action Not Allowed Now",
};

/**
 * A step with round report words and nothing for the panel (End of round):
 * it's shown as the round report alone, Acknowledged moves on, and Prev from
 * the next step skips back past it.
 */
export function isReportOnlyStep(stepId: string | undefined): boolean {
  if (!stepId || !Object.hasOwn(TUTORIAL_PANELS, stepId)) return false;
  const panel = TUTORIAL_PANELS[stepId];
  return (
    !!panel.roundReport?.length &&
    panel.brief.length === 0 &&
    !panel.tasks?.length
  );
}

/** The orders heading on the "Hard choice" step (shown pulsing red). */
export const TUTORIAL_DECISION_LABEL = "Make your decision";

/** The completion card under either ending's brief. */
export const TUTORIAL_COMPLETION_CARD = {
  headline: "Take your fleet live",
  /** Opened from the Operations map in web2 (no reward claim). */
  continueHeadline: "On to the operation",
  winSupporting:
    "You held the line in the battle. Claim {amber|2 free ships}, put this win on your record, and join the fight against other admirals.",
  lossSupporting:
    "You banked power when it mattered. {cyan|Log in} to claim {amber|3 free ships}, fight, log this loss on your record, and join the fight against other admirals.",
  continueSupporting:
    "Headquarters has seen what you can do. Next, pick the {amber|ships} you'll take into the operation.",
  buttons: {
    claimWin: "Claim 2 ships + win",
    claimLoss: "Claim 3 ships + loss record",
    claiming: "Claiming...",
    signIn: "Sign in to claim your ships",
    verify: "Verify with Selfie Check to claim",
    verifying: "Verifying…",
    rewardClaimed: "Reward Claimed / View Ships",
    continueToFleet: "Continue to fleet selection",
  },
};
