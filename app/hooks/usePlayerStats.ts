import { useMemo } from "react";
import { useNearView } from "../near/useNearView";

export interface PlayerStats {
  wins: bigint;
  losses: bigint;
}

/** PvP wins and losses (get_player_stats). */
export function usePlayerStats(playerAddress: string | undefined) {
  const args = useMemo(() => (playerAddress ? { account_id: playerAddress } : null), [playerAddress]);
  const { data } = useNearView("get_player_stats", args, { staleTime: 60_000 });
  return useMemo(() => {
    if (!data) return undefined;
    const { wins, losses } = data as { wins?: number; losses?: number };
    return { wins: BigInt(wins ?? 0), losses: BigInt(losses ?? 0) } as PlayerStats;
  }, [data]);
}
