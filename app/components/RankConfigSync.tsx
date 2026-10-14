"use client";

import { useRankConfigSync } from "../hooks/useRankConfigSync";
import { useRankConfigSyncWeb2 } from "../hooks/useRankConfigSyncWeb2";

// Keeps rankConfigCache.ts warm from both modes' live sources (see
// useRankConfigSync.ts / useRankConfigSyncWeb2.ts). Mounted by the game
// routes' layouts (/play, /admin, /[gameId], /tournaments), not app-wide:
// the website shows only demo ships, which use DEFAULT_RANK_CONFIG, so the
// homepage needs no RPC call for it.
export function RankConfigSync() {
  useRankConfigSync();
  useRankConfigSyncWeb2();
  return null;
}
