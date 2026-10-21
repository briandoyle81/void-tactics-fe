import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, type Prisma } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import { buildMissionImportRows, type MissionImportRows } from "../app/utils/missionSeedImport";
import type { MissionSeedFiles } from "../app/utils/missionSeedExport";
import { positionalSeedIds, seedDeploymentIds, type SeedDeploymentIds } from "../app/utils/seedDeploymentIds";
import { MAP_NAMES } from "../app/data/content/mapNames";
import { CAMPAIGN_NODE_CONTENT, ROGUELIKE_NODE_CONTENT } from "../app/data/dialog/nodeContent";

// Replaces web2's mission content with the contracts repo's seed files, so
// web2 matches what's on chain. Get current seed files from the Ops Console
// (Admin › [EXPORT MISSION SEED FILES], on the chain you edit) and copy them
// into the contracts repo first.
//
//   npx tsx prisma/importMissionSeeds.ts            dry run: what would change
//   npx tsx prisma/importMissionSeeds.ts --yes      write it
//   --dir <path>  seed file folder (default: the contracts repo's
//                 ignition/data next to this repo; run from the repo root)
//   --deployment <path>  the deployment whose ids web2 copies (default:
//                 ignition/deployments/chain-84532 next to --dir). Its
//                 journal.jsonl and content-sync.json give each seed key's
//                 on-chain id (app/utils/seedDeploymentIds.ts).
//   --fresh       use fresh-deploy ids (seed order) instead of a deployment
//
// Writes to DATABASE_URL (.env.local, then .env), in one transaction:
// - Clears all mission progress: roguelike runs, rosters and cleared
//   nodes, reward ship claims (ships already minted stay), and campaign
//   completions. Unfinished campaign/roguelike lobbies
//   are cancelled, their games abandoned and their ships freed.
// - Replaces campaigns, campaign nodes, the roguelike campaign, its nodes,
//   edges and reward ships, AI ship configs, enemy placements and node text.
// - Overwrites maps by id and deletes maps the deployment doesn't map a seed
//   key to (on live Base Sepolia that includes map 67, an ignored duplicate).
//   Unfinished lobbies on a deleted map are cancelled too. Finished games
//   keep their lobby; ones on a deleted map lose the link to it.
// Ids match the contract deploy (see missionSeedImport.ts).

dotenv.config({ path: [".env.local", ".env"] });

const args = process.argv.slice(2);
const write = args.includes("--yes");
const dirArg = args.indexOf("--dir");
const dir = resolve(dirArg >= 0 ? args[dirArg + 1] : "../void-tactics-contracts-eth-online-2026/ignition/data");

const deploymentArg = args.indexOf("--deployment");
const deploymentDir = resolve(deploymentArg >= 0 ? args[deploymentArg + 1] : resolve(dir, "../deployments/chain-84532"));
const fresh = args.includes("--fresh");

const readSeed = (name: string) => JSON.parse(readFileSync(resolve(dir, name), "utf8"));

/** Each seed key's id on the deployment, or seed order with --fresh. */
function deploymentIds(files: MissionSeedFiles): SeedDeploymentIds {
  if (fresh) return positionalSeedIds(files);
  const journal = resolve(deploymentDir, "journal.jsonl");
  if (!existsSync(journal)) {
    throw new Error(`No deployment journal at ${journal}. Pass --deployment <dir>, or --fresh for seed-order ids.`);
  }
  const syncPath = resolve(deploymentDir, "content-sync.json");
  const syncState = existsSync(syncPath) ? JSON.parse(readFileSync(syncPath, "utf8")) : null;
  return seedDeploymentIds(files, readFileSync(journal, "utf8"), syncState);
}

const UNFINISHED = ["OPEN", "FLEET_SELECTION", "IN_GAME"] as const;

/** Serial tables whose ids are written explicitly; their sequences are moved past the max id. */
const EXPLICIT_ID_TABLES = ["Map", "AIShipConfig", "Campaign", "CampaignNode", "RoguelikeCampaign", "RoguelikeNode"];

function summarize(rows: MissionImportRows): string {
  return [
    `${rows.maps.length} maps`,
    `${rows.aiShipConfigs.length} AI ship configs`,
    `${rows.placements.length} enemy ships placed`,
    `${rows.campaigns.length} campaign(s), ${rows.campaignNodes.length} campaign nodes`,
    `roguelike: ${rows.roguelikeNodes.length} nodes, ${rows.roguelikeEdges.length} edges, root node ${rows.roguelikeCampaign.rootNodeId}`,
    `${rows.roguelikeShipGrants.length} reward ship(s)`,
    `${rows.nodeContent.length} node titles/descriptions`,
  ].join("\n  ");
}

async function main() {
  const files: MissionSeedFiles = {
    singlePlayer: readSeed("singlePlayerStarterContent.json"),
    roguelike: readSeed("roguelikeStarterContent.json"),
    pvp: readSeed("pvpStarterContent.json"),
  };
  const ids = deploymentIds(files);
  const rows = buildMissionImportRows(
    files,
    { mapNames: MAP_NAMES, campaignContent: CAMPAIGN_NODE_CONTENT, roguelikeContent: ROGUELIKE_NODE_CONTENT },
    ids,
  );
  console.log(`Seed files: ${dir}\nIds: ${fresh ? "seed order (--fresh)" : deploymentDir}\n  ${summarize(rows)}`);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    const mapIds = rows.maps.map((m) => m.id);
    const missionLobby = {
      OR: [
        { campaignNodeId: { not: null } },
        { roguelikeRunId: { not: null } },
        { mapId: { notIn: mapIds } },
      ],
    };
    const [runs, completions, openLobbies, extraMaps] = await Promise.all([
      prisma.roguelikeRun.count(),
      prisma.campaignNodeCompletion.count(),
      prisma.lobby.count({ where: { ...missionLobby, status: { in: [...UNFINISHED] } } }),
      prisma.map.findMany({ where: { id: { notIn: mapIds } }, select: { id: true } }),
    ]);
    console.log(
      `Database:\n  clears ${runs} roguelike runs and ${completions} campaign completions\n` +
        `  cancels ${openLobbies} unfinished campaign/roguelike lobbies\n` +
        `  deletes ${extraMaps.length} map(s) no seed key has: ${extraMaps.map((m) => m.id).join(", ") || "none"}`,
    );
    if (!write) {
      console.log("\nDry run. Run again with --yes to write.");
      return;
    }

    await prisma.$transaction(
      async (tx) => {
        // Free ships held by unfinished mission lobbies and run rosters,
        // then end those lobbies and their games.
        const lobbies = await tx.lobby.findMany({
          where: { ...missionLobby, status: { in: [...UNFINISHED] } },
          select: { id: true, fleets: { select: { shipIds: true } } },
        });
        const lobbyIds = lobbies.map((l) => l.id);
        const rosterShips = await tx.roguelikeRosterShip.findMany({ select: { shipId: true } });
        const freedShipIds = [
          ...lobbies.flatMap((l) => l.fleets.flatMap((f) => f.shipIds)),
          ...rosterShips.map((r) => r.shipId),
        ];
        if (freedShipIds.length > 0) {
          await tx.ship.updateMany({ where: { id: { in: freedShipIds } }, data: { inFleet: false } });
        }
        await tx.game.updateMany({
          where: { lobbyId: { in: lobbyIds }, phase: "ACTIVE" },
          data: { phase: "ABANDONED" },
        });
        await tx.lobby.updateMany({ where: { id: { in: lobbyIds } }, data: { status: "CANCELLED" } });

        // Unlink lobbies from the rows about to be deleted.
        await tx.lobby.updateMany({
          where: { OR: [{ campaignNodeId: { not: null } }, { roguelikeRunId: { not: null } }] },
          data: { campaignNodeId: null, roguelikeRunId: null },
        });
        await tx.lobby.updateMany({ where: { mapId: { notIn: mapIds } }, data: { mapId: null } });

        // Progress, then content (children before parents).
        await tx.roguelikeNodeDefeat.deleteMany();
        await tx.roguelikeRosterShip.deleteMany();
        await tx.roguelikeRun.deleteMany();
        // Claims point at node ids the import reassigns, like hasClaimed on a
        // redeploy. The minted ships stay with their owners.
        await tx.roguelikeShipGrantAward.deleteMany();
        await tx.campaignNodeCompletion.deleteMany();
        await tx.roguelikeEdge.deleteMany();
        await tx.roguelikeShipGrant.deleteMany();
        await tx.roguelikeNode.deleteMany();
        await tx.roguelikeCampaign.deleteMany();
        await tx.campaignNode.deleteMany();
        await tx.campaign.deleteMany();
        await tx.aIMapPlacement.deleteMany();
        await tx.aIShipConfig.deleteMany();
        await tx.nodeContent.deleteMany();
        await tx.map.deleteMany({ where: { id: { notIn: mapIds } } });

        // Maps keep their ids (finished games still point at them), so
        // overwrite in place.
        for (const m of rows.maps) {
          const json = (tiles: readonly object[]) => tiles as Prisma.InputJsonArray;
          const data = {
            name: m.name,
            mode: m.mode,
            blockedTiles: json(m.blockedTiles),
            impassableTiles: json(m.impassableTiles),
            scoringTiles: json(m.scoringTiles),
            creatorZone: json(m.creatorZone),
            joinerZone: json(m.joinerZone),
          };
          await tx.map.upsert({ where: { id: m.id }, update: data, create: { id: m.id, ...data } });
        }
        await tx.aIShipConfig.createMany({ data: rows.aiShipConfigs });
        await tx.aIMapPlacement.createMany({ data: rows.placements });
        await tx.campaign.createMany({ data: rows.campaigns });
        await tx.campaignNode.createMany({ data: rows.campaignNodes });
        await tx.roguelikeCampaign.create({ data: rows.roguelikeCampaign });
        await tx.roguelikeNode.createMany({ data: rows.roguelikeNodes });
        await tx.roguelikeEdge.createMany({ data: rows.roguelikeEdges });
        await tx.roguelikeShipGrant.createMany({
          data: rows.roguelikeShipGrants.map((g) => ({
            nodeId: g.nodeId,
            grant: g.grant as object,
          })),
        });
        await tx.nodeContent.createMany({ data: rows.nodeContent });

        // Rows added later (admin editors) continue after the imported ids.
        for (const table of EXPLICIT_ID_TABLES) {
          await tx.$executeRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`,
          );
        }
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
    console.log("\nImported. The web2 server's caches pick it up within a minute.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
