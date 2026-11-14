import { describe, expect, it } from "vitest";
import { isNearDeploymentRecord, positionalSeedIds, seedIdsFromNearRecord } from "../seedDeploymentIds";
import type { MissionSeedFiles } from "../missionSeedExport";

const record = {
  written_at: "2026-11-14T17:33:59Z",
  network: "testnet",
  game: "game.void-tactics.testnet",
  single_player: { maps: { m01: 1, m02: 2 }, nodes: { m01: 1 } },
  roguelike: { maps: { m01: 1, rlM01: 31 }, nodes: { r1: 1, r2: 2 } },
  pvp_maps: { pvp01: 67 },
};

describe("seedIdsFromNearRecord", () => {
  it("merges every map section (one id space) and takes the roguelike node ids", () => {
    const ids = seedIdsFromNearRecord(record);
    expect(Object.fromEntries(ids.mapIds)).toEqual({ m01: 1, m02: 2, rlM01: 31, pvp01: 67 });
    expect(Object.fromEntries(ids.roguelikeNodeIds)).toEqual({ r1: 1, r2: 2 });
    expect(ids.fromRecord).toBe(true);
  });

  it("recognizes a record by shape", () => {
    expect(isNearDeploymentRecord(record)).toBe(true);
    expect(isNearDeploymentRecord({ maps: {} })).toBe(false);
  });
});

describe("positionalSeedIds", () => {
  it("numbers maps across the three seed files, then nodes, from 1", () => {
    const seeds = {
      singlePlayer: { maps: [{ key: "m01" }, { key: "m02" }] },
      roguelike: { maps: [{ key: "rlM01" }], nodes: [{ key: "r1" }] },
      pvp: { maps: [{ key: "pvp01" }] },
    } as unknown as MissionSeedFiles;
    const ids = positionalSeedIds(seeds);
    expect(ids.mapIds.get("pvp01")).toBe(4);
    expect(ids.roguelikeNodeIds.get("r1")).toBe(1);
    expect(ids.fromRecord).toBe(false);
  });
});
