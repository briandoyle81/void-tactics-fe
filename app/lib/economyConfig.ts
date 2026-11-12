import { prisma } from "./prisma";
import { createTtlCache } from "./ttlCache";

export type KillRewardToken = "DEC" | "UTC";

// Every *Utc amount here is in credits, 0.01 UTC (app/lib/credits.ts), so
// web2 charges and pays what the chain does.
export type EconomyConfig = {
  recycleRewardUtc: number;
  // Paid per kill when the destroyed ship belongs to a human opponent (PvP)
  // — currency depends on the *victim's* ownership for this direction, never
  // the ship's variant (docs/faction-2.md §1).
  killRewardUtc: number;
  // AI-kill reward, keyed by the *destroyed* ship's variant — mirrors
  // FactionRewardTokenRegistry.rewardToken(variant) onchain (see
  // docs/update/Frontend_Updates_2026-09-17.md §2). A variant with no entry
  // here pays nothing, mirroring the contract's RewardSkipped event. Only
  // applies to AI-owned-ship-destroyed kills; PvP always pays killRewardUtc
  // regardless of variant.
  killRewardByVariant: Record<number, { token: KillRewardToken; amount: number }>;
  lobbyCreationCostUtc: number;
  reservationFeeUtc: number; // extra UTC charged when reserving a lobby for a specific player — matches web3's fixed 1 UTC reservation fee
  purchaseThresholdForRewards: number;
  freeGamesPerAddress: number; // how many lobby creations are free per user
};

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  // Ships.recycleReward: 0.1 UTC.
  recycleRewardUtc: 10,
  // ShipsRouter pays recycleReward / 4 = 0.025 UTC per PvP kill; credits are
  // whole hundredths, so web2 pays 0.02.
  killRewardUtc: 2,
  // Matches today's live FactionRewardTokenRegistry config on Base Sepolia:
  // variant 2 -> DEC, variant 1 (and anything else unregistered) -> no reward.
  killRewardByVariant: {
    2: { token: "DEC", amount: 1 },
  },
  lobbyCreationCostUtc: 100,
  reservationFeeUtc: 100,
  purchaseThresholdForRewards: 10,
  freeGamesPerAddress: 1,
};

const cache = createTtlCache<EconomyConfig>(async () => {
  const row = await prisma.config.findUnique({ where: { key: "economy_config" } });
  if (!row) return DEFAULT_ECONOMY_CONFIG;
  const stored = row.value as Partial<EconomyConfig>;
  return { ...DEFAULT_ECONOMY_CONFIG, ...stored };
}, 30_000);

export const getEconomyConfig = cache.get;
