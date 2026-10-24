import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMovePlayback, type BoardMove } from "../useMovePlayback";
import { landShipPositions, shipStatusIn } from "../../utils/movePlaybackBoard";

const move = (key: string, overrides: Partial<BoardMove> = {}): BoardMove => ({
  key,
  shipId: 1,
  from: { row: 0, col: 0 },
  to: { row: 0, col: 3 },
  actionType: 1,
  targetShipId: 2,
  ...overrides,
});

describe("useMovePlayback", () => {
  it("plays each move moving, then firing, in order", () => {
    const { result } = renderHook(() => useMovePlayback());
    act(() => result.current.enqueue([move("a"), move("b")]));
    expect(result.current.active).toMatchObject({ move: { key: "a" }, phase: "moving" });
    act(() => result.current.advance("a", "moving"));
    expect(result.current.active?.phase).toBe("firing");
    expect(result.current.landed.map((m) => m.key)).toEqual(["a"]);
    act(() => result.current.advance("a", "firing"));
    expect(result.current.active).toMatchObject({ move: { key: "b" }, phase: "moving" });
    act(() => result.current.advance("b", "moving"));
    act(() => result.current.advance("b", "firing"));
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.landed).toEqual([]);
  });

  it("ignores a stale phase end and plays a move only once", () => {
    const { result } = renderHook(() => useMovePlayback());
    act(() => result.current.enqueue([move("a")]));
    act(() => result.current.advance("a", "firing"));
    expect(result.current.active?.phase).toBe("moving");
    act(() => result.current.advance("other", "moving"));
    expect(result.current.active?.phase).toBe("moving");
    act(() => result.current.enqueue([move("a")]));
    act(() => result.current.advance("a", "moving"));
    act(() => result.current.advance("a", "firing"));
    expect(result.current.isPlaying).toBe(false);
  });

  it("reset drops the queue", () => {
    const { result } = renderHook(() => useMovePlayback());
    act(() => result.current.enqueue([move("a"), move("b")]));
    act(() => result.current.reset());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.active).toBeNull();
  });
});

describe("landShipPositions", () => {
  const positions = [
    { shipId: 1, position: { row: 0, col: 0 }, isCreator: true, status: 0 as const },
    { shipId: 2, position: { row: 0, col: 5 }, isCreator: false, status: 0 as const },
  ];

  it("puts a landed ship on its new tile, keeping the target while it's fired at", () => {
    const landed = landShipPositions(positions, [move("a", { killsTarget: true })], "a");
    expect(landed[0].position).toEqual({ row: 0, col: 3 });
    expect(landed[1].status).toBe(0);
  });

  it("takes a finished move's destroyed target off", () => {
    const landed = landShipPositions(positions, [move("a", { killsTarget: true })], null);
    expect(landed[1].status).toBe(1);
  });

  it("a retreat leaves the board", () => {
    const landed = landShipPositions(positions, [move("a", { actionType: 2, to: { row: 0, col: 0 } })], "a");
    expect(landed[0].status).toBe(2);
  });
});

describe("shipStatusIn", () => {
  const game = {
    shipIds: [10n, 20n],
    shipAttributes: [
      { hullPoints: 80, reactorCriticalTimer: 0 },
      { hullPoints: 12, reactorCriticalTimer: 2 },
    ],
  };

  it("reads a ship's hull and reactor damage by id", () => {
    expect(shipStatusIn(game, 20)).toEqual({ hullPoints: 12, reactorCriticalTimer: 2 });
  });

  it("is undefined for no target or a ship not in the game", () => {
    expect(shipStatusIn(game, 0)).toBeUndefined();
    expect(shipStatusIn(game, 30)).toBeUndefined();
  });
});
