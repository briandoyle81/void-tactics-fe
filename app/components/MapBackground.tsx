"use client";

import React from "react";
import Image from "next/image";

/**
 * A map's background image (app/utils/mapBackground.ts), under the grid's
 * cells. Put it inside the grid element (a positioned stacking context);
 * the cells above it must have no solid fill.
 */
export function MapBackground({ src }: { src: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <Image src={src} alt="" fill sizes="100vw" className="object-cover" />
    </div>
  );
}
