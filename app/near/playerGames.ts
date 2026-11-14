/**
 * Which games a player is in: get_games_for_player, every game they took
 * part in (finished ones included), paged. Newest first.
 */
import { viewGame } from "./rpc";
import { fetchAllPages } from "./useNearView";

const PAGE = 50;

export async function fetchPlayerGameIds(accountId: string): Promise<bigint[]> {
  const games = await fetchAllPages(
    (from, limit) => viewGame("get_games_for_player", { account_id: accountId, from_index: from, limit }),
    PAGE,
  );
  return games.map((g) => BigInt(g.game_id)).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}
