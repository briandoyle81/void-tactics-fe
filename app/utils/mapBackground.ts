// The background image drawn under a map's grid (public/img/grid-backgrounds/).
// Picked from the map's own tiles, so every board showing the same map
// (battles web3 and web2, fleet placement, the map editor's game view)
// shows the same image with no map id or chain read: web3 battles don't
// know their map id (see app/data/content/mapTileArt.ts). Maps with the
// same tiles share an image. Pure.

export const MAP_BACKGROUNDS = [
  "/img/grid-backgrounds/generic-bg-1.png",
  "/img/grid-backgrounds/generic-bg-2.png",
  "/img/grid-backgrounds/generic-bg-3.png",
  "/img/grid-backgrounds/generic-bg-4.png",
] as const;

type Grid<T> = readonly (readonly T[])[];

/** FNV-1a over every tile's terrain, then mixed. */
function terrainHash(
  blockedGrid: Grid<boolean>,
  scoringGrid: Grid<number>,
  onlyOnceGrid: Grid<boolean>,
  impassableGrid: Grid<boolean> | undefined,
): number {
  let h = 0x811c9dc5;
  blockedGrid.forEach((row, r) =>
    row.forEach((blocked, c) => {
      const tile =
        (blocked ? 1 : 0) |
        (impassableGrid?.[r]?.[c] ? 2 : 0) |
        (onlyOnceGrid[r]?.[c] ? 4 : 0) |
        ((scoringGrid[r]?.[c] ?? 0) << 3);
      h = Math.imul(h ^ tile, 0x01000193) >>> 0;
    }),
  );
  // FNV's low bits barely vary; mix (murmur3 fmix32) before taking % n.
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function mapBackgroundFor(
  blockedGrid: Grid<boolean>,
  scoringGrid: Grid<number>,
  onlyOnceGrid: Grid<boolean>,
  impassableGrid?: Grid<boolean>,
): string {
  return MAP_BACKGROUNDS[terrainHash(blockedGrid, scoringGrid, onlyOnceGrid, impassableGrid) % MAP_BACKGROUNDS.length];
}
