// The AI fleet constructor's model (Ops Console › AI Fleet): the library of
// AI ship configs as a working list the admin edits locally, saves as JSON,
// loads from JSON, and writes to the AIEncounters contract (web3) or the
// AIShipConfig rows (web2). Number-native; each mode converts at its adapter
// (AIFleetConstructor / AIFleetConstructorWeb2).

import { Archetype } from "../types/types";
import type { AIShipConfigWeb2 } from "./aiShipConfigWeb2";

export interface AIFleetColors {
  h1: number;
  s1: number;
  l1: number;
  h2: number;
  s2: number;
  l2: number;
}

export interface AIFleetShip {
  /** Local identity in the working list (stable across edits). */
  key: string;
  /** The saved config this ship is (chain or DB id), or null for a new one. */
  configId: number | null;
  name: string;
  equipment: { mainWeapon: number; armor: number; shields: number; special: number };
  traits: {
    serialNumber: number;
    colors: AIFleetColors;
    variant: number;
    accuracy: number;
    hull: number;
    speed: number;
  };
  archetype: Archetype;
  /** Every ship made from this config is shiny. */
  shiny: boolean;
  /** Kills each ship made from it starts with, which set its rank (a uint32 on chain). */
  shipsDestroyed: number;
}

/** Highest kill count a config can hold (AIEncounters.MAX_AI_KILLS; web2 uses the same cap). */
export const AI_FLEET_MAX_KILLS = 1_000_000;

/** A ship as saved: the working copy without its local key. */
export type AIFleetShipData = Omit<AIFleetShip, "key">;

export const AI_FLEET_FILE_FORMAT = "void-tactics-ai-fleet";
export const AI_FLEET_FILE_VERSION = 1;

export interface AIFleetFile {
  format: typeof AI_FLEET_FILE_FORMAT;
  version: number;
  ships: AIFleetShipData[];
}

export const DEFAULT_AI_FLEET_COLORS: AIFleetColors = {
  h1: 220,
  s1: 10,
  l1: 20,
  h2: 35,
  s2: 70,
  l2: 50,
};

let nextKey = 1;
export function newAIFleetKey(): string {
  return `ship-${Date.now().toString(36)}-${nextKey++}`;
}

export function newAIFleetShip(): AIFleetShip {
  return {
    key: newAIFleetKey(),
    configId: null,
    name: "",
    equipment: { mainWeapon: 0, armor: 0, shields: 0, special: 0 },
    traits: {
      serialNumber: 0,
      colors: { ...DEFAULT_AI_FLEET_COLORS },
      variant: 1,
      accuracy: 1,
      hull: 1,
      speed: 1,
    },
    archetype: Archetype.Grunt,
    shiny: false,
    shipsDestroyed: 0,
  };
}

export function withKey(data: AIFleetShipData): AIFleetShip {
  return { ...data, key: newAIFleetKey() };
}

export function stripKey(ship: AIFleetShip | AIFleetShipData): AIFleetShipData {
  const data: AIFleetShipData & { key?: string } = { ...ship };
  delete data.key;
  return data;
}

/** A ship's saved fields in a fixed order, whatever order its source used. */
export function canonicalAIFleetShip(ship: AIFleetShipData): AIFleetShipData {
  const { equipment: e, traits: t } = ship;
  const c = t.colors;
  return {
    configId: ship.configId,
    name: ship.name,
    equipment: { mainWeapon: e.mainWeapon, armor: e.armor, shields: e.shields, special: e.special },
    traits: {
      serialNumber: t.serialNumber,
      colors: { h1: c.h1, s1: c.s1, l1: c.l1, h2: c.h2, s2: c.s2, l2: c.l2 },
      variant: t.variant,
      accuracy: t.accuracy,
      hull: t.hull,
      speed: t.speed,
    },
    archetype: ship.archetype,
    shiny: ship.shiny,
    shipsDestroyed: ship.shipsDestroyed,
  };
}

function comparable(ship: AIFleetShipData): string {
  return JSON.stringify(canonicalAIFleetShip(ship));
}

/** A saved ship's working copy differs from it (what Write would update). */
export function aiFleetShipChanged(
  ship: AIFleetShip,
  saved: AIFleetShipData | undefined,
): boolean {
  if (!saved) return true;
  return comparable(stripKey(ship)) !== comparable(saved);
}

export type AIFleetShipStatus = "new" | "changed" | "saved";

export function aiFleetShipStatus(
  ship: AIFleetShip,
  savedById: ReadonlyMap<number, AIFleetShipData>,
): AIFleetShipStatus {
  if (ship.configId == null || !savedById.has(ship.configId)) return "new";
  return aiFleetShipChanged(ship, savedById.get(ship.configId)) ? "changed" : "saved";
}

/** What Write would do: create the new ships, update the changed ones. */
export function aiFleetPendingWrites(
  ships: readonly AIFleetShip[],
  savedById: ReadonlyMap<number, AIFleetShipData>,
): { creates: AIFleetShip[]; updates: AIFleetShip[] } {
  const creates: AIFleetShip[] = [];
  const updates: AIFleetShip[] = [];
  for (const ship of ships) {
    const status = aiFleetShipStatus(ship, savedById);
    if (status === "new") creates.push(ship);
    else if (status === "changed") updates.push(ship);
  }
  return { creates, updates };
}

export function aiFleetToFile(ships: readonly AIFleetShip[]): AIFleetFile {
  return {
    format: AI_FLEET_FILE_FORMAT,
    version: AI_FLEET_FILE_VERSION,
    ships: ships.map((s) => canonicalAIFleetShip(stripKey(s))),
  };
}

// ---- Reading a file -----------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function int(where: string, v: unknown, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw new Error(`${where} must be a whole number from ${min} to ${max}`);
  }
  return v;
}

function bool(where: string, v: unknown): boolean {
  if (typeof v !== "boolean") throw new Error(`${where} must be true or false`);
  return v;
}

const ARCHETYPE_MAX = Math.max(...Object.values(Archetype).filter((v): v is number => typeof v === "number"));

function parseShip(raw: unknown, i: number): AIFleetShipData {
  const at = `Ship ${i + 1}`;
  if (!isRecord(raw)) throw new Error(`${at} is not an object`);
  const { equipment, traits } = raw;
  if (!isRecord(equipment)) throw new Error(`${at}: equipment is missing`);
  if (!isRecord(traits)) throw new Error(`${at}: traits are missing`);
  const colorsRaw = isRecord(traits.colors) ? traits.colors : {};
  const colors = { ...DEFAULT_AI_FLEET_COLORS };
  for (const k of Object.keys(colors) as (keyof AIFleetColors)[]) {
    if (colorsRaw[k] !== undefined) colors[k] = int(`${at}: colors.${k}`, colorsRaw[k], 0, k.startsWith("h") ? 360 : 100);
  }
  const configId = raw.configId;
  return {
    configId: configId == null ? null : int(`${at}: configId`, configId, 0, Number.MAX_SAFE_INTEGER),
    name: typeof raw.name === "string" ? raw.name : "",
    equipment: {
      mainWeapon: int(`${at}: mainWeapon`, equipment.mainWeapon, 0, 255),
      armor: int(`${at}: armor`, equipment.armor, 0, 255),
      shields: int(`${at}: shields`, equipment.shields, 0, 255),
      special: int(`${at}: special`, equipment.special, 0, 255),
    },
    traits: {
      serialNumber:
        traits.serialNumber == null ? 0 : int(`${at}: serialNumber`, traits.serialNumber, 0, Number.MAX_SAFE_INTEGER),
      colors,
      variant: int(`${at}: variant`, traits.variant, 0, 255),
      accuracy: int(`${at}: accuracy`, traits.accuracy, 0, 255),
      hull: int(`${at}: hull`, traits.hull, 0, 255),
      speed: int(`${at}: speed`, traits.speed, 0, 255),
    },
    archetype: int(`${at}: archetype`, raw.archetype, 0, ARCHETYPE_MAX) as Archetype,
    // Optional: files saved before ships had them are plain, unranked ships.
    shiny: raw.shiny == null ? false : bool(`${at}: shiny`, raw.shiny),
    shipsDestroyed: raw.shipsDestroyed == null ? 0 : int(`${at}: shipsDestroyed`, raw.shipsDestroyed, 0, AI_FLEET_MAX_KILLS),
  };
}

/** Parses a saved fleet file; throws an Error saying what's wrong. */
export function parseAIFleetFile(text: string): AIFleetShipData[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The file isn't valid JSON");
  }
  if (!isRecord(data) || data.format !== AI_FLEET_FILE_FORMAT) {
    throw new Error("This isn't an AI fleet file (downloaded from Ops Console › AI Fleet)");
  }
  if (typeof data.version !== "number" || data.version > AI_FLEET_FILE_VERSION) {
    throw new Error("This AI fleet file is from a newer version of the tool");
  }
  if (!Array.isArray(data.ships)) throw new Error("The file has no ships list");
  return data.ships.map(parseShip);
}

// ---- Web2 adapter -------------------------------------------------------

export function aiFleetShipFromWeb2(c: AIShipConfigWeb2): AIFleetShipData {
  return {
    configId: c.id,
    name: c.name,
    equipment: { ...c.equipment },
    traits: { ...c.traits, colors: { ...c.traits.colors } },
    archetype: c.archetype,
    shiny: c.shiny ?? false,
    shipsDestroyed: c.shipsDestroyed ?? 0,
  };
}

/** The web2 config shape for a ship (an id of 0 for one not saved yet). */
export function aiFleetShipToWeb2(ship: AIFleetShipData): AIShipConfigWeb2 {
  return {
    id: ship.configId ?? 0,
    name: ship.name,
    equipment: { ...ship.equipment },
    traits: { ...ship.traits, colors: { ...ship.traits.colors } },
    archetype: ship.archetype,
    shiny: ship.shiny,
    shipsDestroyed: ship.shipsDestroyed,
  };
}
