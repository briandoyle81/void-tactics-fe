// Destroyed and unconstructed ships: each variant's own art, the same SVGs
// ImageRenderer.sol / ImageRendererV2.sol serve on chain since the
// 2026-10-17 redeploy (RenderExplosion* / RenderUnconstructed* leaves; see
// docs/frontend-handoff-2026-10-17.md §3). Static files in public/img/ships
// rather than inlined, since they're 34-71 KB each. Used by the local
// renderer (renderShip) and the ship image views.

/** Variant 2 has its own art; anything else (variant 1, web2's rolls) uses variant 1's. */
function artVariant(variant: number | bigint | undefined): 1 | 2 {
  return Number(variant) === 2 ? 2 : 1;
}

export function destroyedShipImage(variant: number | bigint | undefined): string {
  return `/img/ships/destroyed-v${artVariant(variant)}.svg`;
}

export function unconstructedShipImage(variant: number | bigint | undefined): string {
  return `/img/ships/unconstructed-v${artVariant(variant)}.svg`;
}
