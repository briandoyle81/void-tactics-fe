import type { BoardMove, TargetStatusAfter } from "../hooks/useMovePlayback";

// The held board while moves play back (useHeldBoard): each move that has
// reached its tile puts its ship there; a finished move also takes its
// casualties off (a retreat, a rammed ship knocked off, a destroyed target).
// The active move's target stays on the board while it's being fired at,
// except a rammed ship, which leaves when the rammer lands on its tile.
// Hull points and everything else stay as they were until the queue is done
// and the live board takes over. Mode-neutral: ids compare as numbers.

const ACTION_RETREAT = 2;
const ACTION_FACTION_ABILITY = 7;

export function landShipPositions<
  P extends { shipId: number | bigint | string; position: { row: number; col: number }; status?: 0 | 1 | 2 },
>(positions: readonly P[], landed: readonly BoardMove[], activeKey: string | null): P[] {
  if (landed.length === 0) return positions as P[];
  const next = positions.map((p) => ({ ...p }));
  const find = (id: number) => next.find((p) => Number(p.shipId) === id);
  for (const move of landed) {
    const finished = move.key !== activeKey;
    const mover = find(move.shipId);
    if (mover) {
      if (move.actionType === ACTION_RETREAT) mover.status = 2;
      else mover.position = { row: move.to.row, col: move.to.col };
    }
    if (!move.targetShipId) continue;
    const target = find(move.targetShipId);
    if (!target) continue;
    // A Ram (variant 1's faction ability, ending on the victim's tile) knocks
    // the victim off. It leaves the board as soon as the rammer lands on its
    // tile (the ram's animation draws it tumbling away): a tile holds one
    // ship, so a victim left there would cover the rammer.
    const isRam =
      move.actionType === ACTION_FACTION_ABILITY &&
      !move.killsTarget &&
      move.to.row === target.position.row &&
      move.to.col === target.position.col;
    if (isRam) target.status = 2;
    else if (finished && move.killsTarget) target.status = 1;
  }
  return next;
}

/** A raw move record (Move event, lastMove, replay turn), number-native. */
export interface RawMove {
  shipId: number;
  oldRow: number;
  oldCol: number;
  newRow: number;
  newCol: number;
  actionType: number;
  targetShipId: number;
}

/** Identity of a move by what it did (matches the same move from a Move event and from lastMove). */
export function moveContentKey(m: RawMove): string {
  return `${m.shipId}:${m.actionType}:${m.targetShipId}:${m.oldRow},${m.oldCol}:${m.newRow},${m.newCol}`;
}

/**
 * A raw move as a playback move. A Ram (variant 1's faction ability) records
 * the tile before the ram, but the rammer ends on its victim's tile, so it
 * charges there (`targetPosition`: the victim's tile on the board before the
 * move) from the recorded tile (`ramFrom`), after sliding to it.
 */
export function boardMoveFromRaw(
  key: string,
  m: RawMove,
  ctx: {
    moverVariant: number | null | undefined;
    targetPosition: { row: number; col: number } | null;
    killsTarget?: boolean;
    targetAfter?: TargetStatusAfter;
  },
): BoardMove {
  const isRam = m.actionType === ACTION_FACTION_ABILITY && Number(ctx.moverVariant) !== 2;
  const retreat = m.actionType === ACTION_RETREAT;
  return {
    key,
    shipId: m.shipId,
    from: { row: m.oldRow, col: m.oldCol },
    to:
      retreat || m.newRow < 0 || m.newCol < 0
        ? { row: m.oldRow, col: m.oldCol }
        : isRam && ctx.targetPosition
          ? ctx.targetPosition
          : { row: m.newRow, col: m.newCol },
    actionType: m.actionType,
    targetShipId: m.targetShipId,
    ...(isRam && m.newRow >= 0 && m.newCol >= 0 ? { ramFrom: { row: m.newRow, col: m.newCol } } : {}),
    killsTarget: ctx.killsTarget,
    targetAfter: ctx.targetAfter,
  };
}

/**
 * A ship's hull and reactor damage in a game (shipIds and shipAttributes run
 * in parallel in every mode), for a move's `targetAfter`. Undefined when the
 * ship isn't in it.
 */
export function shipStatusIn(
  game: {
    shipIds: readonly (number | bigint | string)[];
    shipAttributes: readonly { hullPoints: number; reactorCriticalTimer: number }[];
  },
  shipId: number,
): TargetStatusAfter | undefined {
  if (!shipId) return undefined;
  const i = game.shipIds.findIndex((id) => Number(id) === shipId);
  const attrs = i >= 0 ? game.shipAttributes[i] : undefined;
  return attrs ? { hullPoints: attrs.hullPoints, reactorCriticalTimer: attrs.reactorCriticalTimer } : undefined;
}

/** What a move did to its target, as playback shows it. */
export interface MoveOutcome {
  /** The target's hull and reactor damage once this move lands. */
  targetAfter: TargetStatusAfter;
  killsTarget: boolean;
}

/** A shot's effect on its target, for predicting a hit mid-run (see chainMoveOutcomes). */
export type HitKind = "weapon" | "emp" | "other";

/**
 * A weapon or EMP hit on a target in the given state, as the contracts
 * resolve it (deterministic): a weapon does its gun damage less the target's
 * damage reduction (rounded down), or ticks the reactor of a ship already at
 * 0 hull; an EMP ticks the reactor. Null for anything else (drones, repairs),
 * whose strength the board doesn't carry.
 */
export function predictHit(
  kind: HitKind,
  before: TargetStatusAfter,
  shooter: { gunDamage: number } | null | undefined,
  target: { damageReduction: number } | null | undefined,
): TargetStatusAfter | null {
  if (kind === "emp") return { ...before, reactorCriticalTimer: before.reactorCriticalTimer + 1 };
  if (kind !== "weapon" || !shooter || !target) return null;
  if (before.hullPoints === 0) return { ...before, reactorCriticalTimer: before.reactorCriticalTimer + 1 };
  const dmg = shooter.gunDamage - Math.floor((shooter.gunDamage * target.damageReduction) / 100);
  return { ...before, hullPoints: Math.max(0, before.hullPoints - Math.max(0, dmg)) };
}

/**
 * Each targeted move's outcome across a run of moves played back to back
 * (an AI turn of several moves, a PvP opponent's burst). The game data only
 * shows the board after the whole run, so a ship hit twice would otherwise
 * show the final hull on both hits, and a kill on its first. Per target, in
 * run order:
 * - a move that already carries its outcome (yours, predicted at submit; a
 *   replay or scripted move) keeps it;
 * - the last hit lands on the final state (destroyed if the final data says so);
 * - an earlier hit is predicted from the state before it (`predict`), kept
 *   between that and the final state; one that can't be predicted takes an
 *   even share of what's left to the final state.
 * Each hit starts from the one before it, so the next cinematic opens on the
 * damage the last one left. Moves with no target, or a Ram (its victim is
 * knocked off, not hit), aren't included.
 */
export function chainMoveOutcomes(params: {
  run: readonly BoardMove[];
  /** A ship's state before the run (the held board). */
  statusBefore: (shipId: number) => TargetStatusAfter | undefined;
  /** ...and after it (the live data). */
  statusFinal: (shipId: number) => TargetStatusAfter | undefined;
  /** The ship is destroyed in the live data. */
  destroyedFinal: (shipId: number) => boolean;
  /** What the move fires (weaponEffectFor's kind): a "ram" isn't a hit, a "repair" raises the hull. */
  kindOf: (move: BoardMove) => string;
  /** An earlier hit's result, or null when it can't be predicted. */
  predict: (move: BoardMove, before: TargetStatusAfter) => TargetStatusAfter | null;
}): Map<string, MoveOutcome> {
  const { run, statusBefore, statusFinal, destroyedFinal, kindOf, predict } = params;
  const isRepair = (m: BoardMove) => kindOf(m) === "repair";
  const out = new Map<string, MoveOutcome>();
  const hitsByTarget = new Map<number, BoardMove[]>();
  for (const move of run) {
    if (!move.targetShipId || kindOf(move) === "ram") continue;
    const hits = hitsByTarget.get(move.targetShipId) ?? [];
    hits.push(move);
    hitsByTarget.set(move.targetShipId, hits);
  }
  for (const [targetId, hits] of hitsByTarget) {
    const final = statusFinal(targetId);
    let running = statusBefore(targetId) ?? final;
    hits.forEach((move, i) => {
      const last = i === hits.length - 1;
      let after: TargetStatusAfter | undefined;
      if (move.targetAfter) after = move.targetAfter;
      else if (last || !running || !final) after = final;
      else {
        const later = hits.slice(i);
        const predicted = predict(move, running);
        if (predicted) {
          after = later.some(isRepair) ? predicted : clampBetween(predicted, running, final);
        } else {
          // An even share of what's left, so the run still ends on the final state.
          const share = 1 / later.length;
          after = {
            hullPoints: Math.round(running.hullPoints + (final.hullPoints - running.hullPoints) * share),
            reactorCriticalTimer: Math.round(
              running.reactorCriticalTimer + (final.reactorCriticalTimer - running.reactorCriticalTimer) * share,
            ),
          };
        }
      }
      // Only the last hit on a ship can destroy it: nothing targets a wreck.
      const killsTarget = move.killsTarget ?? (last && destroyedFinal(targetId));
      if (after) out.set(move.key, { targetAfter: after, killsTarget });
      running = after ?? running;
    });
  }
  return out;
}

/** Each value kept between the state before a hit and the run's final state (damage only goes one way). */
function clampBetween(v: TargetStatusAfter, from: TargetStatusAfter, to: TargetStatusAfter): TargetStatusAfter {
  const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, Math.min(a, b)), Math.max(a, b));
  return {
    hullPoints: clamp(v.hullPoints, from.hullPoints, to.hullPoints),
    reactorCriticalTimer: clamp(v.reactorCriticalTimer, from.reactorCriticalTimer, to.reactorCriticalTimer),
  };
}

/**
 * The held board with landed moves applied (useHeldBoard): ships on their
 * new tiles (landShipPositions) and each finished hit's target at its state
 * after that hit (chainMoveOutcomes), so the board and the next cinematic
 * show the damage as it builds up through a run. Mode-neutral.
 */
export function landBoard<
  G extends {
    shipIds: readonly (number | bigint | string)[];
    shipAttributes: readonly { hullPoints: number; reactorCriticalTimer: number }[];
    shipPositions: readonly { shipId: number | bigint | string; position: { row: number; col: number }; status?: 0 | 1 | 2 }[];
  },
>(game: G, landed: readonly BoardMove[], activeKey: string | null, outcomes: Map<string, MoveOutcome>): G {
  if (landed.length === 0) return game;
  const withOutcomes = landed.map((m) => {
    const o = outcomes.get(m.key);
    return o ? { ...m, killsTarget: o.killsTarget, targetAfter: o.targetAfter } : m;
  });
  let shipAttributes = game.shipAttributes;
  for (const move of withOutcomes) {
    if (move.key === activeKey || !move.targetAfter || !move.targetShipId) continue;
    const i = game.shipIds.findIndex((id) => Number(id) === move.targetShipId);
    if (i < 0) continue;
    if (shipAttributes === game.shipAttributes) shipAttributes = [...game.shipAttributes];
    shipAttributes = shipAttributes.map((a, j) => (j === i ? { ...a, ...move.targetAfter } : a));
  }
  return {
    ...game,
    shipAttributes,
    shipPositions: landShipPositions(game.shipPositions, withOutcomes, activeKey),
  } as G;
}
