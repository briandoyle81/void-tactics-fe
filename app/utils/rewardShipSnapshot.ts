import { parseShipGrant, shipGrantError, type ShipGrantSpec } from "./shipGrant";

// The app's own copy of every roguelike node's reward ship
// (app/data/content/rewardShips.json), so players' screens show a node's
// ship without reading ShipGrantWinEffect. Grants rarely change; when they
// do, Ops Console › Reward Ships flags the nodes that differ, and the mission
// seed export (Admin tab) saves a new copy to commit and deploy. The copy names the contract it was read from:
// after a redeploy (a new address) it's out of date as a whole, and reads go
// back to the chain until a new copy is saved. Web3 only: web2 reads its
// grants from Postgres.

/** The app copy's file name, in app/data/content/. */
export const REWARD_SHIP_SNAPSHOT_FILE = "rewardShips.json";

export interface RewardShipSnapshotFile {
  /** The ShipGrantWinEffect address the grants were read from. */
  shipGrantWinEffect: string;
  /** ISO time of the export. */
  savedAt: string;
  /** Node id → its reward ship. A node without one has no entry. */
  grants: Record<string, ShipGrantSpec>;
}

/** The grants of a snapshot file, keyed by node id; invalid entries are dropped. */
export function snapshotGrants(file: RewardShipSnapshotFile): Map<number, ShipGrantSpec> {
  const map = new Map<number, ShipGrantSpec>();
  Object.entries(file.grants ?? {}).forEach(([key, value]) => {
    const nodeId = Number(key);
    const grant = parseShipGrant(value);
    if (Number.isInteger(nodeId) && nodeId > 0 && grant && shipGrantError(grant, Number.MAX_SAFE_INTEGER) === null) {
      map.set(nodeId, grant);
    }
  });
  return map;
}

/** Whether the snapshot was read from this deploy's ShipGrantWinEffect. */
export function isSnapshotForContract(file: RewardShipSnapshotFile, address: string): boolean {
  return file.shipGrantWinEffect.toLowerCase() === address.toLowerCase();
}

/** A new snapshot file from the chain's current grants, nodes in id order. */
export function buildRewardShipSnapshot(
  address: string,
  grants: Map<number, ShipGrantSpec>,
  savedAt: Date = new Date(),
): RewardShipSnapshotFile {
  const sorted = [...grants.entries()].sort(([a], [b]) => a - b);
  return {
    shipGrantWinEffect: address,
    savedAt: savedAt.toISOString(),
    grants: Object.fromEntries(sorted.map(([id, grant]) => [String(id), grant])),
  };
}

const sameGrant = (a: ShipGrantSpec | undefined, b: ShipGrantSpec | undefined) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Node ids whose reward ship on chain differs from the snapshot (changed,
 * added or cleared since it was saved), among `nodeIds`. Every node with a
 * grant differs when the snapshot is from another contract.
 */
export function staleSnapshotNodeIds(
  file: RewardShipSnapshotFile,
  address: string,
  live: Map<number, ShipGrantSpec>,
  nodeIds: readonly number[],
): number[] {
  const forContract = isSnapshotForContract(file, address);
  const saved = forContract ? snapshotGrants(file) : new Map<number, ShipGrantSpec>();
  return nodeIds.filter((id) => (forContract ? !sameGrant(live.get(id), saved.get(id)) : live.has(id)));
}
