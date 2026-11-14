import { useCallback } from "react";
import { useChainAccount } from "../near/useChainAccount";
import { useNearSession } from "../near/session";
import { GAS_DEFAULT } from "../near/config";
import { toBig } from "../near/codec";
import type { Address } from "../types/chain";
import { useLobbyCount, usePlayerLobbyState, useLobbySettings } from "./useLobbiesContract";
import { useLobbyList } from "./useLobbyList";
import { Lobby } from "../types/types";
import type { NearCallSpec } from "../near/session";
import type { Calls } from "../near/generated/voidTactics";

export interface CreateLobbyParams {
  costLimit: bigint;
  turnTime: bigint;
  creatorGoesFirst: boolean;
  selectedMapId: bigint;
  maxScore: bigint;
  /** Reserve the lobby for this player (omit for an open lobby). */
  reservedJoiner?: Address;
}

export interface LobbyListState {
  lobbies: Lobby[];
  isLoading: boolean;
  error: string | null;
}

/**
 * PvP lobby actions. Fees (an extra lobby, a reservation) are UTC debited
 * directly by the contract: no approval step.
 */
export function useLobbies() {
  const { address } = useChainAccount();
  const { send } = useNearSession();
  const { data: lobbyCount } = useLobbyCount();
  const { playerState } = usePlayerLobbyState(address || "");
  const { freeGamesPerAddress, additionalLobbyFee, paused, staleLobbyThreshold } = useLobbySettings();
  const { lobbies, isLoading, error, refetch: loadLobbies } = useLobbyList();

  const lobbyList: LobbyListState = { lobbies, isLoading, error };

  const call = useCallback(
    async <M extends keyof Calls>(method: M, args: Calls[M]["args"]) => {
      if (!address) throw new Error("No wallet connected");
      return send({ method, args, gas: GAS_DEFAULT } as NearCallSpec);
    },
    [address, send],
  );

  const createLobby = useCallback(
    async (params: CreateLobbyParams & { activeLobbiesCount?: number }) => {
      const receipt = await call("create_lobby", {
        cost_limit: Number(params.costLimit),
        turn_time: Number(params.turnTime),
        creator_goes_first: params.creatorGoesFirst,
        map_id: params.selectedMapId.toString(),
        max_score: Number(params.maxScore),
        reserved_joiner: params.reservedJoiner || null,
      });
      return toBig(receipt.returnValue as string);
    },
    [call],
  );

  const joinLobby = useCallback((lobbyId: bigint) => call("join_lobby", { lobby_id: lobbyId.toString() }), [call]);
  const leaveLobby = useCallback((lobbyId: bigint) => call("leave_lobby", { lobby_id: lobbyId.toString() }), [call]);
  const timeoutJoiner = useCallback(
    (lobbyId: bigint) => call("timeout_joiner", { lobby_id: lobbyId.toString() }),
    [call],
  );

  /** Places the player's fleet; when both fleets exist the game starts (its id is the return value). */
  const createFleet = useCallback(
    async (lobbyId: bigint, shipIds: bigint[], startingPositions: Array<{ row: number; col: number }>) => {
      await call("create_lobby_fleet", {
        lobby_id: lobbyId.toString(),
        ship_ids: shipIds.map(String),
        positions: startingPositions.map((p) => ({ row: p.row, col: p.col })),
      });
    },
    [call],
  );

  const quitWithPenalty = useCallback(
    (lobbyId: bigint) => call("quit_with_penalty", { lobby_id: lobbyId.toString() }),
    [call],
  );
  const acceptGame = useCallback((lobbyId: bigint) => call("accept_game", { lobby_id: lobbyId.toString() }), [call]);
  const rejectGame = useCallback((lobbyId: bigint) => call("reject_game", { lobby_id: lobbyId.toString() }), [call]);

  return {
    lobbyList,
    playerState,
    lobbyCount,
    freeGamesPerAddress,
    additionalLobbyFee,
    paused,
    staleLobbyThreshold,

    createLobby,
    joinLobby,
    leaveLobby,
    timeoutJoiner,
    createFleet,
    quitWithPenalty,
    acceptGame,
    rejectGame,
    loadLobbies,

    lastTransactionHash: undefined as string | undefined,

    canCreateLobby: !paused && address !== undefined,
    needsPaymentForLobby:
      playerState && freeGamesPerAddress != null
        ? Number(playerState.activeLobbiesCount) >= Number(freeGamesPerAddress)
        : false,
  };
}
