// The onchain id of each seed map and roguelike node on the live
// deployment. Ids can't be worked out from the seed's array order once
// content is synced after a deploy, so they come from the contracts repo's
// NEAR deployment record (near/deployments/<network>.json), which its
// deploy tool writes after reading every id back from the chain (rerun it
// with --record-only after a deploy or a content sync).
//
// Used by the mission seed export (chain -> seed keys) and the web2 import
// (seed keys -> ids), so web2's ids match the live chain and the id-keyed
// text files (nodeContent.ts, mapNames.ts) mean the same thing in both.
// Pure: the caller reads the files.

import type { MissionSeedFiles } from "./missionSeedExport";

export interface SeedDeploymentIds {
  /** Seed map key -> onchain map id. */
  mapIds: Map<string, number>;
  /** Seed roguelike node key -> onchain node id. */
  roguelikeNodeIds: Map<string, number>;
  /** Onchain map ids no seed entry owns (e.g. a duplicate left by a failed sync). */
  ignoredMapIds: number[];
  ignoredRoguelikeNodeIds: number[];
  /** False for positionalSeedIds: there's no deployment record to record new ids in. */
  fromRecord: boolean;
}

/** Ids as a fresh deploy from these seeds gives them: 1-indexed array position. */
export function positionalSeedIds(
  seeds: Pick<MissionSeedFiles, "singlePlayer" | "roguelike" | "pvp">,
): SeedDeploymentIds {
  const maps = [...seeds.singlePlayer.maps, ...seeds.roguelike.maps, ...seeds.pvp.maps];
  return {
    mapIds: new Map(maps.map((m, i) => [m.key, i + 1])),
    roguelikeNodeIds: new Map(seeds.roguelike.nodes.map((n, i) => [n.key, i + 1])),
    ignoredMapIds: [],
    ignoredRoguelikeNodeIds: [],
    fromRecord: false,
  };
}

/**
 * The NEAR deployment record (the contracts repo's
 * near/deployments/<network>.json, written by its deploy tool after reading
 * every id back from the chain): seed key -> id for maps (single-player,
 * roguelike and PvP share one id space) and roguelike nodes.
 */
export interface NearDeploymentRecord {
  written_at?: string;
  network?: string;
  game: string;
  single_player?: { maps?: Record<string, number>; nodes?: Record<string, number> };
  roguelike?: { maps?: Record<string, number>; nodes?: Record<string, number> };
  pvp_maps?: Record<string, number>;
}

export const isNearDeploymentRecord = (d: unknown): d is NearDeploymentRecord =>
  !!d &&
  typeof d === "object" &&
  typeof (d as NearDeploymentRecord).game === "string" &&
  typeof (d as NearDeploymentRecord).roguelike === "object";

/** Every seed map and roguelike node's id from a NEAR deployment record. */
export function seedIdsFromNearRecord(record: NearDeploymentRecord): SeedDeploymentIds {
  const mapIds = new Map<string, number>();
  for (const maps of [record.single_player?.maps, record.roguelike?.maps, record.pvp_maps]) {
    Object.entries(maps ?? {}).forEach(([k, id]) => mapIds.set(k, Number(id)));
  }
  const roguelikeNodeIds = new Map(Object.entries(record.roguelike?.nodes ?? {}).map(([k, id]) => [k, Number(id)]));
  return { mapIds, roguelikeNodeIds, ignoredMapIds: [], ignoredRoguelikeNodeIds: [], fromRecord: true };
}
