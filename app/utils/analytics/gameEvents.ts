import posthog from "posthog-js";

// Gameplay analytics for single-player and match results. Web3 and web2
// call the same helpers so both modes send identical events (the funnels
// compare them). Fire from callbacks or effects, never during render.

export type AppMode = "web3" | "web2";
/**
 * campaign = a mission from the campaign map; roguelike = an Operations
 * combat node; vs_ai = any other match against the AI (web2 skirmish).
 */
export type GameMode = "pvp" | "campaign" | "roguelike" | "vs_ai";

export type GameResult = "won" | "lost" | "tie";

/** A match view's winner (GameWinnerResult) as an analytics result. */
export function gameResultOf(winner: "me" | "opponent" | "tie" | null): GameResult | null {
  if (winner === null) return null;
  return winner === "me" ? "won" : winner === "tie" ? "tie" : "lost";
}

type Id = bigint | number | string;
const id = (value: Id) => String(value);

export function trackMissionStarted(props: {
  appMode: AppMode;
  gameMode: "campaign" | "roguelike";
  nodeId: Id;
  gameId?: Id;
  fleetSize?: number;
}) {
  posthog.capture("mission_started", {
    app_mode: props.appMode,
    game_mode: props.gameMode,
    node_id: id(props.nodeId),
    ...(props.gameId != null ? { game_id: id(props.gameId) } : {}),
    ...(props.fleetSize != null ? { fleet_size: props.fleetSize } : {}),
  });
}

// What this session saw of the current Operations run, for run_ended's
// result: web2's run endpoint only returns active runs, so an ended run
// can't report how it ended. Module state: one run at a time per tab.
let lastRoguelikeGameResult: GameResult | null = null;
let runRetreatedThisSession = false;

export function trackRunStarted(props: { appMode: AppMode; campaignId: Id; fleetSize: number }) {
  lastRoguelikeGameResult = null;
  runRetreatedThisSession = false;
  posthog.capture("run_started", {
    app_mode: props.appMode,
    campaign_id: id(props.campaignId),
    fleet_size: props.fleetSize,
  });
}

export function trackResupplyEntered(props: { appMode: AppMode; nodeId: Id }) {
  posthog.capture("resupply_entered", { app_mode: props.appMode, node_id: id(props.nodeId) });
}

export function trackRunRetreated(props: { appMode: AppMode; midCombat: boolean }) {
  runRetreatedThisSession = true;
  posthog.capture("run_retreated", { app_mode: props.appMode, mid_combat: props.midCombat });
}

export type RunResult = "won" | "lost" | "retreated";

/** How the run that just ended finished, from what this session saw; resets. */
export function takeRunResult(): RunResult {
  const result: RunResult = runRetreatedThisSession
    ? "retreated"
    : lastRoguelikeGameResult === "won"
      ? "won"
      : "lost";
  lastRoguelikeGameResult = null;
  runRetreatedThisSession = false;
  return result;
}

export function trackRunEnded(props: { appMode: AppMode; campaignId?: Id; result: RunResult }) {
  posthog.capture("run_ended", {
    app_mode: props.appMode,
    result: props.result,
    ...(props.campaignId != null ? { campaign_id: id(props.campaignId) } : {}),
  });
}

/** reason: the AI move errored, or the loop gave up waiting for it to land. */
export function trackAITurnFailed(props: {
  appMode: AppMode;
  gameMode: GameMode;
  gameId: Id;
  reason: "failed" | "stalled";
}) {
  posthog.capture("ai_turn_failed", {
    app_mode: props.appMode,
    game_mode: props.gameMode,
    game_id: id(props.gameId),
    reason: props.reason,
  });
}

export function trackGameEnded(props: {
  appMode: AppMode;
  gameMode: GameMode;
  gameId: Id;
  result: GameResult;
  retreated: boolean;
  round?: number;
}) {
  if (props.gameMode === "roguelike") {
    lastRoguelikeGameResult = props.result;
    // Fleeing an Operations match ends the whole run.
    if (props.retreated) runRetreatedThisSession = true;
  }
  posthog.capture("game_ended", {
    app_mode: props.appMode,
    game_mode: props.gameMode,
    game_id: id(props.gameId),
    result: props.result,
    retreated: props.retreated,
    ...(props.round != null ? { round: props.round } : {}),
  });
}

/** The game mode for a match view's flags. */
export function gameModeOf(flags: {
  isRoguelikeGame: boolean;
  isSinglePlayerGame: boolean;
  isVsAIGame: boolean;
}): GameMode {
  if (flags.isRoguelikeGame) return "roguelike";
  if (flags.isSinglePlayerGame) return "campaign";
  if (flags.isVsAIGame) return "vs_ai";
  return "pvp";
}

const ENDED_KEY_PREFIX = "vt-game-ended-tracked-v1:";

/**
 * Whether to send game_ended now. Only when this view saw the game in
 * progress and now sees it over (so opening a finished game or a replay
 * doesn't count), and only once per game in this browser.
 */
export function shouldTrackGameEnded(params: {
  sawInProgress: boolean;
  isOver: boolean;
  alreadyTracked: boolean;
}): boolean {
  return params.sawInProgress && params.isOver && !params.alreadyTracked;
}

export function wasGameEndedTracked(gameId: Id): boolean {
  try {
    return window.localStorage.getItem(ENDED_KEY_PREFIX + id(gameId)) === "1";
  } catch {
    return false;
  }
}

export function markGameEndedTracked(gameId: Id): void {
  try {
    window.localStorage.setItem(ENDED_KEY_PREFIX + id(gameId), "1");
  } catch {
    // Storage blocked: the in-memory ref in useTrackGameEnded still stops repeats.
  }
}
