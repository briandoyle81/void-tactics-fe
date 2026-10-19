// The checked-in reward ship snapshot (see app/utils/rewardShipSnapshot.ts),
// loaded once. Replace app/data/content/rewardShips.json from Ops Console ›
// Reward Ships when a node's ship changes, then deploy.

import snapshotJson from "../data/content/rewardShips.json";
import { snapshotGrants, type RewardShipSnapshotFile } from "../utils/rewardShipSnapshot";

export const REWARD_SHIP_SNAPSHOT = snapshotJson as RewardShipSnapshotFile;

/** The snapshot's grants by node id. */
export const SNAPSHOT_REWARD_SHIPS = snapshotGrants(REWARD_SHIP_SNAPSHOT);
