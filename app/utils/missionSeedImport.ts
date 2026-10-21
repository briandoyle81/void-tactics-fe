// Turns the contracts repo's mission seed files (the same three the Ops
// Console's [EXPORT MISSION SEED FILES] writes, see missionSeedExport.ts)
// into web2 database rows, so web2 matches what's on chain. Run through
// prisma/importMissionSeeds.ts, which clears the old mission content and
// writes these rows.
//
// Ids follow the chain, so web2 and web3 ids line up and the id-keyed text
// files (nodeContent.ts, mapNames.ts, missionDialog.ts) mean the same thing
// in both:
// - maps and roguelike nodes: the deployment's record of each key's id
//   (seedDeploymentIds.ts), since content synced after the deploy is out of
//   array order (live Base Sepolia: seed map67 is map 68). Without a record,
//   1-indexed position, as a fresh deploy gives them (maps across
//   single-player -> roguelike -> PvP).
// - campaigns, campaign nodes: 1-indexed position in their file. The deploy
//   seeds one roguelike campaign (id 1).
// - AI ship configs: on chain they get ids from events; here, position in
//   the single-player file. Only placements reference them.
//
// Pure and number-native; the caller does the database writes.

import type {
  MissionSeedFiles,
  SeedMap,
  SeedMapMode,
  SeedPos,
  SeedScoringTile,
  NodeContent,
} from "./missionSeedExport";
import { isWinEffectKey } from "../lib/winEffectsCatalog";
import { parseShipGrant, shipGrantError, type ShipGrantSpec } from "./shipGrant";
import { MAX_FACTION_VARIANT } from "../config/factions";
import { positionalSeedIds, type SeedDeploymentIds } from "./seedDeploymentIds";

const MAP_MODES: Record<SeedMapMode, number> = { PvP: 0, PvE: 1, Both: 2 };

/** The deploy restricts the campaign keyed "mainCampaign" to variant-1 fleets (SetMainCampaignRequiredVariant). */
const CAMPAIGN_REQUIRED_VARIANTS: Record<string, number> = { mainCampaign: 1 };

export interface MapRow {
  id: number;
  name: string;
  mode: number;
  blockedTiles: SeedPos[];
  impassableTiles: SeedPos[];
  scoringTiles: SeedScoringTile[];
  creatorZone: SeedPos[];
  joinerZone: SeedPos[];
}
export interface AIShipConfigRow {
  id: number;
  name: string;
  equipment: { mainWeapon: number; armor: number; shields: number; special: number };
  traits: {
    serialNumber: number;
    colors: Record<string, number>;
    variant: number;
    accuracy: number;
    hull: number;
    speed: number;
  };
  archetype: number;
}
export interface PlacementRow {
  mapId: number;
  row: number;
  col: number;
  configId: number;
}
export interface CampaignRow {
  id: number;
  requiredVariant: number;
}
export interface CampaignNodeRow {
  id: number;
  campaignId: number;
  mapId: number;
  prerequisites: number[];
  costLimit: number;
  turnTimeSeconds: number;
  maxScore: number;
  creatorGoesFirst: boolean;
}
export interface RoguelikeCampaignRow {
  id: number;
  requiredVariant: number;
  autoHealPercent: number;
  initialCostCap: number;
  rootNodeId: number;
}
export interface RoguelikeNodeRow {
  id: number;
  campaignId: number;
  kind: number;
  mapId: number | null;
  turnTimeSeconds: number | null;
  maxScore: number | null;
  creatorGoesFirst: boolean | null;
  costCapOverride: number | null;
  winEffects: string[];
}
export interface RoguelikeShipGrantRow {
  nodeId: number;
  grant: ShipGrantSpec;
}
export interface RoguelikeEdgeRow {
  parentId: number;
  childId: number;
}
export interface NodeContentRow {
  graphType: "CAMPAIGN" | "ROGUELIKE";
  nodeId: number;
  title: string;
  description: string;
}

export interface MissionImportRows {
  maps: MapRow[];
  aiShipConfigs: AIShipConfigRow[];
  placements: PlacementRow[];
  campaigns: CampaignRow[];
  campaignNodes: CampaignNodeRow[];
  roguelikeCampaign: RoguelikeCampaignRow;
  roguelikeNodes: RoguelikeNodeRow[];
  roguelikeEdges: RoguelikeEdgeRow[];
  roguelikeShipGrants: RoguelikeShipGrantRow[];
  nodeContent: NodeContentRow[];
}

export interface MissionImportText {
  /** mapNames.ts, by map id. Wins over the seed file's name. */
  mapNames: Readonly<Record<number, string>>;
  /** nodeContent.ts, by node id. Wins over the seed file's title/description. */
  campaignContent: Readonly<Record<number, NodeContent>>;
  roguelikeContent: Readonly<Record<number, NodeContent>>;
}

/** Builds every row, or throws listing every broken reference in the files. */
export function buildMissionImportRows(
  files: MissionSeedFiles,
  text: MissionImportText,
  deploymentIds: SeedDeploymentIds = positionalSeedIds(files),
): MissionImportRows {
  const errors: string[] = [];
  /** Keys resolved to the deployment's ids; a key the chain doesn't have yet is an error. */
  const deployedIds = (items: readonly { key: string }[], ids: Map<string, number>, what: string) => {
    const out = new Map<string, number>();
    const used = new Map<number, string>();
    items.forEach((item) => {
      const id = ids.get(item.key);
      if (id == null) {
        errors.push(`The ${what} "${item.key}" isn't on the deployment yet. Sync the chain to the seeds first.`);
        return;
      }
      if (used.has(id)) errors.push(`The ${what}s "${used.get(id)}" and "${item.key}" both have id ${id}.`);
      used.set(id, item.key);
      out.set(item.key, id);
    });
    return out;
  };
  const indexKeys = (items: readonly { key: string }[], what: string) => {
    const ids = new Map<string, number>();
    items.forEach((item, i) => {
      if (ids.has(item.key)) errors.push(`Duplicate ${what} key "${item.key}".`);
      else ids.set(item.key, i + 1);
    });
    return ids;
  };
  const lookup = (ids: Map<string, number>, key: string | undefined, what: string, context: string) => {
    const id = key == null ? undefined : ids.get(key);
    if (id == null) errors.push(`${context} references ${what} "${key}", which isn't in the seed files.`);
    return id ?? 0;
  };

  // ---- Maps ----------------------------------------------------------------
  const seedMaps: SeedMap[] = [...files.singlePlayer.maps, ...files.roguelike.maps, ...files.pvp.maps];
  indexKeys(seedMaps, "map");
  const mapIds = deployedIds(seedMaps, deploymentIds.mapIds, "map");
  const maps: MapRow[] = seedMaps.map((m) => {
    const id = mapIds.get(m.key) ?? 0;
    const mode = MAP_MODES[m.mode];
    if (mode == null) errors.push(`Map "${m.key}" has unknown mode "${m.mode}".`);
    return {
      id,
      name: text.mapNames[id] ?? m.name,
      mode: mode ?? MAP_MODES.Both,
      blockedTiles: m.blockedTiles ?? [],
      impassableTiles: m.impassableTiles ?? [],
      scoringTiles: m.scoringTiles ?? [],
      creatorZone: m.creatorZone ?? [],
      joinerZone: m.joinerZone ?? [],
    };
  });

  // ---- AI ship configs + placements ------------------------------------------
  const sp = files.singlePlayer;
  const configIds = indexKeys(sp.aiShipConfigs, "AI ship config");
  const aiShipConfigs: AIShipConfigRow[] = sp.aiShipConfigs.map((c, i) => ({
    id: i + 1,
    name: c.name,
    equipment: c.equipment,
    // Same traits the deploy builds for createAIShipConfig.
    traits: { serialNumber: 0, colors: sp.aiShipColors, ...c.traits },
    archetype: c.archetype,
  }));

  const placements: PlacementRow[] = [];
  const occupied = new Set<string>();
  for (const p of [...sp.mapPlacements, ...files.roguelike.mapPlacements]) {
    const context = `Enemy placement on map "${p.mapKey}"`;
    const mapId = lookup(mapIds, p.mapKey, "map", context);
    if (p.positions.length !== p.configKeys.length) {
      errors.push(`${context} has ${p.positions.length} positions but ${p.configKeys.length} ships.`);
    }
    p.positions.forEach((pos, i) => {
      const tile = `${mapId}:${pos.row}:${pos.col}`;
      if (occupied.has(tile)) {
        errors.push(`${context} puts two ships on row ${pos.row}, col ${pos.col}.`);
        return;
      }
      occupied.add(tile);
      placements.push({
        mapId,
        row: pos.row,
        col: pos.col,
        configId: lookup(configIds, p.configKeys[i], "AI ship config", context),
      });
    });
  }

  // ---- Campaigns -----------------------------------------------------------------
  const campaignIds = indexKeys(sp.campaigns, "campaign");
  const campaigns: CampaignRow[] = sp.campaigns.map((c, i) => ({
    id: i + 1,
    requiredVariant: CAMPAIGN_REQUIRED_VARIANTS[c.key] ?? 0,
  }));
  const nodeIds = indexKeys(sp.campaignNodes, "campaign node");
  const campaignNodes: CampaignNodeRow[] = sp.campaignNodes.map((n, i) => {
    const context = `Campaign node "${n.key}"`;
    return {
      id: i + 1,
      campaignId: lookup(campaignIds, n.campaignKey, "campaign", context),
      mapId: lookup(mapIds, n.mapKey, "map", context),
      prerequisites: n.prerequisites.map((k) => lookup(nodeIds, k, "campaign node", context)),
      costLimit: n.costLimit,
      turnTimeSeconds: n.turnTime,
      maxScore: n.maxScore,
      creatorGoesFirst: n.creatorGoesFirst,
    };
  });

  // ---- Roguelike -------------------------------------------------------------------
  const rl = files.roguelike;
  indexKeys(rl.nodes, "roguelike node");
  const rlIds = deployedIds(rl.nodes, deploymentIds.roguelikeNodeIds, "roguelike node");
  const roguelikeShipGrants: RoguelikeShipGrantRow[] = [];
  const roguelikeNodes: RoguelikeNodeRow[] = rl.nodes.map((n) => {
    const context = `Roguelike node "${n.key}"`;
    const id = rlIds.get(n.key) ?? 0;
    const combat = n.kind === "Combat";
    if (!combat && n.kind !== "Resupply") errors.push(`${context} has unknown kind "${n.kind}".`);
    for (const effect of n.winEffects ?? []) {
      if (!isWinEffectKey(effect)) errors.push(`${context} has unknown win effect "${effect}".`);
    }
    if (n.shipGrant != null) {
      // The same checks setGrant makes in the deploy.
      const grant = parseShipGrant(n.shipGrant);
      const problem = grant ? shipGrantError(grant, MAX_FACTION_VARIANT) : "it isn't a ship grant";
      if (!combat) errors.push(`${context} is a resupply node with a reward ship.`);
      else if (problem) errors.push(`${context} has an invalid reward ship: ${problem}`);
      else roguelikeShipGrants.push({ nodeId: id, grant: grant! });
    }
    return {
      id,
      campaignId: 1,
      kind: combat ? 0 : 1,
      mapId: combat ? lookup(mapIds, n.mapKey, "map", context) : null,
      turnTimeSeconds: combat ? (n.turnTime ?? null) : null,
      maxScore: combat ? (n.maxScore ?? null) : null,
      creatorGoesFirst: combat ? (n.creatorGoesFirst ?? null) : null,
      costCapOverride: combat ? null : (n.costCapOverride ?? null),
      winEffects: combat ? (n.winEffects ?? []) : [],
    };
  });
  const roguelikeEdges: RoguelikeEdgeRow[] = [];
  const seenEdges = new Set<string>();
  for (const e of rl.edges) {
    const context = `Roguelike edge ${e.from} -> ${e.to}`;
    const parentId = lookup(rlIds, e.from, "roguelike node", context);
    const childId = lookup(rlIds, e.to, "roguelike node", context);
    const edgeKey = `${parentId}:${childId}`;
    if (seenEdges.has(edgeKey)) {
      errors.push(`${context} is listed twice.`);
      continue;
    }
    seenEdges.add(edgeKey);
    roguelikeEdges.push({ parentId, childId });
  }
  const roguelikeCampaign: RoguelikeCampaignRow = {
    id: 1,
    requiredVariant: rl.campaign.requiredVariant,
    autoHealPercent: rl.campaign.autoHealPercent,
    initialCostCap: rl.campaign.initialCostCap,
    rootNodeId: lookup(rlIds, rl.root, "roguelike node", "The roguelike root"),
  };

  // ---- Node text ---------------------------------------------------------------------
  const nodeContent: NodeContentRow[] = [];
  const addContent = (
    graphType: NodeContentRow["graphType"],
    nodes: readonly { key: string; title?: string; description?: string }[],
    idOf: (key: string, i: number) => number,
    repoText: Readonly<Record<number, NodeContent>>,
  ) => {
    nodes.forEach((n, i) => {
      const nodeId = idOf(n.key, i);
      const title = repoText[nodeId]?.title || n.title || "";
      const description = repoText[nodeId]?.description || n.description || "";
      if (title || description) nodeContent.push({ graphType, nodeId, title, description });
    });
  };
  addContent("CAMPAIGN", sp.campaignNodes, (_, i) => i + 1, text.campaignContent);
  addContent("ROGUELIKE", rl.nodes, (key) => rlIds.get(key) ?? 0, text.roguelikeContent);

  if (errors.length > 0) {
    throw new Error(`The seed files can't be imported:\n- ${errors.join("\n- ")}`);
  }
  return {
    maps,
    aiShipConfigs,
    placements,
    campaigns,
    campaignNodes,
    roguelikeCampaign,
    roguelikeNodes,
    roguelikeEdges,
    roguelikeShipGrants,
    nodeContent,
  };
}
