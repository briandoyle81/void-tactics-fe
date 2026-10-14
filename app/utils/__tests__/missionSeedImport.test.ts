import { describe, expect, it } from "vitest";
import { buildMissionImportRows } from "../missionSeedImport";
import type { MissionSeedFiles, SeedMap } from "../missionSeedExport";

const map = (key: string, name = key): SeedMap => ({
  key,
  name,
  mode: "PvE",
  type: "full",
  blockedTiles: [{ row: 1, col: 1 }],
  impassableTiles: [],
  scoringTiles: [],
  creatorZone: [],
  joinerZone: [],
});

const files = (): MissionSeedFiles => ({
  singlePlayer: {
    maps: [map("m01"), map("m02")],
    aiShipColors: { h1: 1 },
    aiShipConfigs: [
      {
        key: "grunt",
        name: "Grunt",
        equipment: { mainWeapon: 0, armor: 0, shields: 0, special: 0 },
        traits: { variant: 1, accuracy: 0, hull: 0, speed: 0 },
        archetype: 0,
      },
      {
        key: "sniper",
        name: "Sniper",
        equipment: { mainWeapon: 1, armor: 0, shields: 0, special: 0 },
        traits: { variant: 2, accuracy: 1, hull: 0, speed: 0 },
        archetype: 2,
      },
    ],
    mapPlacements: [{ mapKey: "m02", positions: [{ row: 0, col: 14 }], configKeys: ["sniper"] }],
    campaigns: [{ key: "mainCampaign" }],
    campaignNodes: [
      { key: "a", campaignKey: "mainCampaign", mapKey: "m01", prerequisites: [], costLimit: 500, turnTime: 600, maxScore: 15, creatorGoesFirst: true, title: "Seed A" },
      { key: "b", campaignKey: "mainCampaign", mapKey: "m02", prerequisites: ["a"], costLimit: 600, turnTime: 300, maxScore: 20, creatorGoesFirst: false },
    ],
  },
  roguelike: {
    campaign: { autoHealPercent: 80, initialCostCap: 500, requiredVariant: 1 },
    root: "r1",
    maps: [map("rlM01", "Seed name")],
    mapPlacements: [{ mapKey: "rlM01", positions: [{ row: 2, col: 15 }], configKeys: ["grunt"] }],
    nodes: [
      { key: "r1", kind: "Combat", mapKey: "rlM01", turnTime: 600, maxScore: 15, creatorGoesFirst: true, title: "Old", description: "Old text", winEffects: ["DEC_BONUS_WIN_EFFECT"] },
      { key: "r2", kind: "Resupply", costCapOverride: 700 },
    ],
    edges: [{ from: "r1", to: "r2" }],
  },
  pvp: { maps: [map("p1")] },
});

describe("buildMissionImportRows", () => {
  it("numbers everything like the contract deploy and resolves keys to ids", () => {
    const rows = buildMissionImportRows(files(), {
      mapNames: { 3: "Repo name" },
      campaignContent: {},
      roguelikeContent: { 1: { title: "Repo title", description: "Repo text" } },
    });
    // single-player -> roguelike -> PvP map order
    expect(rows.maps.map((m) => [m.id, m.name, m.mode])).toEqual([
      [1, "m01", 1],
      [2, "m02", 1],
      [3, "Repo name", 1],
      [4, "p1", 1],
    ]);
    expect(rows.aiShipConfigs[1]).toMatchObject({
      id: 2,
      traits: { serialNumber: 0, colors: { h1: 1 }, variant: 2, accuracy: 1 },
    });
    expect(rows.placements).toEqual([
      { mapId: 2, row: 0, col: 14, configId: 2 },
      { mapId: 3, row: 2, col: 15, configId: 1 },
    ]);
    expect(rows.campaigns).toEqual([{ id: 1, requiredVariant: 1 }]);
    expect(rows.campaignNodes[1]).toMatchObject({ id: 2, mapId: 2, prerequisites: [1], turnTimeSeconds: 300 });
    expect(rows.roguelikeCampaign).toEqual({
      id: 1,
      requiredVariant: 1,
      autoHealPercent: 80,
      initialCostCap: 500,
      rootNodeId: 1,
    });
    expect(rows.roguelikeNodes[0]).toMatchObject({ kind: 0, mapId: 3, winEffects: ["DEC_BONUS_WIN_EFFECT"] });
    expect(rows.roguelikeNodes[1]).toMatchObject({ kind: 1, mapId: null, costCapOverride: 700, winEffects: [] });
    expect(rows.roguelikeEdges).toEqual([{ parentId: 1, childId: 2 }]);
    // Repo text wins; seed text fills in; nodes with neither get no row.
    expect(rows.nodeContent).toEqual([
      { graphType: "CAMPAIGN", nodeId: 1, title: "Seed A", description: "" },
      { graphType: "ROGUELIKE", nodeId: 1, title: "Repo title", description: "Repo text" },
    ]);
  });

  it("lists every broken reference", () => {
    const f = files();
    f.singlePlayer.campaignNodes[1].prerequisites = ["missing"];
    f.roguelike.edges.push({ from: "r2", to: "nope" });
    f.roguelike.mapPlacements[0].configKeys = ["ghost"];
    const build = () =>
      buildMissionImportRows(f, { mapNames: {}, campaignContent: {}, roguelikeContent: {} });
    expect(build).toThrow(/campaign node "missing"/);
    expect(build).toThrow(/roguelike node "nope"/);
    expect(build).toThrow(/AI ship config "ghost"/);
  });
});
