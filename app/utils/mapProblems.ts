// Problems worth flagging on a map's admin card (shown opposite the tile key
// in MapPreviewCard). Maps are never hidden from the admin tools, so a map
// that's a leftover duplicate or isn't wired up yet says so here instead.
// Shared by Maps.tsx (web3) and MapsWeb2.tsx (web2); number-native, pure.

import { MapMode } from "../types/types";
import { mapTileArtProblems } from "./mapTileArt";

type Pos = { row: number | bigint; col: number | bigint };

export interface MapProblemInput {
  id: number;
  mode: MapMode | undefined;
  blockedPositions: readonly Pos[];
  impassablePositions?: readonly Pos[];
  scoringPositions: readonly (Pos & { points: number | bigint; onlyOnce: boolean })[];
}

export interface MapUsage {
  /** Enemy ships placed on each map. */
  fleetSizeByMapId: ReadonlyMap<number, number>;
  /** Campaign and roguelike combat nodes fought on each map. */
  missionCountByMapId: ReadonlyMap<number, number>;
}

const tiles = (ps: readonly Pos[]) =>
  ps
    .map((p) => `${Number(p.row)},${Number(p.col)}`)
    .sort()
    .join(" ");

/** The map's terrain as one string: blocked, impassable and scoring tiles. */
function terrainSignature(m: MapProblemInput): string {
  const scoring = m.scoringPositions
    .map((p) => `${Number(p.row)},${Number(p.col)}:${Number(p.points)}${p.onlyOnce ? "!" : ""}`)
    .sort()
    .join(" ");
  return `${tiles(m.blockedPositions)}|${tiles(m.impassablePositions ?? [])}|${scoring}`;
}

/**
 * Each map's problems, by map id (maps with none are absent):
 * - same terrain as another map (a likely duplicate)
 * - a PvE map with no enemy fleet, or that no mission uses (with `usage`)
 * - a mission fought on a map with no enemy fleet (with `usage`)
 * - tile art (app/data/content/mapTileArt.ts) that doesn't fit the map's tiles
 */
export function mapProblems(maps: readonly MapProblemInput[], usage?: MapUsage): Map<number, string[]> {
  const bySignature = new Map<string, number[]>();
  maps.forEach((m) => {
    const sig = terrainSignature(m);
    bySignature.set(sig, [...(bySignature.get(sig) ?? []), m.id]);
  });

  const out = new Map<number, string[]>();
  for (const m of maps) {
    const problems: string[] = [];
    const twins = (bySignature.get(terrainSignature(m)) ?? []).filter((id) => id !== m.id);
    if (twins.length > 0) {
      problems.push(`Same terrain as map${twins.length > 1 ? "s" : ""} ${twins.map((id) => `#${id}`).join(", ")}`);
    }
    // Impassable tiles load separately on web3: don't flag art until they're in.
    if (m.impassablePositions) {
      problems.push(...mapTileArtProblems(m.id, m.blockedPositions, m.impassablePositions));
    }
    if (usage) {
      const fleet = usage.fleetSizeByMapId.get(m.id) ?? 0;
      const missions = usage.missionCountByMapId.get(m.id) ?? 0;
      if (fleet === 0 && missions > 0) {
        problems.push(`${missions} mission${missions === 1 ? "" : "s"} fought here, but no enemy fleet`);
      } else if (m.mode === MapMode.PvE) {
        if (fleet === 0) problems.push("No enemy fleet");
        if (missions === 0) problems.push("No mission uses it");
      }
    }
    if (problems.length > 0) out.set(m.id, problems);
  }
  return out;
}
