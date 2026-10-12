import { describe, expect, it } from "vitest";
import { selectDialogLines } from "../missionDialog";
import type { GenericDialogLine } from "../../types/dialog";

const mission = { kind: "campaign" as const, nodeId: 1 };
const base = {
  round: 1,
  myScore: 0,
  enemyScore: 0,
  myShipsDisabled: 0,
  enemyShipsDisabled: 0,
  myShipsDestroyed: 0,
  enemyShipsDestroyed: 0,
  myShipsRetreated: 0,
  enemyShipsRetreated: 0,
  myReactorDamage: 0,
  enemyReactorDamage: 0,
  myResourceTilesTaken: 0,
  enemyResourceTilesTaken: 0,
  outcome: null,
};
const lines: GenericDialogLine[] = [
  {
    id: "explain-disabled",
    characterId: "adjutant",
    trigger: { type: "shipsDisabled", side: "enemy", count: 1 },
    canHide: true,
    variants: ["Enemy ship disabled."],
  },
];

describe("generic lines with canHide", () => {
  it("tags the line so its card shows Don't show again", () => {
    const items = selectDialogLines({
      mission,
      gameId: "1",
      prev: base,
      next: { ...base, enemyShipsDisabled: 1 },
      firedKeys: new Set(),
      missionLines: [],
      genericLines: lines,
    });
    expect(items).toHaveLength(1);
    expect(items[0].hideableLineId).toBe("explain-disabled");
  });

  it("skips a line the player hid", () => {
    const items = selectDialogLines({
      mission,
      gameId: "1",
      prev: base,
      next: { ...base, enemyShipsDisabled: 1 },
      firedKeys: new Set(),
      missionLines: [],
      genericLines: lines,
      hiddenGenericLineIds: new Set(["explain-disabled"]),
    });
    expect(items).toHaveLength(0);
  });
});
