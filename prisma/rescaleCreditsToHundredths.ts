import { PrismaClient, type Prisma } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import { DEFAULT_ECONOMY_CONFIG, type EconomyConfig } from "../app/lib/economyConfig";
import { PURCHASE_TIERS, type PurchaseTier } from "../app/lib/purchaseTiers";
import type { UtcPurchaseTier } from "../app/lib/utcPurchaseTiers";

// One-off: web2 credits become 0.01 UTC (app/lib/credits.ts), so web2 prices
// match the chain. Before this, pack prices were already in hundredths (499 =
// 4.99 UTC) but everything players earned or paid besides packs was whole UTC
// (a recycle paid 1, a UTC purchase 5, a reservation cost 1).
//
//   npx tsx prisma/rescaleCreditsToHundredths.ts         dry run: what would change
//   npx tsx prisma/rescaleCreditsToHundredths.ts --yes   write it
//
// Writes to DATABASE_URL (.env.local, then .env), in one transaction:
// - every User.creditBalance x100 (everything players held was earned or
//   bought in whole UTC);
// - every Tournament.entryFee and prizePool x100;
// - Config economy_config: recycle, PvP kill, lobby creation and reservation
//   set to the chain's amounts (10, 2, 100, 100), and UTC kill rewards by
//   variant x100;
// - Config utc_purchase_tiers: each tier's utcAmount set to the matching ship
//   pack's priceUtc, so buying UTC and then ships costs the same as buying the
//   ships;
// - Config credits_scale, a marker; the script refuses to run twice.
// purchase_tiers (already hundredths) and roguelike_settings (repair cost per
// HP; 1 is the chain's 0.01 UTC) are left alone and printed.

dotenv.config({ path: [".env.local", ".env"] });

const write = process.argv.slice(2).includes("--yes");
const MARKER_KEY = "credits_scale";
const SCALE = 100;

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    const marker = await prisma.config.findUnique({ where: { key: MARKER_KEY } });
    if (marker) {
      console.log(`Already rescaled (${MARKER_KEY}: ${JSON.stringify(marker.value)}). Nothing to do.`);
      return;
    }

    const [users, tournaments, economyRow, utcTiersRow, packTiersRow, roguelikeRow] = await Promise.all([
      prisma.user.aggregate({ _count: true, _sum: { creditBalance: true } }),
      prisma.tournament.aggregate({ _count: true, _sum: { entryFee: true, prizePool: true } }),
      prisma.config.findUnique({ where: { key: "economy_config" } }),
      prisma.config.findUnique({ where: { key: "utc_purchase_tiers" } }),
      prisma.config.findUnique({ where: { key: "purchase_tiers" } }),
      prisma.config.findUnique({ where: { key: "roguelike_settings" } }),
    ]);

    console.log(`Users: ${users._count}, credits ${users._sum.creditBalance ?? 0} -> ${(users._sum.creditBalance ?? 0) * SCALE}`);
    console.log(
      `Tournaments: ${tournaments._count}, entry fees ${tournaments._sum.entryFee ?? 0} -> ${(tournaments._sum.entryFee ?? 0) * SCALE}, ` +
        `prize pools ${tournaments._sum.prizePool ?? 0} -> ${(tournaments._sum.prizePool ?? 0) * SCALE}`,
    );

    // economy_config: only a stored row overrides the defaults, which already
    // carry the new amounts.
    let economyValue: EconomyConfig | null = null;
    if (economyRow) {
      const old = economyRow.value as unknown as Partial<EconomyConfig>;
      const killRewardByVariant = Object.fromEntries(
        Object.entries(old.killRewardByVariant ?? DEFAULT_ECONOMY_CONFIG.killRewardByVariant).map(([variant, reward]) => [
          variant,
          reward.token === "UTC" ? { ...reward, amount: reward.amount * SCALE } : reward,
        ]),
      );
      economyValue = {
        ...DEFAULT_ECONOMY_CONFIG,
        ...old,
        recycleRewardUtc: DEFAULT_ECONOMY_CONFIG.recycleRewardUtc,
        killRewardUtc: DEFAULT_ECONOMY_CONFIG.killRewardUtc,
        lobbyCreationCostUtc: DEFAULT_ECONOMY_CONFIG.lobbyCreationCostUtc,
        reservationFeeUtc: DEFAULT_ECONOMY_CONFIG.reservationFeeUtc,
        killRewardByVariant,
      };
      console.log(`economy_config: ${JSON.stringify(old)}\n             -> ${JSON.stringify(economyValue)}`);
    } else {
      console.log("economy_config: no stored row (the new defaults apply).");
    }

    // utc_purchase_tiers: each tier pays out its ship pack's UTC price.
    const packTiers = (packTiersRow?.value as unknown as PurchaseTier[] | undefined) ?? PURCHASE_TIERS;
    let utcTiersValue: UtcPurchaseTier[] | null = null;
    if (utcTiersRow) {
      const old = utcTiersRow.value as unknown as UtcPurchaseTier[];
      utcTiersValue = old.map((t) => {
        const pack = packTiers.find((p) => p.tier === t.tier);
        return pack ? { ...t, utcAmount: pack.priceUtc } : { ...t, utcAmount: t.utcAmount * SCALE };
      });
      console.log(`utc_purchase_tiers: ${JSON.stringify(old)}\n                 -> ${JSON.stringify(utcTiersValue)}`);
    } else {
      console.log("utc_purchase_tiers: no stored row (the new defaults apply).");
    }

    console.log(`purchase_tiers (unchanged): ${packTiersRow ? JSON.stringify(packTiersRow.value) : "defaults"}`);
    console.log(
      `roguelike_settings (unchanged; repair cost per HP in credits, 1 = 0.01 UTC): ` +
        `${roguelikeRow ? JSON.stringify(roguelikeRow.value) : "defaults"}`,
    );

    if (!write) {
      console.log("\nDry run. Run again with --yes to write.");
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "User" SET "creditBalance" = "creditBalance" * ${SCALE}`;
      await tx.$executeRaw`UPDATE "Tournament" SET "entryFee" = "entryFee" * ${SCALE}, "prizePool" = "prizePool" * ${SCALE}`;
      if (economyValue) {
        await tx.config.update({
          where: { key: "economy_config" },
          data: { value: economyValue as unknown as Prisma.InputJsonValue },
        });
      }
      if (utcTiersValue) {
        await tx.config.update({
          where: { key: "utc_purchase_tiers" },
          data: { value: utcTiersValue as unknown as Prisma.InputJsonValue },
        });
      }
      await tx.config.create({
        data: { key: MARKER_KEY, value: { creditsPerUtc: SCALE, appliedAt: new Date().toISOString() } },
      });
    });
    console.log("\nDone. Server caches (economy, tier lists) expire on their own TTL; restart to see it at once.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
