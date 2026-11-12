import { prisma } from "./prisma";
import { createTtlCache } from "./ttlCache";

// Web2-mode counterpart to RoguelikeResupply.repairCostPerHP — a DB-backed
// admin setting instead of an onchain owner-only value. In credits
// (0.01 UTC, app/lib/credits.ts): the default 1 is the chain's 0.01 UTC/HP.
export type RoguelikeSettings = { repairCostPerHp: number };

export const DEFAULT_ROGUELIKE_SETTINGS: RoguelikeSettings = { repairCostPerHp: 1 };

const cache = createTtlCache<RoguelikeSettings>(async () => {
  const row = await prisma.config.findUnique({ where: { key: "roguelike_settings" } });
  if (!row) return DEFAULT_ROGUELIKE_SETTINGS;
  const stored = row.value as Partial<RoguelikeSettings>;
  return { ...DEFAULT_ROGUELIKE_SETTINGS, ...stored };
}, 30_000);

export const getRoguelikeSettings = cache.get;
export const invalidateRoguelikeSettingsCache = cache.invalidate;
