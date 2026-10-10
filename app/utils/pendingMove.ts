import { ActionType, type Attributes } from "../types/types";

// A move the player has submitted but the chain (web3) or server (web2)
// hasn't reflected yet. While one exists, both game views patch the game
// they render with its predicted result (applyPendingMoveToGame), so the
// board never falls back to the pre-submit state during the wait. It's
// resolved once fresh data's lastMove differs from the one captured at
// submit time (the move landed: only the mover can change lastMove on their
// own turn), and dropped if the submission fails. Number-native; the web3
// caller converts at its own boundary. Shared by GameDisplay.tsx and
// GameDisplayWeb2.tsx via usePendingMove.

export interface PendingMove {
  /** Increments per capture, so stale async handlers can tell it's not theirs. */
  key: number;
  shipId: number;
  actionType: ActionType;
  targetShipId: number;
  oldRow: number;
  oldCol: number;
  /** Where the ship ends up (Ram: the target's tile; Retreat: -1). */
  finalRow: number;
  finalCol: number;
  /** Predicted attribute changes, by ship id. */
  attributeOverrides: Record<number, Pick<Attributes, "hullPoints" | "reactorCriticalTimer">>;
  /** Ships predicted to leave the board: 1 = destroyed, 2 = fled/evicted. */
  removedShipIds: Record<number, 1 | 2>;
  /** lastMoveKey of the game when this move was submitted. */
  baselineLastMoveKey: string;
  /** Wall-clock ms, used as the patched lastMove's timestamp. */
  submittedAt: number;
  /**
   * "signing": wallet prompt open (web3) — displayed, but can't land yet.
   * "sent": broadcast / POSTed, so fresh data may now show it.
   */
  phase: "signing" | "sent";
}

export type PendingMoveEffect =
  | { kind: "none" }
  /** Shoot/Special damage, from calculateDamage. */
  | { kind: "damage"; reducedDamage: number; reactorCritical: boolean }
  /** Repair Drones / faction Repair. */
  | { kind: "heal"; amount: number }
  | { kind: "ram" }
  /** Self-centered AoE specials (Flak Array, Electric Storm): see predictAoeEffect. */
  | { kind: "area"; hits: { shipId: number; hullDamage: number; reactorDelta: number }[] };

/**
 * Who a self-centered AoE special hits from `center` (the caster's
 * destination), and how. Mirrors FlakArrayResolver.sol /
 * ElectricStormResolver.sol: every alive ship (status 0, including downed
 * ones) within Manhattan `range`.
 * - Flak Array: excludes the caster; hull damage = strength reduced by the
 *   target's damage reduction (no reactor tick, even on a downed ship).
 * - Electric Storm: includes the caster; reactor timer += strength.
 */
export function predictAoeEffect(params: {
  kind: "flak" | "storm";
  center: { row: number; col: number };
  range: number;
  strength: number;
  casterShipId: number;
  positions: readonly { shipId: AnyId; position: { row: number; col: number }; status?: number }[];
  getShipAttributes: (shipId: number) => Attributes | null;
}): PendingMoveEffect {
  const { kind, center, range, strength, casterShipId } = params;
  const hits: { shipId: number; hullDamage: number; reactorDelta: number }[] = [];
  for (const p of params.positions) {
    if ((p.status ?? 0) !== 0) continue;
    const id = Number(p.shipId);
    const isCaster = id === casterShipId;
    if (isCaster && kind === "flak") continue;
    // The caster resolves from its destination, not its pre-move tile.
    const pos = isCaster ? center : p.position;
    if (Math.abs(pos.row - center.row) + Math.abs(pos.col - center.col) > range) continue;
    if (kind === "storm") {
      hits.push({ shipId: id, hullDamage: 0, reactorDelta: strength });
    } else {
      const reduction = params.getShipAttributes(id)?.damageReduction ?? 0;
      hits.push({ shipId: id, hullDamage: strength - Math.floor((strength * reduction) / 100), reactorDelta: 0 });
    }
  }
  return { kind: "area", hits };
}

type AnyId = number | bigint;

interface LastMoveLike {
  shipId: AnyId;
  oldRow: number;
  oldCol: number;
  newRow: number;
  newCol: number;
  actionType: number;
  targetShipId: AnyId;
  timestamp: AnyId;
}

/** Identity of a lastMove, for "has the game moved on since submit". */
export function lastMoveKey(lastMove: LastMoveLike | undefined | null): string {
  if (!lastMove) return "";
  return [
    lastMove.shipId,
    lastMove.timestamp,
    lastMove.actionType,
    lastMove.targetShipId,
    lastMove.oldRow,
    lastMove.oldCol,
    lastMove.newRow,
    lastMove.newCol,
  ].join(":");
}

/** Reactor stack at which a ship is destroyed (matches calculateDamage's wouldDestroy). */
const REACTOR_DESTROY_AT = 3;

export function buildPendingMove(params: {
  key: number;
  shipId: number;
  actionType: ActionType;
  targetShipId: number;
  /** Submitted destination. */
  row: number;
  col: number;
  current: { row: number; col: number };
  targetPosition: { row: number; col: number } | null;
  getShipAttributes: (shipId: number) => Attributes | null;
  effect: PendingMoveEffect;
  baselineLastMoveKey: string;
  phase: PendingMove["phase"];
}): PendingMove {
  const { shipId, actionType, targetShipId, effect, getShipAttributes } = params;
  const attributeOverrides: PendingMove["attributeOverrides"] = {};
  const removedShipIds: PendingMove["removedShipIds"] = {};

  const tickReactor = (id: number) => {
    const attrs = getShipAttributes(id);
    if (!attrs) return;
    const timer = attrs.reactorCriticalTimer + 1;
    attributeOverrides[id] = { hullPoints: attrs.hullPoints, reactorCriticalTimer: timer };
    if (timer >= REACTOR_DESTROY_AT) removedShipIds[id] = 1;
  };

  let finalRow = params.row;
  let finalCol = params.col;

  if (actionType === ActionType.Retreat) {
    finalRow = -1;
    finalCol = -1;
    removedShipIds[shipId] = 2;
  } else if (effect.kind === "ram" && params.targetPosition) {
    // RamResolver: evict the target, move onto its tile, rammer reactor +1.
    removedShipIds[targetShipId] = 2;
    finalRow = params.targetPosition.row;
    finalCol = params.targetPosition.col;
    tickReactor(shipId);
  } else if (effect.kind === "damage" && targetShipId > 0) {
    const attrs = getShipAttributes(targetShipId);
    if (attrs) {
      if (effect.reactorCritical) {
        tickReactor(targetShipId);
      } else {
        attributeOverrides[targetShipId] = {
          hullPoints: Math.max(0, attrs.hullPoints - effect.reducedDamage),
          reactorCriticalTimer: attrs.reactorCriticalTimer,
        };
      }
    }
  } else if (effect.kind === "area") {
    for (const hit of effect.hits) {
      const attrs = getShipAttributes(hit.shipId);
      if (!attrs) continue;
      const timer = attrs.reactorCriticalTimer + hit.reactorDelta;
      attributeOverrides[hit.shipId] = {
        hullPoints: Math.max(0, attrs.hullPoints - hit.hullDamage),
        reactorCriticalTimer: timer,
      };
      if (timer >= REACTOR_DESTROY_AT) removedShipIds[hit.shipId] = 1;
    }
  } else if (effect.kind === "heal" && targetShipId > 0) {
    const attrs = getShipAttributes(targetShipId);
    if (attrs) {
      attributeOverrides[targetShipId] = {
        hullPoints: Math.min(attrs.maxHullPoints, attrs.hullPoints + effect.amount),
        reactorCriticalTimer: attrs.reactorCriticalTimer,
      };
    }
  }

  return {
    key: params.key,
    shipId,
    actionType,
    targetShipId,
    oldRow: params.current.row,
    oldCol: params.current.col,
    finalRow,
    finalCol,
    attributeOverrides,
    removedShipIds,
    baselineLastMoveKey: params.baselineLastMoveKey,
    submittedAt: Date.now(),
    phase: params.phase,
  };
}

interface PatchableGame<Id extends AnyId, LM extends LastMoveLike> {
  shipIds: readonly Id[];
  shipAttributes: readonly Attributes[];
  shipPositions: readonly {
    shipId: Id;
    position: { row: number; col: number };
    isCreator: boolean;
    status?: 0 | 1 | 2;
  }[];
  creatorActiveShipIds: readonly Id[];
  joinerActiveShipIds: readonly Id[];
  creatorMovedShipIds: readonly Id[];
  joinerMovedShipIds: readonly Id[];
  lastMove?: LM;
}

/**
 * The game as it will look once `pending` lands: mover relocated (or
 * removed on Retreat), predicted hull/reactor changes, evicted/destroyed
 * ships marked, mover marked as moved this round, and lastMove set to this
 * move (old tile -> final tile) so the last-move arrow/ghost shows it.
 * Applied from the moment of submit (any phase); returns `game` unchanged
 * when nothing is pending.
 */
export function applyPendingMoveToGame<
  Id extends AnyId,
  LM extends LastMoveLike,
  G extends PatchableGame<Id, LM>,
>(game: G, pending: PendingMove | null, toId: (n: number) => Id): G {
  if (!pending) return game;

  const shipAttributes = game.shipIds.map((id, i) => {
    const override = pending.attributeOverrides[Number(id)];
    const base = game.shipAttributes[i];
    return override && base ? { ...base, ...override } : base;
  });

  let moverIsCreator: boolean | null = null;
  const shipPositions = game.shipPositions.map((p) => {
    const id = Number(p.shipId);
    const removed = pending.removedShipIds[id];
    if (id === pending.shipId) {
      moverIsCreator = p.isCreator;
      if (removed) return { ...p, status: removed };
      return { ...p, position: { row: pending.finalRow, col: pending.finalCol } };
    }
    return removed ? { ...p, status: removed } : p;
  });

  const moverId = toId(pending.shipId);
  const addMover = (ids: readonly Id[]) =>
    ids.some((id) => Number(id) === pending.shipId) ? ids : [...ids, moverId];

  const lastMove = {
    ...game.lastMove,
    shipId: moverId,
    oldRow: pending.oldRow,
    oldCol: pending.oldCol,
    newRow: pending.finalRow,
    newCol: pending.finalCol,
    actionType: pending.actionType,
    targetShipId: toId(pending.targetShipId),
    // web3 lastMove timestamps are block seconds (bigint), web2's are ms.
    timestamp: typeof moverId === "bigint" ? BigInt(Math.floor(pending.submittedAt / 1000)) : pending.submittedAt,
  } as unknown as LM;
  const notRemoved = (ids: readonly Id[]) => {
    const next = ids.filter((id) => !pending.removedShipIds[Number(id)]);
    return next.length === ids.length ? ids : next;
  };

  return {
    ...game,
    shipAttributes,
    shipPositions,
    creatorActiveShipIds: notRemoved(game.creatorActiveShipIds),
    joinerActiveShipIds: notRemoved(game.joinerActiveShipIds),
    creatorMovedShipIds: moverIsCreator === true ? addMover(game.creatorMovedShipIds) : game.creatorMovedShipIds,
    joinerMovedShipIds: moverIsCreator === false ? addMover(game.joinerMovedShipIds) : game.joinerMovedShipIds,
    lastMove,
  };
}
