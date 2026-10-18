import { describe, it, expect } from "vitest";
import { ActionType } from "../../types/types";
import type { GridShipPosition } from "../../types/gridDisplay";
import {
  buildDisplayGrid,
  computeActionType,
  computeConfirmWidgetLabel,
  computeIsShowingProposedMove,
} from "../gameplayDerived";

const base = {
  hasSelection: true,
  isOwnShip: true,
  isSubmitting: false,
  isMyTurn: true,
  hasMoved: false,
  isDisabled: false,
};

describe("computeIsShowingProposedMove", () => {
  it("shows for your own unmoved ship on your turn", () => {
    expect(computeIsShowingProposedMove(base)).toBe(true);
  });
  it("hides with no selection or an enemy ship", () => {
    expect(computeIsShowingProposedMove({ ...base, hasSelection: false })).toBe(false);
    expect(computeIsShowingProposedMove({ ...base, isOwnShip: false })).toBe(false);
  });
  it("hides off turn, except while a submitted move settles", () => {
    expect(computeIsShowingProposedMove({ ...base, isMyTurn: false })).toBe(false);
    expect(computeIsShowingProposedMove({ ...base, isMyTurn: false, isSubmitting: true })).toBe(true);
  });
  it("hides for a moved ship unless it's disabled (it can still retreat)", () => {
    expect(computeIsShowingProposedMove({ ...base, hasMoved: true })).toBe(false);
    expect(computeIsShowingProposedMove({ ...base, hasMoved: true, isDisabled: true })).toBe(true);
  });
});

const action = {
  actionOverride: null,
  isRammingMovePreview: false,
  targetShipId: null,
  selectedWeaponType: "weapon" as const,
  specialType: 0,
  isFactionAbilitySupported: true,
};

describe("computeActionType", () => {
  it("is a plain move without a target", () => {
    expect(computeActionType(action)).toBe(ActionType.Pass);
  });
  it("an override (Retreat) wins", () => {
    expect(computeActionType({ ...action, actionOverride: ActionType.Retreat, targetShipId: 5 })).toBe(
      ActionType.Retreat,
    );
  });
  it("a legacy ram (moving onto a disabled enemy) submits Pass", () => {
    expect(computeActionType({ ...action, isRammingMovePreview: true, targetShipId: 5 })).toBe(ActionType.Pass);
  });
  it("shoots or uses the special at a target", () => {
    expect(computeActionType({ ...action, targetShipId: 5 })).toBe(ActionType.Shoot);
    expect(computeActionType({ ...action, targetShipId: 5, selectedWeaponType: "special" })).toBe(
      ActionType.Special,
    );
  });
  it("ram mode is FactionAbility only where supported", () => {
    expect(computeActionType({ ...action, targetShipId: 5, selectedWeaponType: "ram" })).toBe(
      ActionType.FactionAbility,
    );
    expect(
      computeActionType({ ...action, targetShipId: 5, selectedWeaponType: "ram", isFactionAbilitySupported: false }),
    ).toBe(ActionType.Shoot);
  });
  it("Flak's self-centred special uses target 0", () => {
    expect(computeActionType({ ...action, targetShipId: 0, selectedWeaponType: "special", specialType: 3 })).toBe(
      ActionType.Special,
    );
  });
});

const label = {
  actionType: ActionType.Shoot,
  selectedWeaponType: "weapon" as const,
  shipVariant: 1,
  specialType: 0,
  targetShipId: 5,
  factionAbilityIsHeal: false,
};

describe("computeConfirmWidgetLabel", () => {
  it("names each action", () => {
    expect(computeConfirmWidgetLabel(label)).toBe("FIRE");
    expect(computeConfirmWidgetLabel({ ...label, actionType: ActionType.Retreat })).toBe("RETREAT");
    expect(computeConfirmWidgetLabel({ ...label, actionType: ActionType.Pass })).toBe("HOLD FIRE");
    expect(computeConfirmWidgetLabel({ ...label, actionType: ActionType.FactionAbility })).toBe("RAM");
    expect(
      computeConfirmWidgetLabel({ ...label, actionType: ActionType.FactionAbility, factionAbilityIsHeal: true }),
    ).toBe("REPAIR");
  });
  it("repair drones read REPAIR", () => {
    expect(
      computeConfirmWidgetLabel({ ...label, actionType: ActionType.Special, selectedWeaponType: "special", specialType: 2 }),
    ).toBe("REPAIR");
  });
});

function pos(shipId: number, row: number, col: number, status?: 0 | 1 | 2): GridShipPosition {
  return { shipId, position: { row, col }, isCreator: true, status };
}

const gridArgs = {
  gridWidth: 5,
  gridHeight: 4,
  aliveShipPositions: [pos(1, 1, 1), pos(2, 2, 3)],
  allShipPositions: [pos(1, 1, 1), pos(2, 2, 3), pos(3, 0, 4, 1)],
  selectedShipId: null,
  previewPosition: null,
  hidePreview: false,
  lastMove: null,
  showLastMove: false,
};

describe("buildDisplayGrid", () => {
  it("places alive ships", () => {
    const grid = buildDisplayGrid(gridArgs);
    expect(grid[1][1]?.shipId).toBe(1);
    expect(grid[2][3]?.shipId).toBe(2);
    expect(grid[0][4]).toBeNull();
  });
  it("adds the staged destination as a preview copy, unless hidden", () => {
    const staged = { ...gridArgs, selectedShipId: 1, previewPosition: { row: 3, col: 0 } };
    expect(buildDisplayGrid(staged)[3][0]).toMatchObject({ shipId: 1, isPreview: true });
    expect(buildDisplayGrid({ ...staged, hidePreview: true })[3][0]).toBeNull();
  });
  it("shows the last move's ghost at its old tile and its destroyed target", () => {
    const grid = buildDisplayGrid({
      ...gridArgs,
      lastMove: { shipId: 2, oldRow: 3, oldCol: 3, actionType: ActionType.Shoot, targetShipId: 3 },
      showLastMove: true,
    });
    expect(grid[3][3]).toMatchObject({ shipId: 2, isPreview: true });
    expect(grid[0][4]).toMatchObject({ shipId: 3, status: 1 });
  });
  it("draws no ghost when the ship didn't move, or when the last move is hidden", () => {
    const held = { shipId: 2, oldRow: 2, oldCol: 3, actionType: ActionType.Pass, targetShipId: 0 };
    const grid = buildDisplayGrid({ ...gridArgs, lastMove: held, showLastMove: true });
    expect(grid.flat().filter((c) => c?.isPreview)).toHaveLength(0);
    const moved = { ...held, oldRow: 3 };
    expect(buildDisplayGrid({ ...gridArgs, lastMove: moved, showLastMove: false })[3][3]).toBeNull();
  });
});
