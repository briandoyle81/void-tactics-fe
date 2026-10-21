"use client";

import React from "react";
import type { TileArtSlice } from "../utils/mapTileArt";

/** One cell's slice of map tile art, at the terrain layer (GameGridCell, MapDisplayView). */
export function TileArtSliceView({ slice }: { slice: TileArtSlice }) {
  return (
    <div
      role="img"
      aria-label={slice.alt}
      className="pointer-events-none absolute inset-0 z-[1]"
      style={slice.style}
    />
  );
}
