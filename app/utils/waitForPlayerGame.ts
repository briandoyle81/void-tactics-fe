import type { QueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { GAMES_WEB2_PLAYER_QUERY_KEY } from "../hooks/useGamesWeb2";
import type { Web2GameDataView } from "../types/web2Game";
import { NEAR_QUERY_ROOTS } from "../near/sync/gameRefetchRegistry";

/**
 * After a mission launch, makes sure the Games tab's list (usePlayerGames)
 * has `gameId` before navigating: get_games_for_player lists it once the
 * launch transaction has executed, so one refetch is enough (no polling).
 */
export async function waitForPlayerGame({
  queryClient,
}: {
  config?: unknown;
  queryClient: QueryClient;
  playerAddress: string;
  gameId: bigint;
  timeoutMs?: number;
}): Promise<boolean> {
  await queryClient.invalidateQueries({ queryKey: [NEAR_QUERY_ROOTS.playerGames] });
  return true;
}

/**
 * Web2 counterpart: refreshes the cached /api/games list GamesWeb2.tsx reads
 * until it contains `gameId`. GamesWeb2's restore effect drops a pending
 * selection the first time it doesn't find the game, so the list must have
 * it before navigating. The server is consistent, so this normally succeeds
 * on the first fetch; the loop only covers transient request failures.
 */
export async function waitForPlayerGameWeb2({
  queryClient,
  gameId,
  timeoutMs = 10_000,
}: {
  queryClient: QueryClient;
  gameId: number;
  timeoutMs?: number;
}): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const games = await queryClient.fetchQuery({
        queryKey: GAMES_WEB2_PLAYER_QUERY_KEY,
        queryFn: () => apiFetch<Web2GameDataView[]>("/api/games"),
        staleTime: 0,
      });
      if (games.some((game) => Number(game.metadata.gameId) === gameId)) return true;
    } catch (error) {
      console.warn("waitForPlayerGameWeb2: read failed, retrying", error);
    }
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
