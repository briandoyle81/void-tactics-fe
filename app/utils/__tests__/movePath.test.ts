import { describe, it, expect } from "vitest";
import { findMovePath, lShapedPath, pathCorners } from "../movePath";

const W = 17;
const H = 11;
const empty = () => Array.from({ length: H }, () => Array<boolean>(W).fill(false));

function isConnected(path: { row: number; col: number }[]) {
  return path.every(
    (t, i) => i === 0 || Math.abs(t.row - path[i - 1].row) + Math.abs(t.col - path[i - 1].col) === 1,
  );
}

describe("findMovePath", () => {
  it("goes straight along a clear row", () => {
    const path = findMovePath({ row: 5, col: 2 }, { row: 5, col: 6 }, { width: W, height: H });
    expect(path).toHaveLength(5);
    expect(pathCorners(path)).toEqual([{ row: 5, col: 2 }, { row: 5, col: 6 }]);
  });

  it("takes one turn for a diagonal move on an open board", () => {
    const path = findMovePath({ row: 2, col: 2 }, { row: 5, col: 6 }, { width: W, height: H });
    expect(path).toHaveLength(8);
    expect(isConnected(path)).toBe(true);
    expect(pathCorners(path)).toHaveLength(3);
  });

  it("goes around asteroids", () => {
    const impassable = empty();
    impassable[5][4] = true;
    const path = findMovePath({ row: 5, col: 2 }, { row: 5, col: 6 }, { width: W, height: H, impassableGrid: impassable });
    expect(isConnected(path)).toBe(true);
    expect(path.some((t) => t.row === 5 && t.col === 4)).toBe(false);
    expect(path[path.length - 1]).toEqual({ row: 5, col: 6 });
  });

  it("goes around enemy ships but may end on one (a Ram)", () => {
    const enemies = empty();
    enemies[5][4] = true;
    enemies[5][6] = true;
    const path = findMovePath({ row: 5, col: 2 }, { row: 5, col: 6 }, { width: W, height: H, enemyOccupiedGrid: enemies });
    expect(path.some((t) => t.row === 5 && t.col === 4)).toBe(false);
    expect(path[path.length - 1]).toEqual({ row: 5, col: 6 });
  });

  it("falls back to an L shape when nothing gets there", () => {
    const impassable = empty();
    for (const [r, c] of [[4, 6], [6, 6], [5, 5], [5, 7]]) impassable[r][c] = true;
    const path = findMovePath({ row: 2, col: 2 }, { row: 5, col: 6 }, { width: W, height: H, impassableGrid: impassable });
    expect(path).toEqual(lShapedPath({ row: 2, col: 2 }, { row: 5, col: 6 }));
  });

  it("is just the tile for a hold", () => {
    expect(findMovePath({ row: 3, col: 3 }, { row: 3, col: 3 }, { width: W, height: H })).toEqual([{ row: 3, col: 3 }]);
  });
});
