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
    67: [
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
    68: [
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
  },
  campaignNodes: {},
  roguelikeNodes: {
    // d01
    16: 68,
    // r01
    31: 67,
  },
};
