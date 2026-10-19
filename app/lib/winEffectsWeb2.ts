import { prisma } from "./prisma";
import { createTtlCache } from "./ttlCache";
import { grantRewardShip } from "./shipGrantsWeb2";
import {
  WIN_EFFECT_KEYS,
  WIN_EFFECT_LABELS,
  IMPLEMENTED_WIN_EFFECT_KEYS,
  isWinEffectKey,
  type WinEffectKey,
} from "./winEffectsCatalog";

// Web2 counterpart to the on-chain pluggable win effects (contracts/
// IWinEffect.sol — DECBonusWinEffect/HealAboveFloorWinEffect/
// ShipGrantWinEffect), assignable to roguelike combat nodes
// (RoguelikeNode.winEffects). Like the contracts since the 2026-10-17
// redeploy (audit HA6-27), PvP and tournament games have none. Same
// three keys as useWinEffects.ts's WIN_EFFECT_CATALOG so admin UI and node
// config speak one vocabulary across both flows. The catalog itself lives
// in winEffectsCatalog.ts (re-exported below) since this file imports
// prisma and can't be pulled into a client bundle.
//
// HEAL_ABOVE_FLOOR_WIN_EFFECT isn't handled by applyWinEffects(): like the
// on-chain HealAboveFloorWinEffect it raises every surviving roguelike
// roster ship to healAboveFloorPercent of max hull, so it's applied inside
// resolveRoguelikeRunIfApplicable alongside the campaign auto-heal floor.
export { WIN_EFFECT_KEYS, WIN_EFFECT_LABELS, IMPLEMENTED_WIN_EFFECT_KEYS, isWinEffectKey };
export type { WinEffectKey };

export interface WinEffectsSettings {
  decBonusAmount: number;
  healAboveFloorPercent: number; // applied in resolveRoguelikeRunIfApplicable, see module doc
  healCapPercent: number; // 100 = uncapped — caps every heal effect (Repair special, win-effect heals) at this % of max HP
}

export const DEFAULT_WIN_EFFECTS_SETTINGS: WinEffectsSettings = {
  decBonusAmount: 0,
  healAboveFloorPercent: 100,
  healCapPercent: 100,
};

const cache = createTtlCache<WinEffectsSettings>(async () => {
  const row = await prisma.config.findUnique({ where: { key: "win_effects_settings" } });
  if (!row) return DEFAULT_WIN_EFFECTS_SETTINGS;
  const stored = row.value as Partial<WinEffectsSettings>;
  return { ...DEFAULT_WIN_EFFECTS_SETTINGS, ...stored };
}, 30_000);

export const getWinEffectsSettings = cache.get;
export const invalidateWinEffectsSettingsCache = cache.invalidate;

/**
 * Applies a roguelike node's win effect keys to `winnerId`. Skips HEAL_ABOVE_FLOOR_WIN_EFFECT, which the
 * roguelike resolver applies itself — see module doc. Like RoguelikeMatch's
 * WinEffectFailed, an effect that fails is logged and the win still counts.
 */
export async function applyWinEffects(
  effects: readonly string[],
  winnerId: string,
  context: { nodeId: number; lobbyId: number },
): Promise<void> {
  if (effects.length === 0) return;
  const settings = await getWinEffectsSettings();

  if (effects.includes("DEC_BONUS_WIN_EFFECT") && settings.decBonusAmount > 0) {
    await prisma.user.update({
      where: { id: winnerId },
      data: { decBalance: { increment: settings.decBonusAmount } },
    });
  }

  if (effects.includes("SHIP_GRANT_WIN_EFFECT")) {
    try {
      await grantRewardShip(context.nodeId, winnerId, context.lobbyId);
    } catch (error) {
      console.error(`Grant Ship failed for node ${context.nodeId}:`, error);
    }
  }
}
