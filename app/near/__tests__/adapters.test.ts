import { describe, expect, it } from "vitest";
import { bitmapToPositions, positionsToBitmap } from "../adapters/maps";
import { fromNearAction, toGameDataView, toNearAction, GAME_MODE, AI_PLAYER, type GameMeta } from "../adapters/game";
import { fleetIdFor, parseFleetId, toLobby } from "../adapters/lobby";
import { contractErrorName, isContractError } from "../errors";
import { parseJsonKeepingBigInts } from "../rpc";
import { ActionType, LobbyStatus } from "../../types/types";
import type { GameState, Lobby as NearLobby } from "../generated/voidTactics";

describe("map bitmaps", () => {
  it("round-trips tiles through the contract's u64 words (bit = row * 17 + col)", () => {
    const tiles = [
      { row: 0, col: 0 },
      { row: 3, col: 12 }, // bit 63: the top of word 0
      { row: 3, col: 13 }, // bit 64: word 1
      { row: 10, col: 16 }, // the last cell
    ];
    const words = positionsToBitmap(tiles);
    expect(bitmapToPositions(words)).toEqual(tiles);
  });

  it("keeps high bits that a JSON number would lose", () => {
    const parsed = parseJsonKeepingBigInts('{"blocked":[9223372036854775808,1,0]}') as { blocked: Array<string | number> };
    expect(parsed.blocked[0]).toBe("9223372036854775808");
    expect(bitmapToPositions(parsed.blocked)).toEqual([
      { row: 3, col: 12 },
      { row: 3, col: 13 },
    ]);
  });
});

describe("action types", () => {
  it("maps FactionAbility to the app's 7 and back", () => {
    expect(fromNearAction("FactionAbility")).toBe(ActionType.FactionAbility);
    expect(toNearAction(ActionType.FactionAbility)).toBe("FactionAbility");
    expect(toNearAction(ActionType.Shoot)).toBe("Shoot");
    expect(fromNearAction("Retreat")).toBe(ActionType.Retreat);
  });

  it("refuses the web2-only ClaimPoints", () => {
    expect(() => toNearAction(ActionType.ClaimPoints)).toThrow();
  });
});

describe("toGameDataView", () => {
  const board = (row: number, col: number, isCreator: boolean, movedInRound: number, status = 0) =>
    ({
      row,
      col,
      is_creator: isCreator,
      status,
      placed: true,
      version: 1,
      range: 3,
      gun_damage: 50,
      hull_points: 80,
      max_hull_points: 100,
      movement: 4,
      damage_reduction: 10,
      reactor_critical_timer: 0,
      moved_in_round: movedInRound,
    }) as unknown;

  const state = {
    game_id: 9,
    board: { "1": board(2, 1, true, 3), "2": board(5, 1, true, 2), [String(2 ** 40 + 1)]: board(4, 15, false, 0), "3": board(0, 0, true, 1, 1) },
    creator_active: [1, 2],
    joiner_active: [2 ** 40 + 1],
    gone_ship_ids: [3],
    current_round: 3,
    current_turn: "Joiner",
    ended: false,
    winner: null,
    creator_goes_first: true,
    creator_score: 4,
    joiner_score: 1,
    max_score: 100,
    started_at: 1000,
    turn_start_time: 1100,
    turn_time: 300,
    last_move: null,
  } as unknown as GameState;

  const meta: GameMeta = {
    mode: GAME_MODE.ROGUELIKE,
    creator: "alice.testnet",
    joiner: AI_PLAYER,
    lobbyId: BigInt(0),
    nodeId: BigInt(5),
    aiShips: [],
    aiShipInfo: new Map(),
  };

  it("lists active ships then gone ones, with the gone ship's status", () => {
    const view = toGameDataView(state, meta);
    expect(view.shipIds.map(String)).toEqual(["1", "2", String(2 ** 40 + 1), "3"]);
    expect(view.shipPositions.find((p) => p.shipId === BigInt(3))?.status).toBe(1);
    expect(view.shipAttributes[0]).toMatchObject({ hullPoints: 80, maxHullPoints: 100, gunDamage: 50 });
  });

  it("marks ships that moved this round", () => {
    const view = toGameDataView(state, meta);
    expect(view.creatorMovedShipIds).toEqual([BigInt(1)]);
    expect(view.joinerMovedShipIds).toEqual([]);
  });

  it("turns sides into accounts, with the contract as the AI", () => {
    const view = toGameDataView(state, meta);
    expect(view.turnState.currentTurn).toBe(AI_PLAYER);
    expect(view.metadata.winner).toBe("");
    expect(view.metadata.orchestrator).toBe(GAME_MODE.ROGUELIKE);
    expect(view.metadata.nodeId).toBe(BigInt(5));
  });

  it("reports the winner's account once the game ends", () => {
    const view = toGameDataView({ ...state, ended: true, winner: "Creator" } as GameState, meta);
    expect(view.metadata.winner).toBe("alice.testnet");
  });
});

describe("lobbies", () => {
  it("derives a fleet id per lobby side and parses it back", () => {
    const id = fleetIdFor(BigInt(42), false);
    expect(parseFleetId(id)).toEqual({ lobbyId: BigInt(42), isCreator: false });
    expect(parseFleetId(BigInt(0))).toBeNull();
  });

  it("maps a NEAR lobby to the app's shape", () => {
    const l = {
      id: 7,
      creator: "alice.testnet",
      joiner: null,
      reserved_joiner: "bob.testnet",
      creator_fleet: true,
      joiner_fleet: false,
      status: "FleetSelection",
      cost_limit: 500,
      created_at: 1,
      joined_at: 0,
      joiner_fleet_set_at: 0,
      creator_goes_first: true,
      turn_time: 300,
      map_id: 3,
      max_score: 100,
      game_started_at: 0,
      game_id: 0,
      opened_at: 1,
    } as unknown as NearLobby;
    const lobby = toLobby(l);
    expect(lobby.players.joiner).toBe("");
    expect(lobby.players.reservedJoiner).toBe("bob.testnet");
    expect(lobby.players.creatorFleetId).toBe(fleetIdFor(BigInt(7), true));
    expect(lobby.players.joinerFleetId).toBe(BigInt(0));
    expect(lobby.state.status).toBe(LobbyStatus.FleetSelection);
  });
});

describe("contract errors", () => {
  it("pulls the error name out of a panic message", () => {
    const msg = 'Smart contract panicked: InsufficientStorageBalance';
    expect(contractErrorName(msg)).toBe("InsufficientStorageBalance");
    expect(isContractError(new Error(msg), "InsufficientStorageBalance")).toBe(true);
    expect(contractErrorName("network down")).toBeNull();
  });
});
