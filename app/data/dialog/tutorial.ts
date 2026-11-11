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
//   purple  nebulae, reactor damage               dust    places (dim amber)
//   plasma  weapon names (dim cyan)
// Icons: {icon|reactor} draws the board's reactor-damage marker (a red
// circle with a white X).
// Anything else is plain text. Each brief entry is one paragraph.
// On touch screens "Hover"/"hover" reads as "Tap"/"tap" automatically.

export interface TutorialPanelText {
  title: string;
  /** Paragraphs, in order. */
  brief: string[];
  /**
   * The brief where there's no Fleet Status panel beside the board (phones
   * and narrow windows), for a step whose brief points at that panel.
   */
  briefWithoutFleetStatus?: string[];
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
      "You're arriving mid-fight, {cyan!|Admiral}. We're {amber|behind on the board}, but with {cyan!|you on station} we can turn this around.",
      "We're fighting in the {dust|outer dust belts} over {amber|sparse resources}. Under {amber|Space Law}, whoever exploits a site first keeps it. Out here, that's the rule that matters.",
    ],
  },
  goals: {
    title: "How we win",
    brief: [
      "Each round, ships mine the {amber|resources} they control. {cyan|Central} has set the {amber|claim minimum} at {amber!|100} tons to claim this {dust|resource cluster}.",
      "Current tally: {cyan|60} tons us, {red|70} tons them. We're behind, but only by {amber!|10}.",
    ],
  },
  "select-ship": {
    title: "Select a ship",
    brief: [
      "What's left of our {cyan|fleet} is ready for your {amber|inspection}.",
      "Click a ship to see its {green|move range} and {red|threat range}. Hover over it for details.",
    ],
  },
  "view-enemy": {
    title: "Find the Tongs",
    brief: [
      "The {red|enemy} holds the {dust|right side} of the map. Our sensors can show us each ship's {amber|stats and abilities}.",
      "Find the {red|Tongs} and click it. Enemy ships are listed in {red|red} under {cyan|Fleet Status}; hover over one there to see where it is on the board.",
    ],
    briefWithoutFleetStatus: [
      "The {red|enemy} holds the {dust|right side} of the map. Our sensors can show us each ship's {amber|stats and abilities}.",
      "Find the {red|Tongs} and tap it. The {red|enemy} ships are marked on the board; tap one to see its name and stats.",
    ],
  },
  "move-ship": {
    title: "Move your ship",
    brief: [
      "The {cyan|Sentinel} is {amber|damaged}. You can protect it by {green|moving} it into a {purple|nebula}.",
      "{purple|Nebula} tiles block {amber|line of sight}. Inside a nebula, ships can only shoot or be shot by ships exactly {amber|1 tile} away.",
    ],
  },
  "wait-for-opponent": {
    title: "Taking turns",
    brief: [
      "After you move a single ship, it's the {red|other admiral's} turn to move one of theirs.",
      "You'll take turns moving {amber|one ship at a time}, and each ship can move {amber|exactly once per round}.",
      "Watch the {red|Tongs} move. You can also click {cyan|Last Move} to see it again.",
    ],
  },
  "score-points": {
    title: "Scoring zones",
    brief: [
      "At round end, each {amber|scoring zone} we control with a functioning ship (not disabled) earns us {amber|points}.",
      "The {red|Tongs} moved onto a {amber|resource}. Answer by {green|moving} the {cyan|Resolute} onto the center resource.",
    ],
  },
  shoot: {
    title: "Move and return fire",
    brief: [
      "The {red|Hammer} just hit the {cyan|Resolute} with a {plasma|plasma shot}!",
      "Answer with the {cyan|Vigilant}. It has a {plasma|long-range railgun}, so it can {green|move} onto a {amber|resource} and still shoot back.",
    ],
  },
  "end-of-round": {
    title: "End of round",
    brief: [],
    // Shown in the round report (the game's between-rounds modal) instead
    // of the panel.
    roundReport: [
      "When {amber|both sides} have moved all their ships, the {amber|round ends}, and points are awarded for {amber|resources held}. Movement markers clear and the {cyan|first player} swaps: whoever went second last round leads this one.",
    ],
  },
  "special-emp": {
    title: "EMP",
    brief: [
      "The {red|Anvil} just blasted the {cyan|Resolute}!",
      "We have a powerful gun, but we still can't knock it out in one hit. Luckily, the {red|Anvil} has {purple|reactor damage} ({icon|reactor}) from earlier in the fight. We can bypass its defenses and kill it instantly with an {cyan|EMP}.",
    ],
  },
  "ship-destruction": {
    title: "Aftermath",
    brief: [
      "The {cyan|Resolute}'s {cyan|EMP} pushed the {red|Anvil}'s reactor past {amber|three overload points}. The stack detonates in a blinding flash and the ship is destroyed!",
      "No ship survives once its reactor reaches {amber!|three overload points} ({icon|reactor}).",
    ],
  },
  rescue: {
    title: "Hard choice",
    brief: [
      "The {red|enemy} retaliated by {amber|disabling} the {cyan|Resolute}. It also has {purple|reactor damage} ({icon|reactor}), so one more hit and it's gone. Even worse, your {cyan|repair ship} is too far away to reach it in time.",
      "This is the last turn: whoever holds the {amber|center} wins. Save the {cyan|Resolute}, or permanently sacrifice it for the win?",
    ],
    tasks: [
      "{cyan|Save your ship:} select the Resolute and {green|submit} Retreat to leave the map.",
      "{cyan|Sacrifice for victory:} select the Vigilant, target the {red|Hammer}, then {green|submit} the shot.",
    ],
  },
  "rescue-outcome-sniper": {
    title: "Accepting a sacrifice",
    brief: [
      "As expected, the {red|Hammer} destroyed the {cyan|Resolute}.",
      "You traded that ship for the chance to retake the {amber|center resource}. It's open now. Take it with the {cyan|Sentinel}.",
    ],
  },
  "rescue-outcome-retreat": {
    title: "The Resolute is safe",
    brief: [
      "The {cyan|Resolute} is safely off the map!",
      "You saved the hull, but the middle {amber|resource} tile is undefended. The {red|Hammer} can step in and secure it. That puts them over the {amber|claim minimum}, and {cyan|Central} will award them control of this region.",
    ],
  },
  "completion-sniper": {
    title: "Victory achieved!",
    brief: [
      "You hold the {amber|center} and the {amber|claim} is ours. It cost us the {cyan|Resolute}.",
    ],
  },
  "completion-retreat": {
    title: "Planning ahead",
    brief: [
      "The {red|Hammer} took the {amber|center}, which puts the {red|enemy} over the {amber|claim minimum}.",
      "We {amber|lost} this fight, but the {cyan|Resolute}, our strongest ship, is safe.",
    ],
  },
};

/** The toast when the player tries something the current step doesn't allow. */
export const TUTORIAL_NOT_ALLOWED = {
  select: "Select the highlighted ship.",
  move: "That ship can't move in this step.",
  /** A move step, but not to one of the marked tiles. */
  moveToMarked: "Move to a marked tile.",
  shoot: "You can't fire at that ship in this step.",
  special: "You can't use that special in this step.",
  assist: "You can't assist that ship in this step.",
  claim: "You can't claim that in this step.",
  other: "That isn't part of this step.",
};

/**
 * The info toast for a board click that does nothing: anywhere on a
 * reading-only step (How we win), off a ship on Select a ship / Inspect enemy
 * ships.
 */
export const TUTORIAL_BOARD_HINTS = {
  next: "Click Next to continue",
  selectShip: "Click one of your ships",
  selectEnemy: "Find the Tongs and click it",
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
    "You held the line in the battle. Claim {amber|2 free ships} and record this win. Then you can continue the campaign or take on other admirals.",
  lossSupporting:
    "You kept your strongest ship. {cyan|Sign in} to claim {amber|3 free ships} and record this battle. Then you can continue the campaign or take on other admirals.",
  continueSupporting:
    "Headquarters has seen what you can do. Next, pick the {amber|ships} you'll take into the operation.",
  buttons: {
    claimWin: "Claim 2 ships",
    claimLoss: "Claim 3 ships",
    claiming: "Claiming…",
    signIn: "Sign in to claim your ships",
    verify: "Verify with Selfie Check to claim",
    verifying: "Verifying…",
    rewardClaimed: "Ships claimed. View them",
    continueToFleet: "Continue to fleet selection",
  },
};
