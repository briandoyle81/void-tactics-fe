// The on-chain id of each seed map and roguelike node on a real deployment,
// read the way the contracts repo's scripts/syncStarterContent.ts reads them
// (frontend-handoff-2026-10-20.md §2). Ids can't be worked out from the
// seed's array order any more: the live Base Sepolia deploy created
// "Repair Facility DS7" (seed key map67) as map 68 after the PvP maps, and
// map 67 is a duplicate no seed entry owns.
//
// - The deployment journal (ignition/deployments/<id>/journal.jsonl): each
//   Create<Key>Map / CreateRoguelike<Key>Node call's confirmed nonce gives
//   its creation order, so its id.
// - content-sync.json next to it: ids the sync script created later
//   (key -> id), and ids no seed entry owns ("ignored").
//
// Used by the mission seed export (chain -> seed keys) and the web2 import
// (seed keys -> ids), so web2's ids match the live chain and the id-keyed
// text files (nodeContent.ts, mapNames.ts) mean the same thing in both.
// Pure: the caller reads the files.

import type { MissionSeedFiles } from "./missionSeedExport";

export interface SeedDeploymentIds {
  /** Seed map key -> on-chain map id. */
  mapIds: Map<string, number>;
  /** Seed roguelike node key -> on-chain node id. */
  roguelikeNodeIds: Map<string, number>;
  /** On-chain map ids no seed entry owns (e.g. a duplicate left by a failed sync). */
  ignoredMapIds: number[];
  ignoredRoguelikeNodeIds: number[];
  /** False for positionalSeedIds: there's no content-sync.json to record new ids in. */
  fromRecord: boolean;
}

export interface ContentSyncState {
  maps?: Record<string, string>;
  roguelikeNodes?: Record<string, string>;
  ignored?: { maps?: string[]; roguelikeNodes?: string[] };
}

const cap = (k: string) => `${k[0].toUpperCase()}${k.slice(1)}`;

interface JournalSummary {
  confirmedNonce: Map<string, number>;
  completed: Set<string>;
}

/** Confirmed nonce per completed call future. Mirrors syncStarterContent.ts's readJournal. */
function readJournal(text: string): JournalSummary {
  const nonceByHash = new Map<string, number>();
  const confirmedNonce = new Map<string, number>();
  const completed = new Set<string>();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    const id: string | undefined = msg.futureId;
    switch (msg.type) {
      case "TRANSACTION_SEND":
        nonceByHash.set(msg.transaction.hash, msg.nonce);
        break;
      case "TRANSACTION_CONFIRM":
        if (id && nonceByHash.has(msg.hash)) confirmedNonce.set(id, nonceByHash.get(msg.hash)!);
        break;
      case "CALL_EXECUTION_STATE_COMPLETE":
        if (id && msg.result?.type === "SUCCESS") completed.add(id);
        break;
      case "WIPE_APPLY":
        if (id) {
          completed.delete(id);
          confirmedNonce.delete(id);
        }
        break;
    }
  }
  return { confirmedNonce, completed };
}

/** Ids for keys whose creation calls ran, numbered 1..n by nonce order. */
function idsFromJournal(
  journal: JournalSummary,
  keys: string[],
  futureIdFor: (key: string) => string,
): Map<string, number> {
  const found = keys
    .map((key) => ({ key, futureId: futureIdFor(key) }))
    .filter(({ futureId }) => journal.completed.has(futureId))
    .map(({ key, futureId }) => {
      const nonce = journal.confirmedNonce.get(futureId);
      if (nonce === undefined) throw new Error(`No confirmed transaction in the journal for ${futureId}`);
      return { key, nonce };
    })
    .sort((a, b) => a.nonce - b.nonce);
  return new Map(found.map(({ key }, i) => [key, i + 1]));
}

/** Every seed map and roguelike node's id on the deployment the journal and sync state describe. */
export function seedDeploymentIds(
  seeds: Pick<MissionSeedFiles, "singlePlayer" | "roguelike" | "pvp">,
  journalText: string,
  syncState: ContentSyncState | null,
): SeedDeploymentIds {
  const journal = readJournal(journalText);
  // Same order as DeployAndConfig.ts.
  const mapKeys = [...seeds.singlePlayer.maps, ...seeds.roguelike.maps, ...seeds.pvp.maps].map((m) => m.key);
  const mapIds = idsFromJournal(journal, mapKeys, (k) => `DeployModule#Create${cap(k)}Map`);
  const roguelikeNodeIds = idsFromJournal(
    journal,
    seeds.roguelike.nodes.map((n) => n.key),
    (k) => `DeployModule#CreateRoguelike${cap(k)}Node`,
  );
  Object.entries(syncState?.maps ?? {}).forEach(([k, id]) => mapIds.set(k, Number(id)));
  Object.entries(syncState?.roguelikeNodes ?? {}).forEach(([k, id]) => roguelikeNodeIds.set(k, Number(id)));
  return {
    mapIds,
    roguelikeNodeIds,
    ignoredMapIds: (syncState?.ignored?.maps ?? []).map(Number),
    ignoredRoguelikeNodeIds: (syncState?.ignored?.roguelikeNodes ?? []).map(Number),
    fromRecord: true,
  };
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
