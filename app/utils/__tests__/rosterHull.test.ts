import { describe, expect, it } from "vitest";
import {
  currentHullFromOnchainRosterHp,
  currentHullFromWeb2RosterHp,
  overlayHullPoints,
} from "../rosterHull";
import type { Attributes } from "../../types/types";

const attrs = (hull: number, max = 100): Attributes => ({
  version: 1,
  range: 1,
  gunDamage: 1,
  hullPoints: hull,
  maxHullPoints: max,
  movement: 1,
  damageReduction: 0,
  reactorCriticalTimer: 0,
  statusEffects: [],
});

describe("roster hull", () => {
  it("treats on-chain 0 as full, and a nonzero value as current HP", () => {
    expect(currentHullFromOnchainRosterHp(0, 80)).toBe(80);
    expect(currentHullFromOnchainRosterHp(40, 80)).toBe(40);
    expect(currentHullFromOnchainRosterHp(99, 80)).toBe(80);
  });

  it("treats web2 hp as damage taken", () => {
    expect(currentHullFromWeb2RosterHp(0, 80)).toBe(80);
    expect(currentHullFromWeb2RosterHp(30, 80)).toBe(50);
    expect(currentHullFromWeb2RosterHp(99, 80)).toBe(0);
  });

  it("overlays roster hull onto calculated attributes", () => {
    const map = new Map<number, Attributes>([
      [1, attrs(100)],
      [2, attrs(100)],
    ]);
    const overlaid = overlayHullPoints(map, (id) => (id === 1 ? 40 : undefined));
    expect(overlaid.get(1)?.hullPoints).toBe(40);
    expect(overlaid.get(2)?.hullPoints).toBe(100);
    expect(map.get(1)?.hullPoints).toBe(100);
  });
});
