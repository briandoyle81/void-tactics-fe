import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChainAccount } from "../near/useChainAccount";
import { Ship } from "../types/types";
import { cacheShipsData } from "./useShipDataCache";
import { viewGame } from "../near/rpc";
import { fetchAllPages } from "../near/useNearView";
import { toShipFromView } from "../near/adapters/ship";
import { NEAR_QUERY_ROOTS } from "../near/sync/gameRefetchRegistry";

const PAGE_SIZE = 50;

/** Query key for a player's ships; NearSyncHost invalidates the root after ship events. */
export function ownedShipsQueryKey(accountId: string | undefined) {
  return [NEAR_QUERY_ROOTS.ownedShips, accountId ?? ""] as const;
}

/** Every ship an account owns (paginated get_ships_for_owner, all pages). */
export async function fetchOwnedShips(accountId: string): Promise<Ship[]> {
  const views = await fetchAllPages(
    (from, limit) => viewGame("get_ships_for_owner", { account_id: accountId, from_index: from, limit }),
    PAGE_SIZE,
  );
  return views.map(toShipFromView);
}

/**
 * The signed-in player's ships. Ships auto-construct a block or two after
 * minting (self-callback randomness); while any is still unconstructed this
 * polls every 2s until they're all built.
 */
export function useOwnedShips(options?: { enabled?: boolean }) {
  const { address } = useChainAccount();
  const queryClient = useQueryClient();
  const enabled = (options?.enabled ?? true) && !!address;

  const query = useQuery({
    queryKey: ownedShipsQueryKey(address),
    queryFn: () => fetchOwnedShips(address!),
    enabled,
    staleTime: 30_000,
    refetchInterval: (q) => {
      const ships = q.state.data;
      return ships?.some((s) => !s.shipData.constructed) ? 2000 : false;
    },
  });

  const ships = useMemo(() => query.data ?? [], [query.data]);
  const shipIds = useMemo(() => ships.map((s) => s.id), [ships]);

  useEffect(() => {
    if (ships.length > 0) cacheShipsData(ships);
  }, [ships]);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ownedShipsQueryKey(address) });
  }, [queryClient, address]);

  return {
    shipIds,
    ships,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
    hasShips: ships.length > 0,
    shipCount: ships.length,
  };
}
