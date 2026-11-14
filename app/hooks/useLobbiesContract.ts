import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lobby } from "../types/types";
import { useNearView } from "../near/useNearView";
import { viewGame } from "../near/rpc";
import { toLobby, toPlayerLobbyState } from "../near/adapters/lobby";
import { NEAR_QUERY_ROOTS } from "../near/sync/gameRefetchRegistry";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";
import { useLobbyConfig } from "../near/useGameSettings";

export function lobbyQueryKey(lobbyId: bigint) {
  return [NEAR_QUERY_ROOTS.lobbies, "one", lobbyId.toString()] as const;
}

/** One lobby (get_lobby). */
export function useLobby(lobbyId: bigint, options?: { enabled?: boolean }) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: lobbyQueryKey(lobbyId),
    queryFn: async () => {
      const l = await viewGame("get_lobby", { lobby_id: lobbyId.toString() });
      return l ? toLobby(l) : null;
    },
    enabled: (options?.enabled ?? true) && lobbyId > BigInt(0),
    staleTime: 5_000,
  });
  return { lobby: (data ?? undefined) as Lobby | undefined, error, isLoading, refetch };
}

export function usePlayerLobbyState(playerAddress: string) {
  const args = useMemo(() => (playerAddress ? { account_id: playerAddress } : null), [playerAddress]);
  const select = useMemo(() => toPlayerLobbyState, []);
  const { data, error, isLoading, refetch } = useNearView("get_player_lobby_state", args, { select, staleTime: 10_000 });
  return { playerState: data, error, isLoading, refetch };
}

export function useLobbyCount() {
  return useNearView("get_open_lobby_count", {}, { staleTime: 15_000 });
}

/** Lobby settings (free lobbies per player, extra-lobby fee, pause, stale threshold), from get_lobby_config. */
export function useLobbySettings() {
  const { data, isLoading, error, refetch } = useLobbyConfig();
  return {
    freeGamesPerAddress: data ? BigInt(data.free_games_per_address) : undefined,
    additionalLobbyFee: data ? BigInt(data.additional_lobby_fee) : undefined,
    paused: data?.paused,
    staleLobbyThreshold: data ? BigInt(data.stale_threshold_s) : undefined,
    isLoading,
    error,
    refetchStaleLobbyThreshold: async () => {
      await refetch();
    },
  };
}

export function useIsLobbyOpenForJoining(lobbyId: bigint) {
  const args = useMemo(() => ({ lobby_id: lobbyId.toString() }), [lobbyId]);
  return useNearView("is_lobby_open", args, { staleTime: 5_000 });
}

/** The contract owner, who may change lobby settings. */
export function useLobbiesOwner() {
  return useNearView("owner_id", {}, { staleTime: ADMIN_DATA_STALE_MS });
}
