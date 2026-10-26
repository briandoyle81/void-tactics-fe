import { describe, expect, it } from "vitest";
import { coverVerdict } from "../useBoardCovered";

describe("coverVerdict", () => {
  const nine = (covered: number[]) => Array.from({ length: 9 }, (_, i) => covered.includes(i));

  it("is uncovered with nothing over the board", () => {
    expect(coverVerdict(nine([]))).toBe(false);
  });

  it("is covered when something sits over the centre", () => {
    expect(coverVerdict(nine([0]))).toBe(true);
  });

  it("ignores a toast or HUD piece over one corner", () => {
    expect(coverVerdict(nine([3]))).toBe(false);
    expect(coverVerdict(nine([2, 3]))).toBe(false);
  });

  it("is covered when half or more of the points are", () => {
    expect(coverVerdict(nine([1, 2, 3, 4, 5]))).toBe(true);
  });

  it("is uncovered with no points", () => {
    expect(coverVerdict([])).toBe(false);
  });
});
