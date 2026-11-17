/**
 * NEAR game state -> the app's GameDataView.
 *
 * The contract keeps a game as one GameState (board keyed by ship id) plus
 * a per-mode record saying who plays it: PvpGame (creator/joiner), SpMatch
 * (single-player: human vs the contract's AI) or RlMatch (roguelike). The
 * AI side has no account; it's shown as the game contract.
 */
import {
  ActionType,
  type Attributes,
  type GameDataView,
  type LastMove,
  type Ship,
  type ShipPosition,
} from "../../types/types";
import type {
  ActionType as NearActionType,
  AiShipInfo,
  GameState,
  LastMove as NearLastMove,
  PvpGame,
  RlMatch,
  Ship as NearShip,
  SpMatch,
} from "../generated/voidTactics";
import { GAME_CONTRACT } from "../config";
import { toBig } from "../codec";
import { viewGame } from "../rpc";
import { toShip } from "./ship";
import { NO_ACCOUNT } from "../../types/chain";

/** GameMetadata.orchestrator / .mode values: which flow started the game. */
export const GAME_MODE = {
  PVP: "pvp",
  SINGLE: "single",
  ROGUELIKE: "roguelike",
} as const;
export type GameMode = (typeof GAME_MODE)[keyof typeof GAME_MODE];

/** The AI side's "account" in single-player and roguelike games. */
export const AI_PLAYER: string = GAME_CONTRACT;

const NEAR_ACTIONS: NearActionType[] = ["Pass", "Shoot", "Retreat", "Assist", "Special", "FactionAbility"];

/** Contract ActionType name -> the app's ActionType (FactionAbility is 7 in the app). */
export function fromNearAction(a: NearActionType): ActionType {
  if (a === "FactionAbility") return ActionType.FactionAbility;
  const i = NEAR_ACTIONS.indexOf(a);
  return (i < 0 ? 0 : i) as ActionType;
}

/** The app's ActionType -> the contract's ActionType name (for move_ship). */
export function toNearAction(a: ActionType | number): NearActionType {
  if (a === ActionType.FactionAbility) return "FactionAbility";
  const n = Number(a);
  if (n === ActionType.ClaimPoints) throw new Error("ClaimPoints is web2-only");
  return NEAR_ACTIONS[n] ?? "Pass";
}

export interface GameMeta {
  mode: GameMode;
  creator: string;
  joiner: string;
  lobbyId: bigint;
  /** Campaign / roguelike node of an AI game. */
  nodeId: bigint;
  /** AI ships of an AI game, as app Ships (owner = AI_PLAYER). */
  aiShips: Ship[];
  /** Per AI ship id: its archetype and special. */
  aiShipInfo: Map<string, AiShipInfo>;
}

type AiShipEntry = [number, NearShip, AiShipInfo];

function aiShipsOf(entries: AiShipEntry[] | undefined): Pick<GameMeta, "aiShips" | "aiShipInfo"> {
  const aiShips: Ship[] = [];
  const aiShipInfo = new Map<string, AiShipInfo>();
  for (const [, ship, info] of entries ?? []) {
    aiShips.push(toShip(ship, AI_PLAYER));
    aiShipInfo.set(String(ship.id), info);
  }
  return { aiShips, aiShipInfo };
}

// Who plays a game never changes, so it's read once per game id.
const metaCache = new Map<string, Promise<GameMeta | null>>();

async function loadMeta(gameId: string): Promise<GameMeta | null> {
  const [pvp, sp, rl] = await Promise.all([
    viewGame("get_pvp_game", { game_id: gameId }) as Promise<PvpGame | null>,
    viewGame("get_sp_match", { game_id: gameId }) as Promise<SpMatch | null>,
    viewGame("get_rl_match", { game_id: gameId }) as Promise<RlMatch | null>,
  ]);
  if (pvp) {
    return {
      mode: GAME_MODE.PVP,
      creator: pvp.creator,
      joiner: pvp.joiner,
      lobbyId: toBig(pvp.lobby_id),
      nodeId: BigInt(0),
      aiShips: [],
      aiShipInfo: new Map(),
    };
  }
  if (rl) {
    return {
      mode: GAME_MODE.ROGUELIKE,
      creator: rl.player,
      joiner: AI_PLAYER,
      lobbyId: BigInt(0),
      nodeId: toBig(rl.node_id),
      ...aiShipsOf(rl.ai_ships as unknown as AiShipEntry[]),
    };
  }
  if (sp) {
    return {
      mode: GAME_MODE.SINGLE,
      creator: sp.human,
      joiner: AI_PLAYER,
      lobbyId: BigInt(0),
      nodeId: toBig(sp.node_id),
      ...aiShipsOf(sp.ai_ships as unknown as AiShipEntry[]),
    };
  }
  return null;
}

/** Who plays this game (cached). Null for an unknown id. */
export function fetchGameMeta(gameId: bigint | number | string): Promise<GameMeta | null> {
  const key = String(gameId);
  let p = metaCache.get(key);
  if (!p) {
    p = loadMeta(key).then((m) => {
      if (!m) metaCache.delete(key); // not created yet: ask again next time
      return m;
    });
    metaCache.set(key, p);
  }
  return p;
}

function toLastMove(m: NearLastMove | null | undefined): LastMove | undefined {
  if (!m) return undefined;
  return {
    shipId: toBig(m.ship_id),
    oldRow: m.old_row,
    oldCol: m.old_col,
    newRow: m.new_row,
    newCol: m.new_col,
    actionType: fromNearAction(m.action_type),
    targetShipId: toBig(m.target_ship_id),
    timestamp: toBig(m.timestamp),
  };
}

// The version (GameState.version) of the board last loaded per game, set
// only when a read succeeds. NearSyncHost refetches a game while its chain
// version differs from this, so a failed refetch (a rate-limited read) is
// retried on the next poll instead of leaving the board stale.
const loadedVersions = new Map<string, number>();

function noteLoaded(state: GameState) {
  loadedVersions.set(String(state.game_id), Number(state.version));
}

/** The version of the board last loaded for this game (undefined before the first read). */
export function loadedGameVersion(gameId: bigint | number | string): number | undefined {
  return loadedVersions.get(String(gameId));
}

/** GameState + who plays it -> GameDataView. */
export function toGameDataView(state: GameState, meta: GameMeta): GameDataView {
  const board = state.board;
  const ids: number[] = [...state.creator_active, ...state.joiner_active, ...state.gone_ship_ids];
  const shipIds = ids.map((id) => toBig(id));
  const shipAttributes: Attributes[] = ids.map((id) => {
    const b = board[String(id)];
    return {
      version: b?.version ?? 0,
      range: b?.range ?? 0,
      gunDamage: b?.gun_damage ?? 0,
      hullPoints: b?.hull_points ?? 0,
      maxHullPoints: b?.max_hull_points ?? 0,
      movement: b?.movement ?? 0,
      damageReduction: b?.damage_reduction ?? 0,
      reactorCriticalTimer: b?.reactor_critical_timer ?? 0,
    };
  });
  const shipPositions: ShipPosition[] = [];
  for (const [list, isCreator] of [
    [state.creator_active, true],
    [state.joiner_active, false],
  ] as const) {
    for (const id of list) {
      const b = board[String(id)];
      if (!b) continue;
      shipPositions.push({ shipId: toBig(id), position: { row: b.row, col: b.col }, isCreator, status: 0 });
    }
  }
  for (const id of state.gone_ship_ids) {
    const b = board[String(id)];
    if (!b) continue;
    shipPositions.push({
      shipId: toBig(id),
      position: { row: b.row, col: b.col },
      isCreator: b.is_creator,
      status: (b.status === 2 ? 2 : 1) as 1 | 2,
    });
  }
  const moved = (list: number[]) =>
    list.filter((id) => board[String(id)]?.moved_in_round === state.current_round).map((id) => toBig(id));

  const sideAccount = (side: "Creator" | "Joiner" | null | undefined) =>
    side === "Creator" ? meta.creator : side === "Joiner" ? meta.joiner : NO_ACCOUNT;

  return {
    metadata: {
      gameId: toBig(state.game_id),
      lobbyId: meta.lobbyId,
      creator: meta.creator,
      joiner: meta.joiner,
      creatorFleetId: BigInt(0),
      joinerFleetId: BigInt(0),
      creatorGoesFirst: state.creator_goes_first,
      startedAt: toBig(state.started_at),
      winner: state.ended ? sideAccount(state.winner) : NO_ACCOUNT,
      ended: state.ended,
      orchestrator: meta.mode,
      mode: meta.mode,
      nodeId: meta.nodeId,
    },
    turnState: {
      currentTurn: sideAccount(state.current_turn),
      turnTime: toBig(state.turn_time),
      turnStartTime: toBig(state.turn_start_time),
      currentRound: toBig(state.current_round),
    },
    gridDimensions: { gridWidth: 17, gridHeight: 11 },
    maxScore: toBig(state.max_score),
    creatorScore: toBig(state.creator_score),
    joinerScore: toBig(state.joiner_score),
    shipIds,
    shipAttributes,
    shipPositions,
    creatorActiveShipIds: state.creator_active.map((id) => toBig(id)),
    joinerActiveShipIds: state.joiner_active.map((id) => toBig(id)),
    creatorMovedShipIds: moved(state.creator_active),
    joinerMovedShipIds: moved(state.joiner_active),
    lastMove: toLastMove(state.last_move),
  };
}

/** Reads one game as a GameDataView (null when it doesn't exist). */
export async function fetchGameDataView(
  gameId: bigint | number | string,
  onState?: (state: GameState) => void,
): Promise<GameDataView | null> {
  const [state, meta] = await Promise.all([
    viewGame("get_game", { game_id: String(gameId) }),
    fetchGameMeta(gameId),
  ]);
  if (state) {
    noteLoaded(state);
    onState?.(state);
  }
  if (!state || !meta) return null;
  return toGameDataView(state, meta);
}

/** Several games as GameDataViews, through get_games (10 boards per call). */
export async function fetchGameDataViews(gameIds: Array<bigint | number | string>): Promise<GameDataView[]> {
  const BATCH = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < gameIds.length; i += BATCH) chunks.push(gameIds.slice(i, i + BATCH).map(String));
  const [states, metas] = await Promise.all([
    Promise.all(chunks.map((ids) => viewGame("get_games", { game_ids: ids }))),
    Promise.all(gameIds.map((id) => fetchGameMeta(id).catch(() => null))),
  ]);
  const byId = new Map(states.flat().map(([id, state]) => [id, state]));
  const out: GameDataView[] = [];
  gameIds.forEach((id, i) => {
    const state = byId.get(String(id));
    const meta = metas[i];
    if (state) noteLoaded(state);
    if (state && meta) out.push(toGameDataView(state, meta));
  });
  return out;
}
