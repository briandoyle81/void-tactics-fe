// Open games register their refetch here (useGamePolling); NearSyncHost
// calls them on the fast cadence while a match is open, and once when the
// tab becomes active again.

export const globalGameRefetchFunctions: Map<number, () => void> = new Map();

export function registerGameRefetch(gameId: number, refetchFn: () => void) {
  globalGameRefetchFunctions.set(gameId, refetchFn);
}

export function unregisterGameRefetch(gameId: number) {
  globalGameRefetchFunctions.delete(gameId);
}

/** Query-key roots NearSyncHost invalidates after transactions and on its slow poll. */
export const NEAR_QUERY_ROOTS = {
  ownedShips: "near-owned-ships",
  playerGames: "near-player-games",
  lobbies: "near-lobbies",
} as const;
