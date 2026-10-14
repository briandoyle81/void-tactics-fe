import type {
  ContractBlockedPositions,
  ContractScoringPositions,
} from "../../utils/mapGridUtils";

// Terrain for the website hero's battle preview (TacticalTargetingPreview):
// a snapshot of preset map 14, "Debris Ring — Sector 14", read from the
// Maps contract on Base Sepolia on 2026-10-13. Shipped with the site so the
// homepage needs no RPC calls. It doesn't follow later edits to map 14; to
// refresh it, re-read getPresetMap / getPresetScoringMap /
// getPresetMapImpassable(14) and paste the results here.

export const HERO_DEMO_MAP_ID = 14;

/** Line-of-sight blocking tiles (getPresetMap). */
export const HERO_DEMO_BLOCKED: ContractBlockedPositions = [
  { row: 0, col: 8 },
  { row: 1, col: 8 },
  { row: 2, col: 8 },
  { row: 3, col: 4 },
  { row: 3, col: 5 },
  { row: 3, col: 11 },
  { row: 3, col: 12 },
  { row: 6, col: 6 },
  { row: 6, col: 10 },
  { row: 7, col: 4 },
  { row: 7, col: 12 },
  { row: 10, col: 8 },
];

/** Resource tiles (getPresetScoringMap). */
export const HERO_DEMO_SCORING: ContractScoringPositions = [
  { row: 5, col: 8, points: 19, onlyOnce: false },
  { row: 1, col: 4, points: 10, onlyOnce: true },
  { row: 1, col: 12, points: 10, onlyOnce: true },
  { row: 9, col: 4, points: 10, onlyOnce: true },
  { row: 9, col: 12, points: 10, onlyOnce: true },
];

/** Movement-blocking tiles (getPresetMapImpassable). */
export const HERO_DEMO_IMPASSABLE: ContractBlockedPositions = [
  { row: 0, col: 8 },
  { row: 1, col: 8 },
  { row: 3, col: 4 },
  { row: 3, col: 12 },
  { row: 10, col: 8 },
];
