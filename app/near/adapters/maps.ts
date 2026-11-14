/**
 * NEAR maps: tiles are 187-bit bitmaps (three u64 words, bit index
 * row * 17 + col, vt-core/grid.rs), scoring tiles a list. These convert
 * them to and from the app's position lists.
 */
import { MapMode } from "../../types/types";
import type { Bitmap, MapMode as NearMapMode, PresetMap as NearPresetMap, ScoringPosition } from "../generated/voidTactics";
import { viewGame } from "../rpc";
import { fetchAllPages } from "../useNearView";

export const GRID_WIDTH = 17;
export const GRID_HEIGHT = 11;
const ONE = BigInt(1);
const ZERO = BigInt(0);

export interface MapPos {
  row: number;
  col: number;
}

export interface AppScoringPosition extends MapPos {
  points: number;
  onlyOnce: boolean;
}

/** A preset map with every tile list decoded. */
export interface DecodedPresetMap {
  id: number;
  mode: MapMode;
  blockedPositions: MapPos[];
  impassablePositions: MapPos[];
  scoringPositions: AppScoringPosition[];
  creatorZone: MapPos[];
  joinerZone: MapPos[];
}

export function bitmapToPositions(bitmap: Bitmap | ReadonlyArray<number | string> | undefined): MapPos[] {
  const out: MapPos[] = [];
  const words = (bitmap ?? []) as ReadonlyArray<number | string>;
  for (let w = 0; w < words.length; w++) {
    let word = BigInt(words[w] ?? 0);
    let bit = 0;
    while (word > ZERO) {
      if ((word & ONE) === ONE) {
        const idx = w * 64 + bit;
        out.push({ row: Math.floor(idx / GRID_WIDTH), col: idx % GRID_WIDTH });
      }
      word >>= ONE;
      bit++;
    }
  }
  return out;
}

/** Positions -> the contract's Bitmap (u64 words as decimal strings, safe for any bit). */
export function positionsToBitmap(positions: readonly MapPos[]): string[] {
  const words = [ZERO, ZERO, ZERO];
  for (const p of positions) {
    if (p.row < 0 || p.row >= GRID_HEIGHT || p.col < 0 || p.col >= GRID_WIDTH) continue;
    const idx = p.row * GRID_WIDTH + p.col;
    words[Math.floor(idx / 64)] |= ONE << BigInt(idx % 64);
  }
  return words.map((w) => w.toString());
}

export function toScoringPositions(list: readonly ScoringPosition[] | undefined): AppScoringPosition[] {
  return (list ?? []).map((s) => ({ row: s.row, col: s.col, points: s.points, onlyOnce: s.only_once }));
}

export function fromScoringPositions(list: readonly AppScoringPosition[]): ScoringPosition[] {
  return list.map((s) => ({ row: s.row, col: s.col, points: s.points, only_once: s.onlyOnce }));
}

export function toMapMode(m: NearMapMode): MapMode {
  return m === "PvE" ? MapMode.PvE : m === "Both" ? MapMode.Both : MapMode.PvP;
}

export function fromMapMode(m: MapMode | number): NearMapMode {
  return m === MapMode.PvE ? "PvE" : m === MapMode.Both ? "Both" : "PvP";
}

export function decodePresetMap(id: number, m: NearPresetMap): DecodedPresetMap {
  return {
    id,
    mode: toMapMode(m.mode),
    blockedPositions: bitmapToPositions(m.blocked),
    impassablePositions: bitmapToPositions(m.impassable),
    scoringPositions: toScoringPositions(m.scoring),
    creatorZone: bitmapToPositions(m.creator_zone),
    joinerZone: bitmapToPositions(m.joiner_zone),
  };
}

export async function fetchPresetMap(id: number): Promise<DecodedPresetMap | null> {
  const m = await viewGame("get_preset_map", { map_id: String(id) });
  return m ? decodePresetMap(id, m) : null;
}

/** Every preset map (ids 1..get_map_count). */
export async function fetchAllPresetMaps(): Promise<DecodedPresetMap[]> {
  const pairs = await fetchAllPages(
    (from, limit) => viewGame("get_preset_maps", { from_index: from, limit }),
    100,
  );
  return pairs.map(([id, m]) => decodePresetMap(Number(id), m));
}
