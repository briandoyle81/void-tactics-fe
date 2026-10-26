// A player's record split into PvP and PvE (Profile / ProfileWeb2). The
// stored record (web3 GameResults, web2 PlayerStats) counts only PvP games
// and the tutorial's one win or loss, so each mode counts its finished PvP
// and PvE games itself; whatever the stored record has beyond the PvP games
// is the tutorial's result, which has no game and counts as PvE.

export interface WinLoss {
  wins: number;
  losses: number;
}

export interface SplitPlayerRecord {
  pvp: WinLoss;
  pve: WinLoss;
  /** Both together. */
  total: WinLoss;
}

export function splitPlayerRecord({
  stored,
  pvpGames,
  pveGames,
}: {
  /** GameResults / PlayerStats: PvP games plus the tutorial. */
  stored: WinLoss;
  /** Finished PvP games, counted from the player's games. */
  pvpGames: WinLoss;
  /** Finished games against the AI (missions, runs, AI matches). */
  pveGames: WinLoss;
}): SplitPlayerRecord {
  const tutorial = {
    wins: Math.max(0, stored.wins - pvpGames.wins),
    losses: Math.max(0, stored.losses - pvpGames.losses),
  };
  const pve = { wins: pveGames.wins + tutorial.wins, losses: pveGames.losses + tutorial.losses };
  return {
    pvp: pvpGames,
    pve,
    total: { wins: pvpGames.wins + pve.wins, losses: pvpGames.losses + pve.losses },
  };
}

/** Wins and losses among finished games, given each game's outcome for the player. */
export function countWinLoss<T>(games: readonly T[], outcome: (game: T) => "win" | "loss" | "draw" | null): WinLoss {
  let wins = 0;
  let losses = 0;
  for (const game of games) {
    const o = outcome(game);
    if (o === "win") wins++;
    else if (o === "loss") losses++;
  }
  return { wins, losses };
}
