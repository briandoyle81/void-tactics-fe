// Map art that replaces tiles on specific maps. Edited by hand, like
// mapNames.ts.
//
// - `maps`: the art on each map, by map id (same ids as mapNames.ts; web2's
//   ids match). Each piece is one image covering a whole-tile rectangle:
//   top-left `row`, `col` and its size in tiles. `blocked` / `impassable`
//   say what every tile under it must be. If a map edit changes those
//   tiles, the art isn't drawn and the map's admin card lists the mismatch
//   (app/utils/mapTileArt.ts).
// - `campaignNodes` / `roguelikeNodes`: node id -> the map id it's fought
//   on, for nodes whose map has art. Web3 battles know their node but not
//   their map (the Game contract doesn't store the map id), so this saves a
//   chain read. If a node moves to another map, update its entry here.
//
// Images live in public/img/.

import type { MapTileArtContent } from "../../utils/mapTileArt";

export const MAP_TILE_ART: MapTileArtContent = {
  maps: {
    // Repair Facility DS7
    62: [
      {
        src: "/img/repair-station-tile.png",
        alt: "Repair station",
        row: 4,
        col: 12,
        rows: 3,
        cols: 3,
        blocked: true,
        impassable: true,
      },
    ],
    // New Scapa Shipyard
    61: [
      {
        src: "/img/space-dock-tile.png",
        alt: "Space dock",
        row: 4,
        col: 12,
        rows: 3,
        cols: 3,
        blocked: true,
        impassable: true,
      },
    ],
    // Demolished Mining Outpost
    63: [
      {
        src: "/img/broken-mining-station.svg",
        alt: "Broken mining station",
        row: 4,
        col: 12,
        rows: 3,
        cols: 3,
        blocked: true,
        impassable: true,
      },
    ],
    // The Hive: Dominance (5x5, top right)
    65: [
      {
        src: "/img/hive.svg",
        alt: "The Hive",
        row: 0,
        col: 12,
        rows: 5,
        cols: 5,
        blocked: true,
        impassable: true,
      },
    ],
    // The Hive: Alliance, Dominance flipped left to right (5x5, top left)
    66: [
      {
        src: "/img/hive-flipped.svg",
        alt: "The Hive",
        row: 0,
        col: 0,
        rows: 5,
        cols: 5,
        blocked: true,
        impassable: true,
      },
    ],
  },
  campaignNodes: {},
  roguelikeNodes: {
    // d01 Sneak Attack
    16: 61,
    // m09 Interception (Demolished Mining Outpost)
    9: 63,
    // m11 The Hive: Dominance
    11: 65,
    // m15 The Hive: Alliance
    15: 66,
    // r01 Repair Station DS7
    31: 62,
  },
};
