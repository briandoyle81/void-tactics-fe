import { describe, expect, it } from "vitest";
import type { BoardMove } from "../../hooks/useMovePlayback";
import { chainMoveOutcomes, landBoard, predictHit } from "../movePlaybackBoard";

const hit = (key: string, targetShipId: number, overrides: Partial<BoardMove> = {}): BoardMove => ({
  key,
  shipId: 1,
  from: { row: 0, col: 0 },
  to: { row: 0, col: 1 },
  actionType: 1,
  targetShipId,
  ...overrides,
});

const statuses = (m: Record<number, [number, number]>) => (id: number) =>
  m[id] ? { hullPoints: m[id][0], reactorCriticalTimer: m[id][1] } : undefined;

const base = {
  destroyedFinal: () => false,
  kindOf: () => "main",
};

describe("chainMoveOutcomes", () => {
  it("a single hit lands on the final state", () => {
    const out = chainMoveOutcomes({
      ...base,
      run: [hit("a", 9)],
      statusBefore: statuses({ 9: [100, 0] }),
      statusFinal: statuses({ 9: [60, 0] }),
      predict: () => null,
    });
    expect(out.get("a")).toEqual({ targetAfter: { hullPoints: 60, reactorCriticalTimer: 0 }, killsTarget: false });
  });

  it("chains two hits on one ship: the first predicted, the second on the final state", () => {
    const out = chainMoveOutcomes({
      ...base,
      run: [hit("a", 9), hit("b", 9)],
      statusBefore: statuses({ 9: [100, 0] }),
      statusFinal: statuses({ 9: [40, 0] }),
      predict: (_m, before) => ({ ...before, hullPoints: before.hullPoints - 30 }),
    });
    expect(out.get("a")?.targetAfter.hullPoints).toBe(70);
    expect(out.get("b")?.targetAfter.hullPoints).toBe(40);
  });

  it("splits what's left evenly when a hit can't be predicted, and only the last hit kills", () => {
    const out = chainMoveOutcomes({
      ...base,
      destroyedFinal: (id) => id === 9,
      run: [hit("a", 9), hit("b", 9)],
      statusBefore: statuses({ 9: [80, 0] }),
      statusFinal: statuses({ 9: [0, 0] }),
      predict: () => null,
    });
    expect(out.get("a")).toEqual({ targetAfter: { hullPoints: 40, reactorCriticalTimer: 0 }, killsTarget: false });
    expect(out.get("b")?.killsTarget).toBe(true);
  });

  it("keeps a prediction between the state before and the final state", () => {
    const out = chainMoveOutcomes({
      ...base,
      run: [hit("a", 9), hit("b", 9)],
      statusBefore: statuses({ 9: [100, 0] }),
      statusFinal: statuses({ 9: [50, 0] }),
      predict: (_m, before) => ({ ...before, hullPoints: 10 }),
    });
    expect(out.get("a")?.targetAfter.hullPoints).toBe(50);
  });

  it("keeps a move's own outcome and leaves rams out", () => {
    const own = { hullPoints: 77, reactorCriticalTimer: 1 };
    const out = chainMoveOutcomes({
      ...base,
      kindOf: (m) => (m.key === "ram" ? "ram" : "main"),
      run: [hit("own", 9, { targetAfter: own, killsTarget: false }), hit("ram", 8)],
      statusBefore: statuses({ 9: [100, 0], 8: [50, 0] }),
      statusFinal: statuses({ 9: [77, 1], 8: [50, 0] }),
      predict: () => null,
    });
    expect(out.get("own")?.targetAfter).toEqual(own);
    expect(out.has("ram")).toBe(false);
  });
});

describe("predictHit", () => {
  it("a weapon does its damage less the reduction, rounded down", () => {
    expect(predictHit("weapon", { hullPoints: 100, reactorCriticalTimer: 0 }, { gunDamage: 25 }, { damageReduction: 10 }))
      .toEqual({ hullPoints: 77, reactorCriticalTimer: 0 });
  });

  it("a weapon on a disabled ship, or an EMP, ticks the reactor", () => {
    expect(predictHit("weapon", { hullPoints: 0, reactorCriticalTimer: 1 }, { gunDamage: 25 }, { damageReduction: 0 }))
      .toEqual({ hullPoints: 0, reactorCriticalTimer: 2 });
    expect(predictHit("emp", { hullPoints: 50, reactorCriticalTimer: 0 }, null, null)).toEqual({
      hullPoints: 50,
      reactorCriticalTimer: 1,
    });
  });

  it("can't predict drones or repairs", () => {
    expect(predictHit("other", { hullPoints: 50, reactorCriticalTimer: 0 }, { gunDamage: 10 }, { damageReduction: 0 })).toBeNull();
  });
});

describe("landBoard", () => {
  const game = {
    shipIds: [1, 9],
    shipAttributes: [
      { hullPoints: 100, reactorCriticalTimer: 0 },
      { hullPoints: 100, reactorCriticalTimer: 0 },
    ],
    shipPositions: [
      { shipId: 1, position: { row: 0, col: 0 }, status: 0 as const },
      { shipId: 9, position: { row: 0, col: 5 }, status: 0 as const },
    ],
  };
  const outcomes = new Map([["a", { targetAfter: { hullPoints: 70, reactorCriticalTimer: 0 }, killsTarget: false }]]);

  it("puts a finished hit's target at its state after it", () => {
    const board = landBoard(game, [hit("a", 9)], null, outcomes);
    expect(board.shipAttributes[1].hullPoints).toBe(70);
    expect(board.shipPositions[0].position).toEqual({ row: 0, col: 1 });
  });

  it("leaves the active hit's target as it was until the hit is done", () => {
    const board = landBoard(game, [hit("a", 9)], "a", outcomes);
    expect(board.shipAttributes[1].hullPoints).toBe(100);
  });
});
