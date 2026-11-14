import { useQuery } from "@tanstack/react-query";
import { viewGame } from "../near/rpc";
import { parseFleetId } from "../near/adapters/lobby";
import { toBig } from "../near/codec";
import { NEAR_QUERY_ROOTS } from "../near/sync/gameRefetchRegistry";

/**
 * A lobby fleet by its derived fleet id (app/near/adapters/lobby.ts
 * fleetIdFor), read with get_lobby_fleet. `functionName` keeps the two
 * reads the lobby screen makes:
 *  - "getFleetShipIds": bigint[]
 *  - "getFleetShipIdsAndPositions": [bigint[], {row, col}[]]
 */
export function useFleetsRead(
  functionName: "getFleetShipIds" | "getFleetShipIdsAndPositions" | string,
  args?: readonly unknown[],
  options?: { query?: { enabled?: boolean } },
) {
  const fleetId = args?.[0] != null ? BigInt(args[0] as bigint) : BigInt(0);
  const parsed = parseFleetId(fleetId);
  return useQuery({
    queryKey: [NEAR_QUERY_ROOTS.lobbies, "fleet", fleetId.toString(), functionName],
    queryFn: async () => {
      const fleet = await viewGame("get_lobby_fleet", {
        lobby_id: parsed!.lobbyId.toString(),
        is_creator: parsed!.isCreator,
      });
      const ids = (fleet?.ship_ids ?? []).map((id) => toBig(id));
      const positions = (fleet?.positions ?? []).map((p) => ({ row: p.row, col: p.col }));
      return functionName === "getFleetShipIds" ? ids : ([ids, positions] as const);
    },
    enabled: (options?.query?.enabled ?? true) && !!parsed,
    staleTime: 30_000,
  });
}
