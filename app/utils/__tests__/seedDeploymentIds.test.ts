import { describe, expect, it } from "vitest";
import { seedDeploymentIds } from "../seedDeploymentIds";
import type { MissionSeedFiles } from "../missionSeedExport";

const seeds = {
  singlePlayer: { maps: [{ key: "m01" }, { key: "m02" }] },
  roguelike: { maps: [{ key: "map67" }], nodes: [{ key: "r1" }, { key: "r2" }] },
  pvp: { maps: [{ key: "pvp01" }] },
} as unknown as MissionSeedFiles;

/** Journal lines for one completed, confirmed call future. */
function call(futureId: string, nonce: number): string[] {
  const hash = `0x${nonce.toString(16).padStart(4, "0")}`;
  return [
    JSON.stringify({ type: "TRANSACTION_SEND", futureId, nonce, transaction: { hash } }),
    JSON.stringify({ type: "TRANSACTION_CONFIRM", futureId, hash }),
    JSON.stringify({ type: "CALL_EXECUTION_STATE_COMPLETE", futureId, result: { type: "SUCCESS" } }),
  ];
}

describe("seedDeploymentIds", () => {
  it("numbers created keys by nonce and applies the sync state", () => {
    // The deploy created m02 before m01, and pvp01; map67 came later from the sync script.
    const journal = [
      ...call("DeployModule#CreateM02Map", 10),
      ...call("DeployModule#CreateM01Map", 11),
      ...call("DeployModule#CreatePvp01Map", 12),
      ...call("DeployModule#CreateRoguelikeR1Node", 13),
      ...call("DeployModule#CreateRoguelikeR2Node", 14),
    ].join("\n");
    const ids = seedDeploymentIds(seeds, journal, { maps: { map67: "5" }, ignored: { maps: ["4"] } });
    expect([...ids.mapIds]).toEqual([["m02", 1], ["m01", 2], ["pvp01", 3], ["map67", 5]]);
    expect([...ids.roguelikeNodeIds]).toEqual([["r1", 1], ["r2", 2]]);
    expect(ids.ignoredMapIds).toEqual([4]);
  });

  it("drops a call the journal wiped", () => {
    const journal = [
      ...call("DeployModule#CreateM01Map", 1),
      JSON.stringify({ type: "WIPE_APPLY", futureId: "DeployModule#CreateM01Map" }),
    ].join("\n");
    expect(seedDeploymentIds(seeds, journal, null).mapIds.size).toBe(0);
  });
});
