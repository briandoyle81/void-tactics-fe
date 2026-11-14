import { useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChainAccount } from "../near/useChainAccount";
import { Lobby } from "../types/types";
import { viewGame } from "../near/rpc";
import { fetchAllPages } from "../near/useNearView";
import { toLobby } from "../near/adapters/lobby";
import { NEAR_QUERY_ROOTS } from "../near/sync/gameRefetchRegistry";

/**
 * Open lobbies plus the player's own (get_open_lobbies, paginated, and
 * get_player_lobbies), each read with get_lobby. NearSyncHost refreshes the
 * list on its slow cadence (other players open and close lobbies) and after
 * the player's own lobby transactions.
 */
export function useLobbyList() {
  const { address } = useChainAccount();
  // After a join, the lobby leaves Open before it's in the player's list;
  // keep any lobby already shown as ours until the player list catches up.
  const mineRef = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: [NEAR_QUERY_ROOTS.lobbies, "list", address ?? ""],
    queryFn: async (): Promise<Lobby[]> => {
      const [open, mine] = await Promise.all([
        fetchAllPages((from, limit) => viewGame("get_open_lobbies", { from_index: from, limit }), 50, 10),
        address ? viewGame("get_player_lobbies", { account_id: address }) : Promise.resolve([] as string[]),
      ]);
      const ids = new Set<string>([...open.map(String), ...(mine ?? []).map(String), ...mineRef.current]);
      const lobbies = await Promise.all([...ids].map((id) => viewGame("get_lobby", { lobby_id: id }).catch(() => null)));
      const out = lobbies.filter((l) => l != null).map((l) => toLobby(l!));
      if (address) {
        mineRef.current = new Set(
          out.filter((l) => l.basic.creator === address || l.players.joiner === address).map((l) => l.basic.id.toString()),
        );
      }
      return out;
    },
    staleTime: 10_000,
  });

  const lobbies = useMemo(() => query.data ?? [], [query.data]);
  const refetch = useCallback(async (): Promise<Lobby[]> => {
    const result = await query.refetch();
    return result.data ?? [];
  }, [query]);

  return {
    lobbies,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch,
  };
}
