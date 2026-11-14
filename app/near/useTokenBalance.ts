"use client";

import { useMemo } from "react";
import { useNearView } from "./useNearView";
import { TOKEN_DEC, TOKEN_HIVE_MEDAL, TOKEN_UTC } from "./config";

export type GameTokenId = typeof TOKEN_UTC | typeof TOKEN_DEC | typeof TOKEN_HIVE_MEDAL;

/**
 * A NEP-245 balance on the game contract (mt_balance_of): "utc" (18
 * decimals), "dec" (0) or "hive_medal". NearSyncHost refreshes it after any
 * transaction that mints, burns or moves tokens.
 */
export function useTokenBalance(accountId: string | undefined, tokenId: GameTokenId, enabled = true) {
  const args = useMemo(
    () => (accountId && enabled ? { account_id: accountId, token_id: tokenId } : null),
    [accountId, tokenId, enabled],
  );
  const result = useNearView("mt_balance_of", args, { staleTime: 15_000 });
  return { ...result, data: result.data != null ? BigInt(result.data) : undefined };
}
