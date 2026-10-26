import type {
  DialogCondition,
  DialogMission,
  DialogResponse,
  DialogSide,
  DialogTrigger,
  GenericDialogLine,
  MissionDialogLine,
} from "../types/dialog";
import { MISSION_DIALOG_LINES } from "../data/dialog/missionDialog";
import { GENERIC_DIALOG_LINES } from "../data/dialog/genericDialog";
import type { VictoryReasonEnemyShip } from "./victoryReason";
import { isRepairDronesSpecial } from "./specialConfigWeb2";

// Pure trigger engine for in-mission dialog. Shared by GameDisplay.tsx,
// GameDisplayWeb2.tsx and SimulatedGameDisplay.tsx (via useMissionDialog).
// Number-native: each view converts its own game data before calling this.

/** The parts of a game's state that dialog triggers look at. */
export interface DialogSnapshot {
  round: number;
  myScore: number;
  enemyScore: number;
  /** Ships removed from the game (status destroyed). */
  myShipsDestroyed: number;
  enemyShipsDestroyed: number;
  /**
   * Ships that left the board without being destroyed (status fled): they
   * retreated or were rammed off. Fled is final, so this only goes up.
   */
  myShipsRetreated: number;
  enemyShipsRetreated: number;
  /**
   * Distinct ships that have been disabled (0 hull, still on the board) at
   * any point this game — a repaired-then-disabled-again ship counts once,
   * and a disabled ship that's later destroyed still counts. Built from
   * DialogObservation by mergeDisabledShips.
   */
  myShipsDisabled: number;
  enemyShipsDisabled: number;
  /**
   * Reactor damage taken so far this game: the sum of each ship's highest
   * reactor level (it only goes up), so every hit, EMP, ram or end-of-round
   * tick on a disabled ship adds one. Built by mergeDisabledShips.
   */
  myReactorDamage: number;
  enemyReactorDamage: number;
  /**
   * How many of this side's ships have reached each overload level so far
   * (index = level). [2] is ships that have hit 2 pips on that one ship.
   * Built by mergeDisabledShips from each ship's highest reactor level.
   */
  myShipsAtReactorLevel: number[];
  enemyShipsAtReactorLevel: number[];
  /**
   * Distinct resource (scoring) tiles a working ship of each side has stood
   * on so far this game: landing on one counts, holding it doesn't add
   * more. Built by mergeDisabledShips.
   */
  myResourceTilesTaken: number;
  enemyResourceTilesTaken: number;
  /** Distinct ships that have taken hull damage so far this game. Built by mergeDisabledShips. */
  myShipsDamaged?: number;
  enemyShipsDamaged?: number;
  /** Distinct ships disabled while on a resource tile so far this game. Built by mergeDisabledShips. */
  myShipsDisabledOnResource?: number;
  enemyShipsDisabledOnResource?: number;
  /**
   * Distinct ships repaired so far this game: hull back above the lowest
   * it's been. Built by mergeDisabledShips from each ship's hull low.
   */
  myShipsRepaired?: number;
  enemyShipsRepaired?: number;
  /** Each fleet's faction (variant); null when unknown or mixed. For line conditions and shipsRepaired. */
  myFleetFaction?: number | null;
  enemyFleetFaction?: number | null;
  /** A working ship on that side can repair (Repair Drones, or faction 2's Repair). */
  myCanRepair?: boolean;
  enemyCanRepair?: boolean;
  /** How the game ended for the local player; null while it's still running (or a draw). */
  outcome: DialogOutcome;
}

export type DialogOutcome = "victory" | "defeat" | null;

/**
 * What a view sees right now. Disabled ships are given by id (only the
 * ones disabled at this moment); the hook folds them into the per-game
 * "ever disabled" set to get DialogSnapshot's cumulative counts.
 */
export type DialogObservation = Omit<
  DialogSnapshot,
  | "myShipsDisabled"
  | "enemyShipsDisabled"
  | "myReactorDamage"
  | "enemyReactorDamage"
  | "myShipsAtReactorLevel"
  | "enemyShipsAtReactorLevel"
  | "myResourceTilesTaken"
  | "enemyResourceTilesTaken"
  | "myShipsDamaged"
  | "enemyShipsDamaged"
  | "myShipsDisabledOnResource"
  | "enemyShipsDisabledOnResource"
  | "myShipsRepaired"
  | "enemyShipsRepaired"
> & {
  myDisabledShipIds: string[];
  enemyDisabledShipIds: string[];
  /** Each ship's reactor level right now, by ship id. */
  myReactorLevels: Record<string, number>;
  enemyReactorLevels: Record<string, number>;
  /** Resource tiles ("row,col") a working ship of each side stands on right now. */
  myResourceTiles: string[];
  enemyResourceTiles: string[];
  /** Ships below max hull right now (active, hull known). */
  myDamagedShipIds?: string[];
  enemyDamagedShipIds?: string[];
  /** Disabled ships sitting on a resource tile right now. */
  myDisabledOnResourceShipIds?: string[];
  enemyDisabledOnResourceShipIds?: string[];
  /** Each active ship's hull right now, by ship id (for repairs). */
  myHulls?: Record<string, number>;
  enemyHulls?: Record<string, number>;
};

/** Resource tiles ("row,col") each side has stood on so far this game. */
export interface EverHeldTiles {
  player: string[];
  enemy: string[];
}

/** Each ship's highest reactor level so far this game, per side. */
export interface ReactorHighs {
  player: Record<string, number>;
  enemy: Record<string, number>;
}

/** Ids of every ship disabled so far this game, per side. */
export interface EverDisabledShips {
  player: string[];
  enemy: string[];
}

/** The rest of the per-game ship history the hull triggers need (see mergeDisabledShips). */
export interface ShipHistory {
  damaged: EverDisabledShips;
  disabledOnResource: EverDisabledShips;
  repaired: EverDisabledShips;
  /** Each ship's lowest hull so far. */
  hullLows: ReactorHighs;
}

export interface DialogShip extends VictoryReasonEnemyShip {
  /** Ship id, as a string (bigint/number ids converted by the view). */
  id: string;
  isMine: boolean;
  /** Reactor damage level (reactorCriticalTimer); null when unknown. */
  reactorLevel?: number | null;
  /** Board position, for resource tiles (row/col < 0 or missing: off the board). */
  position?: { row: number; col: number };
  /** Full hull; null/missing when unknown (no damage is reported). */
  maxHullPoints?: number | null;
  /** The ship's faction (traits.variant). */
  variant?: number;
  /** It can repair: Repair Drones equipped, or faction 2's Repair. */
  canRepair?: boolean;
}

/** A ship's faction and whether it can repair (Repair Drones, or faction 2's innate Repair), for DialogShip. */
export function dialogShipKit(variant: number, special: number): Pick<DialogShip, "variant" | "canRepair"> {
  return { variant, canRepair: variant === 2 || isRepairDronesSpecial(variant, special) };
}

/** The side's faction when every ship shares one; null when unknown or mixed. */
function fleetFaction(ships: readonly DialogShip[]): number | null {
  let faction: number | null = null;
  for (const ship of ships) {
    if (ship.variant == null) continue;
    if (faction != null && faction !== ship.variant) return null;
    faction = ship.variant;
  }
  return faction;
}

/** Ship status values (ShipPosition.status). */
const STATUS_ACTIVE = 0;
const STATUS_DESTROYED = 1;
const STATUS_FLED = 2;

export function buildDialogSnapshot({
  round,
  myScore,
  enemyScore,
  ships,
  scoringGrid,
  outcome = null,
}: {
  round: number;
  myScore: number;
  enemyScore: number;
  ships: readonly DialogShip[];
  /** The map's scoring grid (points per tile, 0 = none), for resource tiles. */
  scoringGrid?: readonly (readonly number[])[];
  outcome?: DialogOutcome;
}): DialogObservation {
  let myShipsDestroyed = 0;
  let enemyShipsDestroyed = 0;
  let myShipsRetreated = 0;
  let enemyShipsRetreated = 0;
  const myDisabledShipIds: string[] = [];
  const enemyDisabledShipIds: string[] = [];
  const myReactorLevels: Record<string, number> = {};
  const enemyReactorLevels: Record<string, number> = {};
  const myResourceTiles: string[] = [];
  const enemyResourceTiles: string[] = [];
  const myDamagedShipIds: string[] = [];
  const enemyDamagedShipIds: string[] = [];
  const myDisabledOnResourceShipIds: string[] = [];
  const enemyDisabledOnResourceShipIds: string[] = [];
  const myHulls: Record<string, number> = {};
  const enemyHulls: Record<string, number> = {};
  let myCanRepair = false;
  let enemyCanRepair = false;
  for (const ship of ships) {
    // A working ship (active, not at 0 hull) on a resource tile has taken it.
    const pos = ship.position;
    const isWorking =
      (ship.status ?? STATUS_ACTIVE) === STATUS_ACTIVE && (ship.hullPoints == null || ship.hullPoints > 0);
    const onResourceTile =
      !!pos && pos.row >= 0 && pos.col >= 0 && (scoringGrid?.[pos.row]?.[pos.col] ?? 0) > 0;
    if (isWorking && onResourceTile) {
      (ship.isMine ? myResourceTiles : enemyResourceTiles).push(`${pos!.row},${pos!.col}`);
    }
    if (isWorking && ship.canRepair) {
      if (ship.isMine) myCanRepair = true;
      else enemyCanRepair = true;
    }
    if ((ship.status ?? STATUS_ACTIVE) === STATUS_ACTIVE && ship.hullPoints != null) {
      (ship.isMine ? myHulls : enemyHulls)[ship.id] = ship.hullPoints;
      if (ship.maxHullPoints != null && ship.hullPoints < ship.maxHullPoints) {
        (ship.isMine ? myDamagedShipIds : enemyDamagedShipIds).push(ship.id);
      }
      if (ship.hullPoints <= 0 && onResourceTile) {
        (ship.isMine ? myDisabledOnResourceShipIds : enemyDisabledOnResourceShipIds).push(ship.id);
      }
    }
    if (ship.reactorLevel != null && ship.reactorLevel > 0) {
      (ship.isMine ? myReactorLevels : enemyReactorLevels)[ship.id] = ship.reactorLevel;
    }
    const status = ship.status ?? STATUS_ACTIVE;
    if (status === STATUS_DESTROYED) {
      if (ship.isMine) myShipsDestroyed++;
      else enemyShipsDestroyed++;
    } else if (status === STATUS_FLED) {
      if (ship.isMine) myShipsRetreated++;
      else enemyShipsRetreated++;
    } else if (status === STATUS_ACTIVE && ship.hullPoints != null && ship.hullPoints <= 0) {
      // Disabled: 0 hull but still on the board. Unknown attributes (null)
      // are treated as flying, same as victoryReason.ts.
      (ship.isMine ? myDisabledShipIds : enemyDisabledShipIds).push(ship.id);
    }
  }
  return {
    round,
    myScore,
    enemyScore,
    myShipsDestroyed,
    enemyShipsDestroyed,
    myShipsRetreated,
    enemyShipsRetreated,
    myDisabledShipIds,
    enemyDisabledShipIds,
    myReactorLevels,
    enemyReactorLevels,
    myResourceTiles,
    enemyResourceTiles,
    myDamagedShipIds,
    enemyDamagedShipIds,
    myDisabledOnResourceShipIds,
    enemyDisabledOnResourceShipIds,
    myHulls,
    enemyHulls,
    myFleetFaction: fleetFaction(ships.filter((ship) => ship.isMine)),
    enemyFleetFaction: fleetFaction(ships.filter((ship) => !ship.isMine)),
    myCanRepair,
    enemyCanRepair,
    outcome,
  };
}

const union = (a: readonly string[] | undefined, b: readonly string[] | undefined) => [
  ...new Set([...(a ?? []), ...(b ?? [])]),
];

/** Folds this observation's hulls into the history: a ship above its lowest hull was repaired. */
function mergeShipHistory(observation: DialogObservation, history: ShipHistory | null | undefined): ShipHistory {
  const side = (hulls: Record<string, number> | undefined, lows: Record<string, number> | undefined, repaired: string[] | undefined) => {
    const nextLows = { ...(lows ?? {}) };
    const nextRepaired = new Set(repaired ?? []);
    for (const [id, hull] of Object.entries(hulls ?? {})) {
      const low = nextLows[id];
      if (low != null && hull > low) nextRepaired.add(id);
      if (low == null || hull < low) nextLows[id] = hull;
    }
    return { lows: nextLows, repaired: [...nextRepaired] };
  };
  const player = side(observation.myHulls, history?.hullLows.player, history?.repaired.player);
  const enemy = side(observation.enemyHulls, history?.hullLows.enemy, history?.repaired.enemy);
  return {
    damaged: {
      player: union(history?.damaged.player, observation.myDamagedShipIds),
      enemy: union(history?.damaged.enemy, observation.enemyDamagedShipIds),
    },
    disabledOnResource: {
      player: union(history?.disabledOnResource.player, observation.myDisabledOnResourceShipIds),
      enemy: union(history?.disabledOnResource.enemy, observation.enemyDisabledOnResourceShipIds),
    },
    repaired: { player: player.repaired, enemy: enemy.repaired },
    hullLows: { player: player.lows, enemy: enemy.lows },
  };
}

function mergeHighs(
  highs: Record<string, number> | undefined,
  levels: Record<string, number>,
): Record<string, number> {
  const merged = { ...(highs ?? {}) };
  for (const [id, level] of Object.entries(levels)) {
    if (level > (merged[id] ?? 0)) merged[id] = level;
  }
  return merged;
}

const sumValues = (record: Record<string, number>) =>
  Object.values(record).reduce((total, value) => total + value, 0);

/** Index = overload level; value = distinct ships whose high is at least that. */
function shipsAtReactorLevels(highs: Record<string, number>): number[] {
  let max = 0;
  for (const value of Object.values(highs)) if (value > max) max = value;
  const counts = Array(max + 1).fill(0) as number[];
  for (const value of Object.values(highs)) {
    for (let level = 1; level <= value; level++) counts[level]++;
  }
  return counts;
}

function sameLevelCounts(a: number[] | undefined, b: number[] | undefined): boolean {
  const len = Math.max(a?.length ?? 0, b?.length ?? 0);
  for (let i = 1; i < len; i++) {
    if ((a?.[i] ?? 0) !== (b?.[i] ?? 0)) return false;
  }
  return true;
}

/**
 * Folds the ships disabled right now into the game's running "ever
 * disabled" set, and each ship's reactor level into its running high, and
 * returns the snapshot (with cumulative counts) plus the updated state to
 * persist.
 */
export function mergeDisabledShips(
  observation: DialogObservation,
  everDisabled: EverDisabledShips | null | undefined,
  reactorHighs?: ReactorHighs | null,
  everHeldTiles?: EverHeldTiles | null,
  shipHistory?: ShipHistory | null,
): {
  snapshot: DialogSnapshot;
  everDisabled: EverDisabledShips;
  reactorHighs: ReactorHighs;
  everHeldTiles: EverHeldTiles;
  shipHistory: ShipHistory;
} {
  const history = mergeShipHistory(observation, shipHistory);
  const player = [...new Set([...(everDisabled?.player ?? []), ...observation.myDisabledShipIds])];
  const enemy = [...new Set([...(everDisabled?.enemy ?? []), ...observation.enemyDisabledShipIds])];
  const highs: ReactorHighs = {
    player: mergeHighs(reactorHighs?.player, observation.myReactorLevels ?? {}),
    enemy: mergeHighs(reactorHighs?.enemy, observation.enemyReactorLevels ?? {}),
  };
  const tiles: EverHeldTiles = {
    player: [...new Set([...(everHeldTiles?.player ?? []), ...(observation.myResourceTiles ?? [])])],
    enemy: [...new Set([...(everHeldTiles?.enemy ?? []), ...(observation.enemyResourceTiles ?? [])])],
  };
  return {
    snapshot: {
      round: observation.round,
      myScore: observation.myScore,
      enemyScore: observation.enemyScore,
      myShipsDestroyed: observation.myShipsDestroyed,
      enemyShipsDestroyed: observation.enemyShipsDestroyed,
      myShipsRetreated: observation.myShipsRetreated,
      enemyShipsRetreated: observation.enemyShipsRetreated,
      myShipsDisabled: player.length,
      enemyShipsDisabled: enemy.length,
      myReactorDamage: sumValues(highs.player),
      enemyReactorDamage: sumValues(highs.enemy),
      myShipsAtReactorLevel: shipsAtReactorLevels(highs.player),
      enemyShipsAtReactorLevel: shipsAtReactorLevels(highs.enemy),
      myResourceTilesTaken: tiles.player.length,
      enemyResourceTilesTaken: tiles.enemy.length,
      myShipsDamaged: history.damaged.player.length,
      enemyShipsDamaged: history.damaged.enemy.length,
      myShipsDisabledOnResource: history.disabledOnResource.player.length,
      enemyShipsDisabledOnResource: history.disabledOnResource.enemy.length,
      myShipsRepaired: history.repaired.player.length,
      enemyShipsRepaired: history.repaired.enemy.length,
      myFleetFaction: observation.myFleetFaction ?? null,
      enemyFleetFaction: observation.enemyFleetFaction ?? null,
      myCanRepair: observation.myCanRepair ?? false,
      enemyCanRepair: observation.enemyCanRepair ?? false,
      outcome: observation.outcome,
    },
    everDisabled: { player, enemy },
    reactorHighs: highs,
    everHeldTiles: tiles,
    shipHistory: history,
  };
}

/** True when nothing has happened yet: first round, no points, no losses. */
export function isOpeningSnapshot(s: DialogSnapshot): boolean {
  return (
    s.round <= 1 &&
    s.myScore === 0 &&
    s.enemyScore === 0 &&
    s.myShipsDestroyed === 0 &&
    s.enemyShipsDestroyed === 0 &&
    (s.myShipsRetreated ?? 0) === 0 &&
    (s.enemyShipsRetreated ?? 0) === 0 &&
    s.myShipsDisabled === 0 &&
    s.enemyShipsDisabled === 0 &&
    (s.myReactorDamage ?? 0) === 0 &&
    (s.enemyReactorDamage ?? 0) === 0 &&
    (s.myShipsAtReactorLevel?.[1] ?? 0) === 0 &&
    (s.enemyShipsAtReactorLevel?.[1] ?? 0) === 0 &&
    (s.myResourceTilesTaken ?? 0) === 0 &&
    (s.enemyResourceTilesTaken ?? 0) === 0 &&
    (s.myShipsDamaged ?? 0) === 0 &&
    (s.enemyShipsDamaged ?? 0) === 0 &&
    (s.myShipsRepaired ?? 0) === 0 &&
    (s.enemyShipsRepaired ?? 0) === 0 &&
    s.outcome === null
  );
}

export function snapshotsEqual(a: DialogSnapshot, b: DialogSnapshot): boolean {
  return (
    a.round === b.round &&
    a.myScore === b.myScore &&
    a.enemyScore === b.enemyScore &&
    a.myShipsDestroyed === b.myShipsDestroyed &&
    a.enemyShipsDestroyed === b.enemyShipsDestroyed &&
    a.myShipsDisabled === b.myShipsDisabled &&
    a.enemyShipsDisabled === b.enemyShipsDisabled &&
    a.myReactorDamage === b.myReactorDamage &&
    a.enemyReactorDamage === b.enemyReactorDamage &&
    sameLevelCounts(a.myShipsAtReactorLevel, b.myShipsAtReactorLevel) &&
    sameLevelCounts(a.enemyShipsAtReactorLevel, b.enemyShipsAtReactorLevel) &&
    a.myShipsRetreated === b.myShipsRetreated &&
    a.enemyShipsRetreated === b.enemyShipsRetreated &&
    a.myResourceTilesTaken === b.myResourceTilesTaken &&
    a.enemyResourceTilesTaken === b.enemyResourceTilesTaken &&
    (a.myShipsDamaged ?? 0) === (b.myShipsDamaged ?? 0) &&
    (a.enemyShipsDamaged ?? 0) === (b.enemyShipsDamaged ?? 0) &&
    (a.myShipsDisabledOnResource ?? 0) === (b.myShipsDisabledOnResource ?? 0) &&
    (a.enemyShipsDisabledOnResource ?? 0) === (b.enemyShipsDisabledOnResource ?? 0) &&
    (a.myShipsRepaired ?? 0) === (b.myShipsRepaired ?? 0) &&
    (a.enemyShipsRepaired ?? 0) === (b.enemyShipsRepaired ?? 0) &&
    a.outcome === b.outcome
  );
}

/** One concrete thing that happened between two snapshots. */
export type DialogOccurrence =
  | { type: "missionStart" }
  | { type: "roundEnd"; round: number }
  | { type: "roundStart"; round: number }
  | { type: "shipsDisabled"; side: DialogSide; count: number }
  | { type: "shipsDestroyed"; side: DialogSide; count: number }
  /** `total`: the side's retreated ships after this rise. */
  | { type: "shipsRetreated"; side: DialogSide; total: number }
  | { type: "pointsScored"; side: DialogSide; points: number }
  /** `total`: the side's reactor damage after this rise. */
  | { type: "reactorDamaged"; side: DialogSide; total: number }
  /** `total`: how many of `side`'s ships have reached `level`. */
  | { type: "reactorOverloadWarning"; side: DialogSide; level: number; total: number }
  | { type: "resourceTileTaken"; side: DialogSide; count: number }
  | { type: "shipsDamaged"; side: DialogSide; count: number }
  | { type: "shipsDisabledOnResource"; side: DialogSide; count: number }
  /** `side` "any": either side's repairs counted. */
  | { type: "shipsRepaired"; side: DialogSide | "any"; faction: number | null; count: number }
  | { type: "missionVictory" }
  | { type: "missionDefeat" };

export function occurrenceKey(o: DialogOccurrence): string {
  switch (o.type) {
    case "missionStart":
    case "missionVictory":
    case "missionDefeat":
      return o.type;
    case "roundEnd":
    case "roundStart":
      return `${o.type}:${o.round}`;
    case "shipsDisabled":
    case "shipsDestroyed":
      return `${o.type}:${o.side}:${o.count}`;
    case "pointsScored":
      return `pointsScored:${o.side}:${o.points}`;
    case "reactorDamaged":
    case "shipsRetreated":
      return `${o.type}:${o.side}:${o.total}`;
    case "reactorOverloadWarning":
      return `reactorOverloadWarning:${o.side}:${o.level}:${o.total}`;
    case "resourceTileTaken":
    case "shipsDamaged":
    case "shipsDisabledOnResource":
      return `${o.type}:${o.side}:${o.count}`;
    case "shipsRepaired":
      return `shipsRepaired:${o.side}:${o.faction ?? "any"}:${o.count}`;
  }
}

const OCCURRENCE_ORDER: Record<DialogOccurrence["type"], number> = {
  missionStart: 0,
  roundEnd: 1,
  roundStart: 2,
  shipsDamaged: 3,
  shipsDisabled: 3,
  shipsDisabledOnResource: 3,
  shipsRepaired: 4,
  reactorDamaged: 4,
  reactorOverloadWarning: 5,
  shipsDestroyed: 6,
  shipsRetreated: 6,
  resourceTileTaken: 7,
  pointsScored: 8,
  // Last, so the final kill/score lines play before the debrief.
  missionVictory: 9,
  missionDefeat: 9,
};

function occurrenceSortValue(o: DialogOccurrence): number {
  switch (o.type) {
    case "missionStart":
    case "missionVictory":
    case "missionDefeat":
      return 0;
    case "roundEnd":
    case "roundStart":
      return o.round;
    case "shipsDisabled":
    case "shipsDestroyed":
      return o.count;
    case "pointsScored":
      return o.points;
    case "reactorDamaged":
    case "shipsRetreated":
      return o.total;
    case "reactorOverloadWarning":
      return o.level * 100 + o.total;
    case "resourceTileTaken":
    case "shipsDamaged":
    case "shipsDisabledOnResource":
    case "shipsRepaired":
      return o.count;
  }
}

function compareOccurrences(a: DialogOccurrence, b: DialogOccurrence): number {
  // Round end/start interleave by round (end 2, start 3, end 3, start 4)
  // when several rounds pass between two snapshots.
  const aRound = a.type === "roundEnd" || a.type === "roundStart";
  const bRound = b.type === "roundEnd" || b.type === "roundStart";
  if (aRound && bRound) {
    const aKey = occurrenceSortValue(a) + (a.type === "roundEnd" ? 0.5 : 0);
    const bKey = occurrenceSortValue(b) + (b.type === "roundEnd" ? 0.5 : 0);
    return aKey - bKey;
  }
  return (
    OCCURRENCE_ORDER[a.type] - OCCURRENCE_ORDER[b.type] ||
    occurrenceSortValue(a) - occurrenceSortValue(b) ||
    occurrenceKey(a).localeCompare(occurrenceKey(b))
  );
}

function range(fromInclusive: number, toInclusive: number): number[] {
  const out: number[] = [];
  for (let i = fromInclusive; i <= toInclusive; i++) out.push(i);
  return out;
}

function shipsDestroyedFor(s: DialogSnapshot, side: DialogSide): number {
  return side === "player" ? s.myShipsDestroyed : s.enemyShipsDestroyed;
}

function shipsRetreatedFor(s: DialogSnapshot, side: DialogSide): number {
  return (side === "player" ? s.myShipsRetreated : s.enemyShipsRetreated) ?? 0;
}

function shipsDisabledFor(s: DialogSnapshot, side: DialogSide): number {
  return side === "player" ? s.myShipsDisabled : s.enemyShipsDisabled;
}

function reactorDamageFor(s: DialogSnapshot, side: DialogSide): number {
  return (side === "player" ? s.myReactorDamage : s.enemyReactorDamage) ?? 0;
}

function shipsAtReactorLevelFor(s: DialogSnapshot, side: DialogSide, level: number): number {
  const counts = side === "player" ? s.myShipsAtReactorLevel : s.enemyShipsAtReactorLevel;
  return counts?.[level] ?? 0;
}

function resourceTilesTakenFor(s: DialogSnapshot, side: DialogSide): number {
  return (side === "player" ? s.myResourceTilesTaken : s.enemyResourceTilesTaken) ?? 0;
}

function shipsDamagedFor(s: DialogSnapshot, side: DialogSide): number {
  return (side === "player" ? s.myShipsDamaged : s.enemyShipsDamaged) ?? 0;
}

function shipsDisabledOnResourceFor(s: DialogSnapshot, side: DialogSide): number {
  return (side === "player" ? s.myShipsDisabledOnResource : s.enemyShipsDisabledOnResource) ?? 0;
}

/** Repaired ships on `side` (or both), counting only fleets of `faction` when set (by `factions`' faction). */
function shipsRepairedFor(
  s: DialogSnapshot,
  side: DialogSide | undefined,
  faction: number | undefined,
  factions: DialogSnapshot,
): number {
  const count = (which: DialogSide) => {
    const fleet = which === "player" ? factions.myFleetFaction : factions.enemyFleetFaction;
    if (faction != null && fleet !== faction) return 0;
    return (which === "player" ? s.myShipsRepaired : s.enemyShipsRepaired) ?? 0;
  };
  return side ? count(side) : count("player") + count("enemy");
}

/** Whether a line's extra conditions hold (DialogCondition). */
export function conditionHolds(when: DialogCondition | undefined, s: DialogSnapshot): boolean {
  if (!when) return true;
  if (when.playerFaction != null && s.myFleetFaction !== when.playerFaction) return false;
  if (when.playerCanRepair != null && (s.myCanRepair ?? false) !== when.playerCanRepair) return false;
  return true;
}

function scoreFor(s: DialogSnapshot, side: DialogSide): number {
  return side === "player" ? s.myScore : s.enemyScore;
}

/**
 * The occurrences of `trigger` between `prev` and `next`. `prev` is null at
 * the very start of a mission. Thresholds fire only when crossed, so a
 * trigger never fires twice for the same transition.
 */
export function triggerOccurrences(
  trigger: DialogTrigger,
  prev: DialogSnapshot | null,
  next: DialogSnapshot,
): DialogOccurrence[] {
  switch (trigger.type) {
    case "missionStart":
      return prev === null ? [{ type: "missionStart" }] : [];
    case "roundStart": {
      const rounds = prev === null ? [next.round] : range(prev.round + 1, next.round);
      return rounds
        .filter((r) => trigger.round == null || trigger.round === r)
        .map((round) => ({ type: "roundStart", round }));
    }
    case "roundEnd": {
      if (prev === null) return [];
      return range(prev.round, next.round - 1)
        .filter((r) => trigger.round == null || trigger.round === r)
        .map((round) => ({ type: "roundEnd", round }));
    }
    case "shipsDisabled":
    case "shipsDestroyed": {
      const countFor = trigger.type === "shipsDisabled" ? shipsDisabledFor : shipsDestroyedFor;
      const before = prev ? countFor(prev, trigger.side) : 0;
      const after = countFor(next, trigger.side);
      return before < trigger.count && trigger.count <= after
        ? [{ type: trigger.type, side: trigger.side, count: trigger.count }]
        : [];
    }
    case "shipsDamaged":
    case "shipsDisabledOnResource": {
      const countFor = trigger.type === "shipsDamaged" ? shipsDamagedFor : shipsDisabledOnResourceFor;
      const before = prev ? countFor(prev, trigger.side) : 0;
      const after = countFor(next, trigger.side);
      return before < trigger.count && trigger.count <= after
        ? [{ type: trigger.type, side: trigger.side, count: trigger.count }]
        : [];
    }
    case "shipsRepaired": {
      // The fleets' factions don't change mid-game; judge both by `next`.
      const before = prev ? shipsRepairedFor(prev, trigger.side, trigger.faction, next) : 0;
      const after = shipsRepairedFor(next, trigger.side, trigger.faction, next);
      return before < trigger.count && trigger.count <= after
        ? [
            {
              type: "shipsRepaired",
              side: trigger.side ?? "any",
              faction: trigger.faction ?? null,
              count: trigger.count,
            },
          ]
        : [];
    }
    case "resourceTileTaken": {
      const before = prev ? resourceTilesTakenFor(prev, trigger.side) : 0;
      const after = resourceTilesTakenFor(next, trigger.side);
      return before < trigger.count && trigger.count <= after
        ? [{ type: "resourceTileTaken", side: trigger.side, count: trigger.count }]
        : [];
    }
    case "shipsRetreated": {
      const before = prev ? shipsRetreatedFor(prev, trigger.side) : 0;
      const after = shipsRetreatedFor(next, trigger.side);
      if (after <= before) return [];
      // With `count`: once, when the total reaches it. Without: every time
      // (one occurrence per update, however many ships left in it).
      if (trigger.count != null) {
        return before < trigger.count && trigger.count <= after
          ? [{ type: "shipsRetreated", side: trigger.side, total: trigger.count }]
          : [];
      }
      return [{ type: "shipsRetreated", side: trigger.side, total: after }];
    }
    case "reactorDamaged": {
      const before = prev ? reactorDamageFor(prev, trigger.side) : 0;
      const after = reactorDamageFor(next, trigger.side);
      if (after <= before) return [];
      // With `count`: once, when the total reaches it. Without: every rise
      // (one occurrence per update, however many levels it added).
      if (trigger.count != null) {
        return before < trigger.count && trigger.count <= after
          ? [{ type: "reactorDamaged", side: trigger.side, total: trigger.count }]
          : [];
      }
      return [{ type: "reactorDamaged", side: trigger.side, total: after }];
    }
    case "reactorOverloadWarning": {
      const before = prev ? shipsAtReactorLevelFor(prev, trigger.side, trigger.level) : 0;
      const after = shipsAtReactorLevelFor(next, trigger.side, trigger.level);
      if (after <= before) return [];
      // With `count`: once, when that many ships have reached the level.
      // Without: every time a new ship does (one occurrence per update).
      if (trigger.count != null) {
        return before < trigger.count && trigger.count <= after
          ? [{ type: "reactorOverloadWarning", side: trigger.side, level: trigger.level, total: trigger.count }]
          : [];
      }
      return [{ type: "reactorOverloadWarning", side: trigger.side, level: trigger.level, total: after }];
    }
    case "missionVictory":
    case "missionDefeat": {
      const outcome = trigger.type === "missionVictory" ? "victory" : "defeat";
      return (prev?.outcome ?? null) !== outcome && next.outcome === outcome
        ? [{ type: trigger.type }]
        : [];
    }
    case "pointsScored": {
      const before = prev ? scoreFor(prev, trigger.side) : 0;
      const after = scoreFor(next, trigger.side);
      return before < trigger.points && trigger.points <= after
        ? [{ type: "pointsScored", side: trigger.side, points: trigger.points }]
        : [];
    }
  }
}

export function isSameMission(a: DialogMission, b: DialogMission): boolean {
  if (a.kind === "tutorial" || b.kind === "tutorial") return a.kind === b.kind;
  return a.kind === b.kind && a.nodeId === b.nodeId;
}

function genericAppliesTo(line: GenericDialogLine, mission: DialogMission): boolean {
  if (mission.kind === "tutorial") return false;
  return (line.missionKinds ?? ["campaign", "roguelike"]).includes(mission.kind);
}

/** FNV-1a: a stable pick for a seed, so a reload doesn't reshuffle lines. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pick<T>(items: readonly T[], seed: string): T {
  return items[hashString(seed) % items.length];
}

/** A line ready to show. `key` is unique per line per occurrence. */
export interface DialogQueueItem {
  key: string;
  /** The occurrence that fired it (occurrenceKey, e.g. "missionStart"); shared by a line and its replies. */
  event: string;
  characterId: string;
  text: string;
  /** Shown in place of a required line that hasn't been written. */
  isError?: boolean;
  /** Set on a generic line with canHide: its id, for "Don't show again". */
  hideableLineId?: string;
}

/**
 * Mission kinds where every mission must have its own entry (missionStart)
 * line. When one is missing an error shows in its place instead of a generic
 * line, the same way a node with no title shows an error (useNodeContent.ts).
 */
const ENTRY_LINE_REQUIRED_KINDS: readonly DialogMission["kind"][] = ["roguelike"];

function missingEntryLineText(mission: DialogMission): string {
  const where = mission.kind === "tutorial" ? "the tutorial" : `${mission.kind} node #${mission.nodeId}`;
  return `Error: ${where} has no entry dialog line`;
}

/**
 * A line followed by its replies, as queue items. Replies get keys derived
 * from the line's (`<key>~r1`, `<key>~r2`, ...) so they're tracked with it.
 */
function withResponses(
  key: string,
  event: string,
  characterId: string,
  text: string,
  responses: readonly DialogResponse[] | undefined,
): DialogQueueItem[] {
  return [
    { key, event, characterId, text },
    ...(responses ?? []).map((response, i) => ({
      key: `${key}~r${i + 1}`,
      event,
      characterId: response.characterId,
      text: response.text,
    })),
  ];
}

/**
 * A won mission's written debrief (its missionVictory lines and their
 * replies), as the result screen played it. The run map's drawer shows it
 * for a cleared mission in place of the briefing. Empty when none is
 * written (generic victory lines vary, so there's nothing to replay).
 */
export function missionDebriefItems(
  mission: DialogMission,
  missionLines: readonly MissionDialogLine[] = MISSION_DIALOG_LINES,
): DialogQueueItem[] {
  return missionLines
    .filter((line) => line.trigger.type === "missionVictory" && isSameMission(line.mission, mission))
    .flatMap((line) => withResponses(line.id, "missionVictory", line.characterId, line.text, line.responses));
}

/**
 * Lines to show for what happened between `prev` and `next`, in event order.
 * For each occurrence, every matching mission line plays; if there are none,
 * one matching generic line plays with one of its variants (except a
 * required entry line, which shows an error instead). Keys already in
 * `firedKeys` are skipped.
 */
export function selectDialogLines({
  mission,
  gameId,
  prev,
  next,
  firedKeys,
  missionLines = MISSION_DIALOG_LINES,
  genericLines = GENERIC_DIALOG_LINES,
  hiddenGenericLineIds = new Set<string>(),
}: {
  mission: DialogMission;
  gameId: string;
  prev: DialogSnapshot | null;
  next: DialogSnapshot;
  firedKeys: ReadonlySet<string>;
  missionLines?: readonly MissionDialogLine[];
  genericLines?: readonly GenericDialogLine[];
  /** Generic lines the player chose not to see again (hiddenDialogLines.ts). */
  hiddenGenericLineIds?: ReadonlySet<string>;
}): DialogQueueItem[] {
  type Bucket = {
    occurrence: DialogOccurrence;
    missionLines: MissionDialogLine[];
    genericLines: GenericDialogLine[];
  };
  const buckets = new Map<string, Bucket>();
  const bucketFor = (occurrence: DialogOccurrence): Bucket => {
    const key = occurrenceKey(occurrence);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { occurrence, missionLines: [], genericLines: [] };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  for (const line of missionLines) {
    if (!isSameMission(line.mission, mission)) continue;
    if (!conditionHolds(line.when, next)) continue;
    for (const o of triggerOccurrences(line.trigger, prev, next)) {
      bucketFor(o).missionLines.push(line);
    }
  }
  for (const line of genericLines) {
    if (!genericAppliesTo(line, mission) || line.variants.length === 0) continue;
    if (line.canHide && hiddenGenericLineIds.has(line.id)) continue;
    if (!conditionHolds(line.when, next)) continue;
    for (const o of triggerOccurrences(line.trigger, prev, next)) {
      bucketFor(o).genericLines.push(line);
    }
  }

  const entryLineRequired = prev === null && ENTRY_LINE_REQUIRED_KINDS.includes(mission.kind);
  if (entryLineRequired) bucketFor({ type: "missionStart" });

  const items: DialogQueueItem[] = [];
  const ordered = [...buckets.values()].sort((a, b) =>
    compareOccurrences(a.occurrence, b.occurrence),
  );
  for (const bucket of ordered) {
    const occKey = occurrenceKey(bucket.occurrence);
    if (bucket.missionLines.length > 0) {
      for (const line of bucket.missionLines) {
        const key = `${line.id}@${occKey}`;
        if (firedKeys.has(key)) continue;
        items.push(...withResponses(key, occKey, line.characterId, line.text, line.responses));
      }
      continue;
    }
    if (entryLineRequired && bucket.occurrence.type === "missionStart") {
      const key = `missing-entry@${occKey}`;
      if (!firedKeys.has(key)) {
        items.push({
          key,
          event: occKey,
          characterId: "",
          text: missingEntryLineText(mission),
          isError: true,
        });
      }
      continue;
    }
    if (bucket.genericLines.length === 0) continue;
    const line = pick(bucket.genericLines, `${gameId}|${occKey}`);
    const key = `${line.id}@${occKey}`;
    if (firedKeys.has(key)) continue;
    const variant = pick(line.variants, `${gameId}|${line.id}|${occKey}`);
    const { text, responses } = typeof variant === "string" ? { text: variant, responses: undefined } : variant;
    const lineItems = withResponses(key, occKey, line.characterId, text, responses);
    // The checkbox goes on the line itself, not its replies.
    if (line.canHide) lineItems[0] = { ...lineItems[0], hideableLineId: line.id };
    items.push(...lineItems);
  }
  return items;
}
