"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

// Move playback (docs/eth-global-remote/animation-redesign): every move,
// yours after SUBMIT and each enemy move as it arrives, plays on the board:
// the ship slides along its route to its new tile, its weapon fires once,
// then the board shows the result with nothing left over. Moves queue and
// play in order. Shared by web3 (GameDisplay), web2 (GameDisplayWeb2), the
// tutorial (SimulatedGameDisplay) and replay; each converts its moves to
// BoardMove (plain numbers) at its own adapter. GameGrid's MovePlaybackLayer
// draws the active move and calls advance() as each phase ends.

export interface BoardMove {
  /** Unique per move (dedupes the same move arriving twice, e.g. your own move echoed back). */
  key: string;
  shipId: number;
  from: { row: number; col: number };
  to: { row: number; col: number };
  /** ActionType (app/types/types.ts). */
  actionType: number;
  /** 0 when the move has no target. */
  targetShipId: number;
  /** The target was destroyed by this move: its explosion plays after the hit. */
  killsTarget?: boolean;
  /** The target's hull and reactor damage once this move lands (the cinematic's hull bar drains to it). */
  targetAfter?: TargetStatusAfter;
}

/** A ship's hull and reactor damage, as a move leaves them. */
export interface TargetStatusAfter {
  hullPoints: number;
  reactorCriticalTimer: number;
}

export type PlaybackPhase = "moving" | "firing";

export interface ActivePlayback {
  move: BoardMove;
  phase: PlaybackPhase;
}

/** How many played keys to remember for dedupe. */
const PLAYED_KEYS_KEPT = 200;

interface PlaybackState {
  queue: BoardMove[];
  phase: PlaybackPhase;
  /** Moves finished so far in the current run of the queue (their ships are at their To tiles). */
  landed: BoardMove[];
}

type PlaybackAction =
  | { type: "enqueue"; moves: BoardMove[] }
  | { type: "advance"; key: string; phase: PlaybackPhase }
  | { type: "reset" };

const IDLE: PlaybackState = { queue: [], phase: "moving", landed: [] };

function reducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case "enqueue":
      return { ...state, queue: [...state.queue, ...action.moves] };
    case "advance": {
      // Ignore a stale call (a phase that already ended, or another move).
      const active = state.queue[0];
      if (!active || active.key !== action.key || state.phase !== action.phase) return state;
      if (state.phase === "moving") return { ...state, phase: "firing" };
      const rest = state.queue.slice(1);
      return rest.length === 0 ? IDLE : { queue: rest, phase: "moving", landed: [...state.landed, active] };
    }
    case "reset":
      return IDLE;
  }
}

export function useMovePlayback() {
  const [state, dispatch] = useReducer(reducer, IDLE);
  /** Moves already played (or queued) this session, so none plays twice. */
  const seenRef = useRef<string[]>([]);

  const enqueue = useCallback((moves: BoardMove[]) => {
    const fresh = moves.filter((m, i) => !seenRef.current.includes(m.key) && moves.findIndex((o) => o.key === m.key) === i);
    if (fresh.length === 0) return;
    seenRef.current = [...seenRef.current, ...fresh.map((m) => m.key)].slice(-PLAYED_KEYS_KEPT);
    dispatch({ type: "enqueue", moves: fresh });
  }, []);

  /** Marks moves as already seen without playing them (e.g. the board as it was on load). */
  const markSeen = useCallback((keys: string[]) => {
    const fresh = keys.filter((k) => !seenRef.current.includes(k));
    if (fresh.length === 0) return;
    seenRef.current = [...seenRef.current, ...fresh].slice(-PLAYED_KEYS_KEPT);
  }, []);

  const hasSeen = useCallback((key: string) => seenRef.current.includes(key), []);

  /** The given move's phase is over: moving → firing, firing → the next move. */
  const advance = useCallback((key: string, phase: PlaybackPhase) => {
    dispatch({ type: "advance", key, phase });
  }, []);

  /** Drops everything queued (a reverted move, stepping a replay back). */
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  const { queue, phase, landed } = state;
  const active: ActivePlayback | null = useMemo(
    () => (queue.length > 0 ? { move: queue[0], phase } : null),
    [queue, phase],
  );
  const landedWithActive = useMemo(
    () => (active && phase === "firing" ? [...landed, active.move] : landed),
    [landed, active, phase],
  );

  return {
    active,
    isPlaying: queue.length > 0,
    /** Finished moves in this run, plus the active one once it has reached its tile. */
    landed: landedWithActive,
    enqueue,
    markSeen,
    hasSeen,
    advance,
    reset,
  };
}

export type MovePlayback = ReturnType<typeof useMovePlayback>;

/**
 * The board to draw: while moves play (or `hold` says one is about to), the
 * board from just before them, with each move that has reached its tile
 * applied by `applyLanded` (see landShipPositions); otherwise the live board.
 * Generic over each mode's game type.
 */
export function useHeldBoard<G>(
  live: G,
  hold: boolean,
  playback: Pick<MovePlayback, "landed" | "active">,
  applyLanded: (game: G, landed: BoardMove[], activeKey: string | null) => G,
): G {
  const lastIdleRef = useRef(live);
  if (!hold) lastIdleRef.current = live;
  const held = lastIdleRef.current;
  const { landed, active } = playback;
  const activeKey = active?.move.key ?? null;
  return useMemo(
    () => (hold ? (landed.length > 0 ? applyLanded(held, landed, activeKey) : held) : live),
    [hold, held, live, landed, activeKey, applyLanded],
  );
}

/** How long to wait for an enemy move's events before playing it from lastMove alone. */
const ENEMY_MOVE_FALLBACK_MS = 2500;
/** A move's content played this recently isn't played again from another source. */
const RECENT_CONTENT_MS = 120_000;

type RawMoveLike = {
  shipId: number;
  oldRow: number;
  oldCol: number;
  newRow: number;
  newCol: number;
  actionType: number;
  targetShipId: number;
};

const contentKey = (m: RawMoveLike) =>
  `${m.shipId}:${m.actionType}:${m.targetShipId}:${m.oldRow},${m.oldCol}:${m.newRow},${m.newCol}`;

/**
 * Playback for a live game (web3 and web2): your own moves are enqueued at
 * submit (enqueue); enemy moves come in with enqueueEnemy (Move events,
 * missed replay turns). When the game data shows a new enemy lastMove, the
 * board holds until that move has played; if nothing covering it arrives
 * within ENEMY_MOVE_FALLBACK_MS it plays from lastMove alone. The same move
 * from two sources (an event and lastMove) plays once. Moves already on the
 * board when it loads don't play.
 */
export function useLiveMovePlayback(params: {
  /** The game data's lastMove (number-native), or null. */
  lastMove: RawMoveLike | null;
  /** lastMoveKey of it: changes with each new move. */
  lastMoveKey: string;
  isMine: (shipId: number) => boolean;
  /** A raw move as a BoardMove (the mode works out a Ram's tile and kills). */
  toBoardMove: (key: string, raw: RawMoveLike) => BoardMove;
  /** No live playback (replay drives its own). */
  disabled?: boolean;
}) {
  const playback = useMovePlayback();
  const { lastMove, lastMoveKey, disabled = false } = params;
  const [settledKey, setSettledKey] = useState(lastMoveKey);
  const recentRef = useRef(new Map<string, number>());

  const latest = useRef(params);
  latest.current = params;

  const isEnemyMove = !!lastMove && lastMove.shipId !== 0 && !params.isMine(lastMove.shipId);
  const unsettled = lastMoveKey !== settledKey;
  const awaiting = !disabled && unsettled && isEnemyMove;

  const playedRecently = (raw: RawMoveLike) => {
    const at = recentRef.current.get(contentKey(raw));
    return at != null && Date.now() - at < RECENT_CONTENT_MS;
  };

  const enqueueEnemy = useCallback(
    (items: { key: string; raw: RawMoveLike }[]) => {
      const { isMine, toBoardMove, lastMove: lm, lastMoveKey: lmKey } = latest.current;
      const now = Date.now();
      const fresh = items.filter((i) => !isMine(i.raw.shipId) && !playedRecently(i.raw));
      fresh.forEach((i) => recentRef.current.set(contentKey(i.raw), now));
      if (fresh.length > 0) playback.enqueue(fresh.map((i) => toBoardMove(i.key, i.raw)));
      // These cover the lastMove we're holding for: it's accounted for.
      if (lm && items.some((i) => contentKey(i.raw) === contentKey(lm))) setSettledKey(lmKey);
    },
    // playback.enqueue is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Your own move, the board loading or replay: nothing to wait for. An
  // enemy move already played from its events settles at once too.
  useEffect(() => {
    if (!unsettled) return;
    if (disabled || !isEnemyMove || (lastMove && playedRecently(lastMove))) setSettledKey(lastMoveKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsettled, disabled, isEnemyMove, lastMoveKey]);

  // No event covered it in time: play it from lastMove.
  useEffect(() => {
    if (!awaiting) return;
    const timer = window.setTimeout(() => {
      const { lastMove: lm, lastMoveKey: lmKey } = latest.current;
      if (lm) enqueueEnemy([{ key: `lastMove:${lmKey}`, raw: lm }]);
      setSettledKey(lmKey);
    }, ENEMY_MOVE_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [awaiting, lastMoveKey, enqueueEnemy]);

  /** Your own move, at submit: remembered so its echo doesn't play again. */
  const enqueueOwn = useCallback(
    (move: BoardMove, raw: RawMoveLike) => {
      recentRef.current.set(contentKey(raw), Date.now());
      playback.enqueue([move]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    playback,
    /** Hold the board: a move is playing, or an enemy move is on its way to playing. */
    hold: playback.isPlaying || awaiting,
    enqueueEnemy,
    enqueueOwn,
  };
}

/**
 * Playback for replay mode: stepping forward one turn plays that turn's move
 * (its snapshot's lastMove) with the previous step's board held; stepping
 * back or jumping just shows the step. Returns the board to draw and the
 * playback for GameGrid. Shared by GameDisplay and GameDisplayWeb2.
 */
export function useReplayPlayback<G>(params: {
  /** The replay step (null: not replaying; -1: the starting board). */
  step: number | null;
  /** The step's snapshot (the board after that turn). */
  snapshot: G | null;
  lastMoveOf: (snapshot: G) => RawMoveLike | null;
  /** The turn's move, given the board before it and the board after it. */
  toBoardMove: (key: string, raw: RawMoveLike, before: G, after: G) => BoardMove;
  applyLanded: (game: G, landed: BoardMove[], activeKey: string | null) => G;
}) {
  const { step, snapshot } = params;
  const playback = useMovePlayback();
  const [settledStep, setSettledStep] = useState(step);
  const shownRef = useRef(snapshot);
  const playCountRef = useRef(0);
  const latest = useRef(params);
  latest.current = params;

  const arrived = step !== settledStep;
  const advancedOne = arrived && step != null && settledStep != null && step === settledStep + 1;
  const hold = playback.isPlaying || advancedOne;

  const { enqueue, reset } = playback;
  useEffect(() => {
    if (!arrived) return;
    const { snapshot: after, lastMoveOf, toBoardMove } = latest.current;
    const before = shownRef.current;
    const raw = advancedOne && after ? lastMoveOf(after) : null;
    if (raw && before && after) {
      playCountRef.current += 1;
      enqueue([toBoardMove(`replay:${playCountRef.current}:${step}`, raw, before, after)]);
    } else {
      reset();
    }
    setSettledStep(step);
  }, [arrived, advancedOne, step, enqueue, reset]);

  const applyLandedOrNull = useCallback(
    (game: G | null, landed: BoardMove[], activeKey: string | null) =>
      game == null ? game : latest.current.applyLanded(game, landed, activeKey),
    [],
  );
  const board = useHeldBoard<G | null>(snapshot, hold, playback, applyLandedOrNull);
  if (!hold) shownRef.current = snapshot;

  const gridPlayback = useMemo(
    () => ({ active: playback.active, onPhaseDone: playback.advance }),
    [playback.active, playback.advance],
  );
  return { board, gridPlayback, isPlaying: hold };
}
