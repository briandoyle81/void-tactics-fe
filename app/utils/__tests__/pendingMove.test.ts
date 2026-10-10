import { describe, expect, it } from "vitest";
import { ActionType, type Attributes } from "../../types/types";
import { applyPendingMoveToGame, buildPendingMove, lastMoveKey, predictAoeEffect } from "../pendingMove";

const attrs = (hull: number, timer = 0): Attributes => ({
  version: 1,
  range: 3,
  gunDamage: 40,
  hullPoints: hull,
  maxHullPoints: 100,
  movement: 3,
  damageReduction: 0,
  reactorCriticalTimer: timer,
  statusEffects: [],
});

// Ship 1 (creator) at (5,5); ship 2 (joiner) at (5,8).
function makeGame(hull2 = 100, timer2 = 0) {
  return {
    shipIds: [1, 2],
    shipAttributes: [attrs(100), attrs(hull2, timer2)],
    shipPositions: [
      { shipId: 1, position: { row: 5, col: 5 }, isCreator: true, status: 0 as const },
      { shipId: 2, position: { row: 5, col: 8 }, isCreator: false, status: 0 as const },
    ],
    creatorActiveShipIds: [1],
    joinerActiveShipIds: [2],
    creatorMovedShipIds: [] as number[],
    joinerMovedShipIds: [] as number[],
    lastMove: { shipId: 2, oldRow: 0, oldCol: 0, newRow: 5, newCol: 8, actionType: ActionType.Pass, targetShipId: 0, timestamp: 1000 },
  };
}

function pending(game: ReturnType<typeof makeGame>, overrides: Partial<Parameters<typeof buildPendingMove>[0]>) {
  return buildPendingMove({
    key: 1,
    shipId: 1,
    actionType: ActionType.Shoot,
    targetShipId: 0,
    row: 5,
    col: 6,
    current: { row: 5, col: 5 },
    targetPosition: null,
    getShipAttributes: (id) => game.shipAttributes[game.shipIds.indexOf(id)] ?? null,
    effect: { kind: "none" },
    baselineLastMoveKey: lastMoveKey(game.lastMove),
    phase: "sent",
    ...overrides,
  });
}

describe("applyPendingMoveToGame", () => {
  it("shows the move from submit (while signing too); nothing when none is pending", () => {
    const game = makeGame();
    const signing = applyPendingMoveToGame(game, pending(game, { actionType: ActionType.Pass, phase: "signing" }), (n) => n);
    expect(signing.shipPositions[0].position).toEqual({ row: 5, col: 6 });
    expect(applyPendingMoveToGame(game, null, (n) => n)).toBe(game);
  });

  it("moves the ship, marks it moved, and makes it the last move", () => {
    const game = makeGame();
    const out = applyPendingMoveToGame(game, pending(game, { actionType: ActionType.Pass }), (n) => n);
    expect(out.shipPositions[0].position).toEqual({ row: 5, col: 6 });
    expect(out.creatorMovedShipIds).toEqual([1]);
    expect(out.lastMove).toMatchObject({ shipId: 1, oldRow: 5, oldCol: 5, newRow: 5, newCol: 6 });
  });

  it("applies predicted shot damage", () => {
    const game = makeGame(100);
    const out = applyPendingMoveToGame(
      game,
      pending(game, { targetShipId: 2, effect: { kind: "damage", reducedDamage: 40, reactorCritical: false } }),
      (n) => n,
    );
    expect(out.shipAttributes[1].hullPoints).toBe(60);
  });

  it("ram: rammer lands on the target's tile, target leaves, rammer reactor +1", () => {
    const game = makeGame(0);
    const out = applyPendingMoveToGame(
      game,
      pending(game, {
        actionType: ActionType.FactionAbility,
        targetShipId: 2,
        row: 5,
        col: 7, // staging tile, adjacent to the target
        targetPosition: { row: 5, col: 8 },
        effect: { kind: "ram" },
      }),
      (n) => n,
    );
    expect(out.shipPositions[0].position).toEqual({ row: 5, col: 8 });
    expect(out.shipPositions[1].status).toBe(2);
    expect(out.joinerActiveShipIds).toEqual([]);
    expect(out.shipAttributes[0].reactorCriticalTimer).toBe(1);
    expect(out.lastMove).toMatchObject({ newRow: 5, newCol: 8 });
  });

  it("a third reactor tick destroys the target", () => {
    const game = makeGame(0, 2);
    const out = applyPendingMoveToGame(
      game,
      pending(game, { targetShipId: 2, effect: { kind: "damage", reducedDamage: 0, reactorCritical: true } }),
      (n) => n,
    );
    expect(out.shipPositions[1].status).toBe(1);
  });

  it("retreat removes the mover", () => {
    const game = makeGame();
    const out = applyPendingMoveToGame(game, pending(game, { actionType: ActionType.Retreat }), (n) => n);
    expect(out.shipPositions[0].status).toBe(2);
    expect(out.lastMove).toMatchObject({ newRow: -1, newCol: -1 });
  });

  it("heals cap at max hull", () => {
    const game = makeGame(90);
    const out = applyPendingMoveToGame(
      game,
      pending(game, { targetShipId: 2, effect: { kind: "heal", amount: 50 } }),
      (n) => n,
    );
    expect(out.shipAttributes[1].hullPoints).toBe(100);
  });

  it("uses bigint ids and second timestamps for web3 games", () => {
    const game = {
      ...makeGame(),
      shipIds: [1n, 2n],
      shipPositions: makeGame().shipPositions.map((p) => ({ ...p, shipId: BigInt(p.shipId) })),
      creatorActiveShipIds: [1n],
      joinerActiveShipIds: [2n],
      creatorMovedShipIds: [] as bigint[],
      joinerMovedShipIds: [] as bigint[],
      lastMove: { ...makeGame().lastMove, shipId: 2n, targetShipId: 0n, timestamp: 1000n },
    };
    const move = buildPendingMove({
      key: 1,
      shipId: 1,
      actionType: ActionType.Pass,
      targetShipId: 0,
      row: 5,
      col: 6,
      current: { row: 5, col: 5 },
      targetPosition: null,
      getShipAttributes: () => attrs(100),
      effect: { kind: "none" },
      baselineLastMoveKey: lastMoveKey(game.lastMove),
      phase: "sent",
    });
    const out = applyPendingMoveToGame(game, move, (n) => BigInt(n));
    expect(out.creatorMovedShipIds).toEqual([1n]);
    expect(typeof out.lastMove?.timestamp).toBe("bigint");
    expect(out.lastMove?.shipId).toBe(1n);
  });
});

describe("predictAoeEffect", () => {
  // Caster (ship 1) moves from (5,5) to (5,6); ship 2 at (5,8), ship 3 far away.
  const positions = [
    { shipId: 1, position: { row: 5, col: 5 }, status: 0 },
    { shipId: 2, position: { row: 5, col: 8 }, status: 0 },
    { shipId: 3, position: { row: 0, col: 0 }, status: 0 },
    { shipId: 4, position: { row: 5, col: 7 }, status: 1 }, // destroyed
  ];
  const getAttrs = (id: number) => (id === 2 ? { ...attrs(100), damageReduction: 50 } : attrs(100, 1));

  it("Flak: everything in range of the destination except the caster, reduced by damage reduction", () => {
    const effect = predictAoeEffect({
      kind: "flak",
      center: { row: 5, col: 6 },
      range: 3,
      strength: 30,
      casterShipId: 1,
      positions,
      getShipAttributes: getAttrs,
    });
    expect(effect).toEqual({ kind: "area", hits: [{ shipId: 2, hullDamage: 15, reactorDelta: 0 }] });
  });

  it("Electric Storm: includes the caster at its destination and ticks reactors", () => {
    const effect = predictAoeEffect({
      kind: "storm",
      center: { row: 5, col: 6 },
      range: 2,
      strength: 2,
      casterShipId: 1,
      positions,
      getShipAttributes: getAttrs,
    });
    expect(effect).toEqual({
      kind: "area",
      hits: [
        { shipId: 1, hullDamage: 0, reactorDelta: 2 },
        { shipId: 2, hullDamage: 0, reactorDelta: 2 },
      ],
    });
  });

  it("applies area hits, destroying ships whose reactor reaches 3", () => {
    const game = makeGame(100, 1);
    const out = applyPendingMoveToGame(
      game,
      pending(game, {
        actionType: ActionType.Special,
        effect: {
          kind: "area",
          hits: [
            { shipId: 1, hullDamage: 0, reactorDelta: 2 },
            { shipId: 2, hullDamage: 0, reactorDelta: 2 },
          ],
        },
      }),
      (n) => n,
    );
    expect(out.shipAttributes[0].reactorCriticalTimer).toBe(2);
    expect(out.shipPositions[1].status).toBe(1);
  });
});
