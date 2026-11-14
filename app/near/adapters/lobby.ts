/** NEAR lobby JSON -> the app's Lobby types. */
import { LobbyStatus, type Lobby, type PlayerLobbyState } from "../../types/types";
import type { Lobby as NearLobby, PlayerLobbyState as NearPlayerLobbyState } from "../generated/voidTactics";
import { toBig } from "../codec";
import { NO_ACCOUNT } from "../../types/chain";

/**
 * On NEAR a lobby's fleets are keyed by (lobby, side), with no fleet ids.
 * The screens still pass a fleet id around, so one is derived:
 * lobbyId * 10 + 1 (creator) or + 2 (joiner); 0 = no fleet.
 */
export function fleetIdFor(lobbyId: bigint, isCreator: boolean): bigint {
  return lobbyId * BigInt(10) + (isCreator ? BigInt(1) : BigInt(2));
}

export function parseFleetId(fleetId: bigint): { lobbyId: bigint; isCreator: boolean } | null {
  if (fleetId <= BigInt(0)) return null;
  const side = fleetId % BigInt(10);
  if (side !== BigInt(1) && side !== BigInt(2)) return null;
  return { lobbyId: fleetId / BigInt(10), isCreator: side === BigInt(1) };
}

const STATUS: Record<string, LobbyStatus> = {
  Open: LobbyStatus.Open,
  FleetSelection: LobbyStatus.FleetSelection,
  InGame: LobbyStatus.InGame,
};

export function toLobby(l: NearLobby): Lobby {
  const id = toBig(l.id);
  return {
    basic: {
      id,
      creator: l.creator,
      costLimit: toBig(l.cost_limit),
      createdAt: toBig(l.created_at),
    },
    players: {
      joiner: l.joiner ?? NO_ACCOUNT,
      reservedJoiner: l.reserved_joiner ?? NO_ACCOUNT,
      creatorFleetId: l.creator_fleet ? fleetIdFor(id, true) : BigInt(0),
      joinerFleetId: l.joiner_fleet ? fleetIdFor(id, false) : BigInt(0),
      joinedAt: toBig(l.joined_at),
      joinerFleetSetAt: toBig(l.joiner_fleet_set_at),
    },
    gameConfig: {
      creatorGoesFirst: l.creator_goes_first,
      turnTime: toBig(l.turn_time),
      selectedMapId: toBig(l.map_id),
      maxScore: toBig(l.max_score),
    },
    state: {
      status: STATUS[l.status] ?? LobbyStatus.Open,
      gameStartedAt: toBig(l.game_started_at),
    },
  };
}

export function toPlayerLobbyState(s: NearPlayerLobbyState): PlayerLobbyState {
  return {
    activeLobbyId: toBig(s.active_lobby_id),
    activeLobbiesCount: BigInt(s.active_lobbies_count),
    hasActiveLobby: s.has_active_lobby,
    kickCount: BigInt(s.kick_count),
    lastKickTime: toBig(s.last_kick_time_s),
    activeAILobbiesCount: BigInt(0),
  };
}
