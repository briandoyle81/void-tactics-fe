import { describe, expect, it } from "vitest";
import {
  buildRewardShipSnapshot,
  isSnapshotForContract,
  snapshotGrants,
  staleSnapshotNodeIds,
} from "../rewardShipSnapshot";
import { DEFAULT_SHIP_GRANT, type ShipGrantSpec } from "../shipGrant";

const ADDRESS = "0xf17F466fEc65d61Db1dC53acFF253727e5EB7e92";
const A: ShipGrantSpec = { ...DEFAULT_SHIP_GRANT, name: "Alpha" };
const B: ShipGrantSpec = { ...DEFAULT_SHIP_GRANT, name: "Bravo", variant: 2 };

describe("reward ship snapshot", () => {
  it("builds a file in node order and reads it back", () => {
    const file = buildRewardShipSnapshot(ADDRESS, new Map([[7, B], [3, A]]), new Date("2026-10-19T00:00:00Z"));
    expect(Object.keys(file.grants)).toEqual(["3", "7"]);
    expect(file.savedAt).toBe("2026-10-19T00:00:00.000Z");
    const round = snapshotGrants(JSON.parse(JSON.stringify(file)));
    expect(round.get(3)).toEqual(A);
    expect(round.get(7)).toEqual(B);
  });

  it("drops invalid entries", () => {
    const grants = snapshotGrants({
      shipGrantWinEffect: ADDRESS,
      savedAt: "",
      grants: { "1": A, x: A, "2": { ...A, accuracy: 9 } } as never,
    });
    expect([...grants.keys()]).toEqual([1]);
  });

  it("matches the contract address case-insensitively", () => {
    const file = buildRewardShipSnapshot(ADDRESS, new Map());
    expect(isSnapshotForContract(file, ADDRESS.toLowerCase())).toBe(true);
    expect(isSnapshotForContract(file, "0x0000000000000000000000000000000000000001")).toBe(false);
  });

  it("finds nodes changed, added or cleared since the copy", () => {
    const file = buildRewardShipSnapshot(ADDRESS, new Map([[1, A], [2, A]]));
    const live = new Map([[1, A], [2, B], [3, A]]);
    expect(staleSnapshotNodeIds(file, ADDRESS, live, [1, 2, 3, 4])).toEqual([2, 3]);
    expect(staleSnapshotNodeIds(file, ADDRESS, new Map([[1, A]]), [1, 2])).toEqual([2]);
  });

  it("treats every granted node as stale for another deploy's copy", () => {
    const file = buildRewardShipSnapshot("0x0000000000000000000000000000000000000001", new Map([[1, A]]));
    expect(staleSnapshotNodeIds(file, ADDRESS, new Map([[1, A]]), [1, 2])).toEqual([1]);
  });
});
