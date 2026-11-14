import { useChainAccount } from "../near/useChainAccount";
import { useGetGamesForPlayer } from "./useGameContract";
import { GameDataView } from "../types/types";

const EMPTY_GAMES: GameDataView[] = [];

export function usePlayerGames(options?: { enabled?: boolean }) {
  const { address } = useChainAccount();
  const { data, isLoading, isFetching, error, refetch } = useGetGamesForPlayer(address ?? "", {
    enabled: Boolean(address) && (options?.enabled ?? true),
  });
  return {
    games: data ?? EMPTY_GAMES,
    isLoading,
    isFetching,
    error: error?.message ?? null,
    refetch,
  };
}
