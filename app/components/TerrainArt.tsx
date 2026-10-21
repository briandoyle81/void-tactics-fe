"use client";

import React from "react";
import Image from "next/image";

/**
 * A tile's terrain images (app/utils/terrainEdges.ts), overlaid at full
 * opacity: nebula on layer 1, asteroids above it on layer 2.
 */
export function TerrainArt({
  pieces,
  layer,
  sizes,
}: {
  pieces: readonly string[];
  layer: 1 | 2;
  sizes?: string;
}) {
  if (pieces.length === 0) return null;
  return (
    <div className={`pointer-events-none absolute inset-0 ${layer === 1 ? "z-[1]" : "z-[2]"}`}>
      {pieces.map((src) => (
        <Image key={src} src={src} alt="" fill sizes={sizes} className="object-cover" />
      ))}
    </div>
  );
}
