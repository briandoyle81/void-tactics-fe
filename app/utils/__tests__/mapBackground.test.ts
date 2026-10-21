import { describe, expect, it } from "vitest";
import { MAP_BACKGROUNDS, mapBackgroundFor } from "../mapBackground";

const grid = <T,>(v: T) => Array.from({ length: 11 }, () => Array<T>(17).fill(v));

function map(blockedAt: [number, number][], points = 0) {
  const blocked = grid(false);
  blockedAt.forEach(([r, c]) => (blocked[r][c] = true));
  const scoring = grid(0);
  scoring[5][8] = points;
  return [blocked, scoring, grid(false), grid(false)] as const;
}

describe("mapBackgroundFor", () => {
  it("picks the same image for the same tiles", () => {
    expect(mapBackgroundFor(...map([[1, 2]]))).toBe(mapBackgroundFor(...map([[1, 2]])));
  });

  it("spreads different maps across every image", () => {
    const picked = new Set<string>();
    for (let r = 0; r < 11; r++) for (let c = 0; c < 17; c++) picked.add(mapBackgroundFor(...map([[r, c]], 3)));
    expect([...picked].sort()).toEqual([...MAP_BACKGROUNDS].sort());
  });
});
