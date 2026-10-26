"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DialogMission } from "../types/dialog";
import {
  isOpeningSnapshot,
  selectDialogLines,
  snapshotsEqual,
  type DialogQueueItem,
  mergeDisabledShips,
  type DialogObservation,
  type DialogSnapshot,
  type EverDisabledShips,
  type ReactorHighs,
  type EverHeldTiles,
  type ShipHistory,
} from "../utils/missionDialog";
import { getHiddenDialogLineIds } from "../utils/hiddenDialogLines";

/** A comms message that was shown (or dismissed unread), with the round it arrived in. */
export interface DialogLogEntry extends DialogQueueItem {
  round: number;
}

interface StoredDialogState {
  last: DialogSnapshot;
  fired: string[];
  /**
   * Fired lines not yet shown or dismissed. Kept in storage (not just
   * React state) so a remount — including React strict mode's double mount
   * in development — rebuilds the queue instead of losing lines that
   * `fired` already marks as done.
   */
  pending?: DialogLogEntry[];
  /** Ids of every ship disabled so far this game (see mergeDisabledShips). */
  everDisabled?: EverDisabledShips;
  /** Each ship's highest reactor level so far this game (see mergeDisabledShips). */
  reactorHighs?: ReactorHighs;
  /** Resource tiles each side has stood on so far this game (see mergeDisabledShips). */
  everHeldTiles?: EverHeldTiles;
  /** Damaged / disabled-on-resource / repaired ships and hull lows (see mergeDisabledShips). */
  shipHistory?: ShipHistory;
}

/** Reactor levels as a stable string ("id:level,..."), so the effect depends on a primitive. */
function encodeLevels(levels: Record<string, number> | undefined): string {
  return Object.entries(levels ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, level]) => `${id}:${level}`)
    .join(",");
}

function decodeLevels(key: string): Record<string, number> {
  const levels: Record<string, number> = {};
  if (!key) return levels;
  for (const pair of key.split(",")) {
    const [id, level] = pair.split(":");
    levels[id] = Number(level);
  }
  return levels;
}

function storageKey(gameId: string): string {
  return `vt-dialog-${gameId}`;
}

function readStored(gameId: string): StoredDialogState | null {
  try {
    const raw = localStorage.getItem(storageKey(gameId));
    return raw ? (JSON.parse(raw) as StoredDialogState) : null;
  } catch {
    return null;
  }
}

function writeStored(gameId: string, state: StoredDialogState): void {
  try {
    localStorage.setItem(storageKey(gameId), JSON.stringify(state));
  } catch {
    // Storage full or blocked — dialog may repeat after a reload, nothing worse.
  }
}

function logStorageKey(gameId: string): string {
  return `vt-dialog-log-${gameId}`;
}

function readStoredLog(gameId: string): DialogLogEntry[] {
  try {
    const raw = localStorage.getItem(logStorageKey(gameId));
    return raw ? (JSON.parse(raw) as DialogLogEntry[]) : [];
  } catch {
    return [];
  }
}

function writeStoredLog(gameId: string, log: DialogLogEntry[]): void {
  try {
    localStorage.setItem(logStorageKey(gameId), JSON.stringify(log));
  } catch {
    // Storage full or blocked — the log just won't survive a reload.
  }
}

function appendToLog(log: DialogLogEntry[], entries: DialogLogEntry[]): DialogLogEntry[] {
  const seen = new Set(log.map((e) => e.key));
  const added = entries.filter((e) => !seen.has(e.key));
  return added.length > 0 ? [...log, ...added] : log;
}

function missionKey(mission: DialogMission | null): string {
  if (!mission) return "";
  return mission.kind === "tutorial" ? "tutorial" : `${mission.kind}:${mission.nodeId}`;
}

/**
 * Queues in-mission dialog lines as the game state crosses triggers (see
 * app/utils/missionDialog.ts). Shared by GameDisplay, GameDisplayWeb2 and
 * SimulatedGameDisplay.
 *
 * - The last seen snapshot and fired line keys are kept per game in
 *   localStorage, so a reload doesn't replay anything. Opening a game that's
 *   already underway with no stored record plays only the mission's entry
 *   lines, then continues silently from where it is.
 * - `enabled` is false for games without a mission and replays. It stays on
 *   when the game ends so victory/defeat lines (snapshot.outcome) can play;
 *   views show the queue inside the result screen at that point. `paused`
 *   holds the queue and hides the current line (e.g. while RoundStartModal
 *   is open). `holdNewLines` only delays *starting* a new batch (e.g. while
 *   it isn't the player's turn); a batch already on screen keeps playing so
 *   a line being read never vanishes.
 * - `log` is every message shown so far (plus any dismissed unread), kept
 *   alongside the rest of the state and still readable after the game ends.
 * - Pure derived state from data the views already have: no RPC calls.
 */
export function useMissionDialog({
  gameId,
  mission,
  snapshot,
  enabled,
  paused = false,
  holdNewLines = false,
  persist = true,
}: {
  gameId: string;
  mission: DialogMission | null;
  /** What the view sees right now — from buildDialogSnapshot. */
  snapshot: DialogObservation | null;
  enabled: boolean;
  paused?: boolean;
  /** Don't start showing a new batch yet; one already on screen continues. */
  holdNewLines?: boolean;
  /**
   * false keeps state in memory only and treats a return to the opening
   * state as a restart (the tutorial, which starts over on every visit).
   */
  persist?: boolean;
}) {
  // `index` is the line being shown; once it passes the end the queue is
  // drained, and the next batch starts a fresh queue (so "1/3" counts only
  // lines that are waiting together).
  // `started`: some line of this batch has been on screen.
  const [queue, setQueue] = useState<{ items: DialogLogEntry[]; index: number; started: boolean }>({
    items: [],
    index: 0,
    started: false,
  });
  // Lines dismissed unread since the comms log was last opened.
  const [unreadCount, setUnreadCount] = useState(0);
  const [log, setLog] = useState<DialogLogEntry[]>([]);

  // Latest mission object without making it an effect dependency (views
  // build it inline); missionKey below is the real dependency.
  const missionRef = useRef(mission);
  missionRef.current = mission;
  const currentMissionKey = missionKey(mission);

  const memoryStateRef = useRef<StoredDialogState | null>(null);

  // Appends to the waiting lines, or starts a fresh queue once the last
  // batch has been shown.
  const enqueue = useCallback((items: DialogLogEntry[]) => {
    setQueue((q) =>
      q.index >= q.items.length
        ? { items, index: 0, started: false }
        : { items: [...q.items, ...items], index: q.index, started: q.started },
    );
  }, []);

  // Rebuild the queue (from lines still pending) and load the log when
  // switching games or remounting.
  useEffect(() => {
    const pending = persist && gameId ? (readStored(gameId)?.pending ?? []) : [];
    setQueue({ items: pending, index: 0, started: false });
    setUnreadCount(0);
    memoryStateRef.current = null;
    setLog(persist && gameId ? readStoredLog(gameId) : []);
  }, [gameId, persist]);

  // Drops lines from the stored pending list once shown or dismissed.
  const clearPending = useCallback(
    (keys: string[]) => {
      if (keys.length === 0) return;
      const drop = new Set(keys);
      if (!persist) {
        const state = memoryStateRef.current;
        if (state?.pending) state.pending = state.pending.filter((p) => !drop.has(p.key));
        return;
      }
      const stored = readStored(gameId);
      if (!stored?.pending?.some((p) => drop.has(p.key))) return;
      writeStored(gameId, { ...stored, pending: stored.pending.filter((p) => !drop.has(p.key)) });
    },
    [persist, gameId],
  );

  // Persist the log whenever it grows.
  useEffect(() => {
    if (persist && gameId && log.length > 0) writeStoredLog(gameId, log);
  }, [log, persist, gameId]);

  const round = snapshot?.round;
  const myScore = snapshot?.myScore;
  const enemyScore = snapshot?.enemyScore;
  const myShipsDestroyed = snapshot?.myShipsDestroyed;
  const enemyShipsDestroyed = snapshot?.enemyShipsDestroyed;
  const myShipsRetreated = snapshot?.myShipsRetreated;
  const enemyShipsRetreated = snapshot?.enemyShipsRetreated;
  const outcome = snapshot?.outcome ?? null;
  // Joined so the effect depends on primitives, not fresh arrays.
  const myDisabledKey = snapshot?.myDisabledShipIds.join(",") ?? "";
  const enemyDisabledKey = snapshot?.enemyDisabledShipIds.join(",") ?? "";
  const myReactorKey = encodeLevels(snapshot?.myReactorLevels);
  const enemyReactorKey = encodeLevels(snapshot?.enemyReactorLevels);
  const myTilesKey = snapshot?.myResourceTiles.join(";") ?? "";
  const enemyTilesKey = snapshot?.enemyResourceTiles.join(";") ?? "";
  const myDamagedKey = snapshot?.myDamagedShipIds?.join(",") ?? "";
  const enemyDamagedKey = snapshot?.enemyDamagedShipIds?.join(",") ?? "";
  const myDisabledOnResourceKey = snapshot?.myDisabledOnResourceShipIds?.join(",") ?? "";
  const enemyDisabledOnResourceKey = snapshot?.enemyDisabledOnResourceShipIds?.join(",") ?? "";
  const myHullsKey = encodeLevels(snapshot?.myHulls);
  const enemyHullsKey = encodeLevels(snapshot?.enemyHulls);
  const myFleetFaction = snapshot?.myFleetFaction ?? null;
  const enemyFleetFaction = snapshot?.enemyFleetFaction ?? null;
  const myCanRepair = snapshot?.myCanRepair ?? false;
  const enemyCanRepair = snapshot?.enemyCanRepair ?? false;
  const hasSnapshot = snapshot != null;

  useEffect(() => {
    const currentMission = missionRef.current;
    if (!enabled || !hasSnapshot || !currentMission || !gameId) return;
    const observation: DialogObservation = {
      round: round!,
      myScore: myScore!,
      enemyScore: enemyScore!,
      myShipsDestroyed: myShipsDestroyed!,
      enemyShipsDestroyed: enemyShipsDestroyed!,
      myShipsRetreated: myShipsRetreated!,
      enemyShipsRetreated: enemyShipsRetreated!,
      myDisabledShipIds: myDisabledKey ? myDisabledKey.split(",") : [],
      enemyDisabledShipIds: enemyDisabledKey ? enemyDisabledKey.split(",") : [],
      myReactorLevels: decodeLevels(myReactorKey),
      enemyReactorLevels: decodeLevels(enemyReactorKey),
      myResourceTiles: myTilesKey ? myTilesKey.split(";") : [],
      enemyResourceTiles: enemyTilesKey ? enemyTilesKey.split(";") : [],
      myDamagedShipIds: myDamagedKey ? myDamagedKey.split(",") : [],
      enemyDamagedShipIds: enemyDamagedKey ? enemyDamagedKey.split(",") : [],
      myDisabledOnResourceShipIds: myDisabledOnResourceKey ? myDisabledOnResourceKey.split(",") : [],
      enemyDisabledOnResourceShipIds: enemyDisabledOnResourceKey ? enemyDisabledOnResourceKey.split(",") : [],
      myHulls: decodeLevels(myHullsKey),
      enemyHulls: decodeLevels(enemyHullsKey),
      myFleetFaction,
      enemyFleetFaction,
      myCanRepair,
      enemyCanRepair,
      outcome,
    };

    const save = (state: StoredDialogState) => {
      if (persist) writeStored(gameId, state);
      else memoryStateRef.current = state;
    };
    let stored = persist ? readStored(gameId) : memoryStateRef.current;
    if (!persist && stored) {
      // Tutorial restarted: back at the opening state after progressing.
      const fresh = mergeDisabledShips(observation, null).snapshot;
      if (isOpeningSnapshot(fresh) && !isOpeningSnapshot(stored.last)) {
        stored = null;
        setQueue({ items: [], index: 0, started: false });
        setLog([]);
        setUnreadCount(0);
      }
    }
    const merged = mergeDisabledShips(
      observation,
      stored?.everDisabled,
      stored?.reactorHighs,
      stored?.everHeldTiles,
      stored?.shipHistory,
    );
    const next: DialogSnapshot = merged.snapshot;
    const everDisabled = merged.everDisabled;
    const reactorHighs = merged.reactorHighs;
    const everHeldTiles = merged.everHeldTiles;
    const shipHistory = merged.shipHistory;
    // Records saved before some triggers existed lack their fields; treat
    // them as already at the current values so opening an old game doesn't
    // suddenly play a debrief or disabled-ship lines for past events.
    if (stored) {
      const last = { ...stored.last };
      if (last.outcome === undefined) last.outcome = next.outcome;
      if (last.myShipsDisabled === undefined) last.myShipsDisabled = next.myShipsDisabled;
      if (last.enemyShipsDisabled === undefined) last.enemyShipsDisabled = next.enemyShipsDisabled;
      if (last.myReactorDamage === undefined) last.myReactorDamage = next.myReactorDamage;
      if (last.enemyReactorDamage === undefined) last.enemyReactorDamage = next.enemyReactorDamage;
      if (last.myShipsAtReactorLevel === undefined) last.myShipsAtReactorLevel = next.myShipsAtReactorLevel;
      if (last.enemyShipsAtReactorLevel === undefined) {
        last.enemyShipsAtReactorLevel = next.enemyShipsAtReactorLevel;
      }
      if (last.myShipsRetreated === undefined) last.myShipsRetreated = next.myShipsRetreated;
      if (last.enemyShipsRetreated === undefined) last.enemyShipsRetreated = next.enemyShipsRetreated;
      if (last.myResourceTilesTaken === undefined) last.myResourceTilesTaken = next.myResourceTilesTaken;
      if (last.enemyResourceTilesTaken === undefined) last.enemyResourceTilesTaken = next.enemyResourceTilesTaken;
      if (!stored.shipHistory) {
        last.myShipsDamaged = next.myShipsDamaged;
        last.enemyShipsDamaged = next.enemyShipsDamaged;
        last.myShipsDisabledOnResource = next.myShipsDisabledOnResource;
        last.enemyShipsDisabledOnResource = next.enemyShipsDisabledOnResource;
        last.myShipsRepaired = next.myShipsRepaired;
        last.enemyShipsRepaired = next.enemyShipsRepaired;
      }
      stored = { ...stored, last };
    }
    if (!stored && next.outcome !== null) {
      // First seen after it already ended (e.g. opening a finished game from
      // the list): nothing to play.
      save({ last: next, fired: [], pending: [], everDisabled, reactorHighs, everHeldTiles, shipHistory });
      return;
    }
    if (!stored && !isOpeningSnapshot(next)) {
      // First time this game is seen, but it's already underway (opened on
      // another device, or the AI moved/scored before the mission resolved).
      // Still play the mission's entry lines; everything else starts silently
      // from here instead of replaying past events.
      const entryItems: DialogLogEntry[] = selectDialogLines({
        mission: currentMission,
        gameId,
        prev: null,
        next,
        firedKeys: new Set(),
        hiddenGenericLineIds: getHiddenDialogLineIds(),
      })
        .filter((item) => item.event === "missionStart")
        .map((item) => ({ ...item, round: next.round }));
      save({ last: next, fired: entryItems.map((item) => item.key), pending: entryItems, everDisabled, reactorHighs, everHeldTiles, shipHistory });
      if (entryItems.length > 0) {
        enqueue(entryItems);
      }
      return;
    }
    // Equal counts mean the disabled set didn't grow either; still save when
    // a hull low moved (a later repair is measured from it).
    if (stored && snapshotsEqual(stored.last, next)) {
      if (JSON.stringify(stored.shipHistory) !== JSON.stringify(shipHistory)) save({ ...stored, shipHistory });
      return;
    }

    const fired = new Set(stored?.fired ?? []);
    const items: DialogLogEntry[] = selectDialogLines({
      mission: currentMission,
      gameId,
      prev: stored?.last ?? null,
      next,
      firedKeys: fired,
      hiddenGenericLineIds: getHiddenDialogLineIds(),
    }).map((item) => ({ ...item, round: next.round }));
    items.forEach((item) => fired.add(item.key));
    save({
      last: next,
      fired: [...fired],
      pending: [...(stored?.pending ?? []), ...items],
      everDisabled,
      reactorHighs,
      everHeldTiles,
      shipHistory,
    });
    if (items.length > 0) enqueue(items);
  }, [
    enabled,
    persist,
    enqueue,
    hasSnapshot,
    gameId,
    currentMissionKey,
    round,
    myScore,
    enemyScore,
    myShipsDestroyed,
    enemyShipsDestroyed,
    myShipsRetreated,
    enemyShipsRetreated,
    myDisabledKey,
    enemyDisabledKey,
    myReactorKey,
    enemyReactorKey,
    myTilesKey,
    enemyTilesKey,
    myDamagedKey,
    enemyDamagedKey,
    myDisabledOnResourceKey,
    enemyDisabledOnResourceKey,
    myHullsKey,
    enemyHullsKey,
    myFleetFaction,
    enemyFleetFaction,
    myCanRepair,
    enemyCanRepair,
    outcome,
  ]);

  const advance = useCallback(
    () => setQueue((q) => ({ ...q, index: q.index + 1 })),
    [],
  );
  const dismissAll = useCallback(() => {
    // Lines skipped unread still go in the log.
    const skipped = queue.items.slice(queue.index);
    setLog((l) => appendToLog(l, skipped));
    clearPending(skipped.map((item) => item.key));
    // The one on screen was seen; the rest were skipped unread.
    setUnreadCount((n) => n + Math.max(0, skipped.length - 1));
    setQueue((q) => ({ ...q, index: q.items.length }));
  }, [queue, clearPending]);
  const markLogSeen = useCallback(() => setUnreadCount(0), []);

  const active = enabled && !paused && (!holdNewLines || queue.started);
  const current = active && queue.index < queue.items.length ? queue.items[queue.index] : null;

  // The mission's opening line while it waits, not yet shown, at the front
  // of the queue. Views put it in the round report (RoundStartModal's note,
  // via useOpeningLineReport) instead of the comms panel, then call
  // takeOpeningLine when the report closes; its replies play in the comms
  // panel straight after. Error placeholders and hideable generic lines
  // stay in the comms panel, which has their controls.
  const head = queue.index < queue.items.length ? queue.items[queue.index] : null;
  const openingLine =
    enabled && !queue.started && head?.event === "missionStart" && !head.isError && !head.hideableLineId
      ? head
      : null;
  const takeOpeningLine = useCallback(() => {
    if (!openingLine) return;
    setLog((l) => appendToLog(l, [openingLine]));
    clearPending([openingLine.key]);
    setQueue((q) =>
      q.items[q.index]?.key === openingLine.key ? { ...q, index: q.index + 1, started: true } : q,
    );
  }, [openingLine, clearPending]);

  // A line enters the log (and leaves the pending list) as soon as it's shown.
  useEffect(() => {
    if (!current) return;
    setLog((l) => appendToLog(l, [current]));
    clearPending([current.key]);
    setQueue((q) => (q.started ? q : { ...q, started: true }));
  }, [current, clearPending]);

  return {
    current,
    log,
    /** 1-based position of `current` among the lines waiting together. */
    position: queue.index + 1,
    total: queue.items.length,
    advance,
    dismissAll,
    /** Lines dismissed unread since the comms log was last opened. */
    unreadCount,
    markLogSeen,
    /** The mission's opening line, waiting to be shown in the round report. */
    openingLine,
    /** Marks openingLine as read (the round report showing it closed). */
    takeOpeningLine,
  };
}
