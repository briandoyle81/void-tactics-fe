import { PrismaClient, GamePhase } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import { isPvpLobby } from "../app/lib/playerStatsWeb2";
import { WEB2_TIE_SENTINEL } from "../app/types/web2Game";

// Rebuilds every player's record (PlayerStats) from what web3's GameResults
// counts: finished PvP games plus the tutorial's win or loss
// (User.tutorialPath). Games against the AI, campaign and roguelike games
// are left out (see app/lib/playerStatsWeb2.ts).
//
//   npx tsx prisma/rebuildPlayerStats.ts         dry run: prints the changes
//   npx tsx prisma/rebuildPlayerStats.ts --yes   writes them
//
// Writes to DATABASE_URL (.env.local, then .env), in one transaction.

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const write = process.argv.slice(2).includes("--yes");

type Row = { wins: number; losses: number; draws: number; totalGames: number };
const empty = (): Row => ({ wins: 0, losses: 0, draws: 0, totalGames: 0 });

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const rows = new Map<string, Row>();
    const add = (userId: string, field: "wins" | "losses" | "draws") => {
      const r = rows.get(userId) ?? empty();
      r[field] += 1;
      r.totalGames += 1;
      rows.set(userId, r);
    };

    const games = await prisma.game.findMany({
      where: { phase: { in: [GamePhase.COMPLETED, GamePhase.TIMED_OUT] }, winnerId: { not: null } },
      select: { player1Id: true, player2Id: true, winnerId: true, lobby: { select: { isAiGame: true, campaignNodeId: true, roguelikeRunId: true } } },
    });
    const pvp = games.filter((g) => isPvpLobby(g.lobby));
    for (const g of pvp) {
      if (g.winnerId === WEB2_TIE_SENTINEL) {
        add(g.player1Id, "draws");
        add(g.player2Id, "draws");
      } else {
        add(g.winnerId!, "wins");
        add(g.winnerId === g.player1Id ? g.player2Id : g.player1Id, "losses");
      }
    }

    const tutorials = await prisma.user.findMany({
      where: { tutorialPath: { in: ["win", "loss"] } },
      select: { id: true, tutorialPath: true },
    });
    for (const u of tutorials) add(u.id, u.tutorialPath === "win" ? "wins" : "losses");

    const existing = await prisma.playerStats.findMany();
    for (const e of existing) if (!rows.has(e.userId)) rows.set(e.userId, empty());
    const before = new Map(existing.map((e) => [e.userId, e]));

    const changes = [...rows].filter(([userId, r]) => {
      const b = before.get(userId);
      return !b || b.wins !== r.wins || b.losses !== r.losses || b.draws !== r.draws || b.totalGames !== r.totalGames;
    });

    console.log(`${games.length} finished games, ${pvp.length} PvP; ${tutorials.length} tutorial results`);
    console.log(`${existing.length} existing records, ${changes.length} change:`);
    for (const [userId, r] of changes) {
      const b = before.get(userId);
      const fmt = (x: Row | undefined) => (x ? `${x.wins}W ${x.losses}L ${x.draws}D (${x.totalGames})` : "none");
      console.log(`  ${userId}: ${fmt(b)} -> ${fmt(r)}`);
    }

    if (!write) {
      console.log("\nDry run. Run with --yes to write.");
      return;
    }
    await prisma.$transaction(
      changes.map(([userId, r]) =>
        prisma.playerStats.upsert({ where: { userId }, update: r, create: { userId, ...r } }),
      ),
    );
    console.log("\nWritten.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
