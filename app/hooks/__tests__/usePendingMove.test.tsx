import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionType, type Attributes } from "../../types/types";
import { usePendingMove } from "../usePendingMove";

const attrs: Attributes = {
  version: 1,
  range: 3,
  gunDamage: 40,
  hullPoints: 100,
  maxHullPoints: 100,
  movement: 3,
  damageReduction: 0,
  reactorCriticalTimer: 0,
  statusEffects: [],
};

const captureParams = (baselineLastMoveKey: string) => ({
  shipId: 1,
  actionType: ActionType.Pass,
  targetShipId: 0,
  row: 5,
  col: 6,
  current: { row: 5, col: 5 },
  targetPosition: null,
  getShipAttributes: () => attrs,
  effect: { kind: "none" as const },
  baselineLastMoveKey,
});

function setup(initialKey = "a") {
  const onResolved = vi.fn();
  const hook = renderHook(
    ({ chainLastMoveKey, isGameOver }) => usePendingMove({ chainLastMoveKey, isGameOver, onResolved }),
    { initialProps: { chainLastMoveKey: initialKey, isGameOver: false } },
  );
  return { ...hook, onResolved };
}

describe("usePendingMove", () => {
  it("is only awaiting sync once sent", () => {
    const { result } = setup();
    let key = 0;
    act(() => {
      key = result.current.capture(captureParams("a"));
    });
    expect(result.current.pendingMove?.phase).toBe("signing");
    expect(result.current.isAwaitingSync).toBe(false);
    act(() => result.current.markSent(key));
    expect(result.current.isAwaitingSync).toBe(true);
  });

  it("stays pending while fresh data still has the pre-submit lastMove, resolves once it changes", () => {
    const { result, rerender, onResolved } = setup();
    act(() => {
      const key = result.current.capture(captureParams("a"));
      result.current.markSent(key);
    });
    rerender({ chainLastMoveKey: "a", isGameOver: false });
    expect(result.current.isAwaitingSync).toBe(true);
    rerender({ chainLastMoveKey: "b", isGameOver: false });
    expect(result.current.pendingMove).toBeNull();
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("resolves even if 'sent' was never reported, once fresh data shows the move", () => {
    const { result, rerender, onResolved } = setup();
    act(() => {
      result.current.capture(captureParams("a"));
    });
    rerender({ chainLastMoveKey: "a", isGameOver: false });
    expect(result.current.pendingMove?.phase).toBe("signing");
    rerender({ chainLastMoveKey: "b", isGameOver: false });
    expect(result.current.pendingMove).toBeNull();
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("fail drops the move once; a stale key or second call is a no-op", () => {
    const { result } = setup();
    let key = 0;
    act(() => {
      key = result.current.capture(captureParams("a"));
      result.current.markSent(key);
    });
    let first = false;
    let second = true;
    act(() => {
      expect(result.current.fail(key + 1)).toBe(false);
      first = result.current.fail(key);
      second = result.current.fail(key);
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(result.current.pendingMove).toBeNull();
  });

  it("clears when the game ends", () => {
    const { result, rerender } = setup();
    act(() => {
      const key = result.current.capture(captureParams("a"));
      result.current.markSent(key);
    });
    rerender({ chainLastMoveKey: "a", isGameOver: true });
    expect(result.current.pendingMove).toBeNull();
  });
});
