// The card look from design pass G, shared by ShipCard and the Store's ship
// pack cards: a foil frame with cut corners around a near-black panel, and an
// art bay with stars, scanlines and a glow.

/** Cut corners for a card frame and its inner panel. */
export const CARD_CHAMFER =
  "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)";
/** Smaller cut corners, for a row or a compact card. */
export const ROW_CHAMFER =
  "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";
/** Cut corners for a badge or a button. */
export const BADGE_CHAMFER =
  "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)";
/** The smallest cut, for a chip or a tag. */
export const TAG_CHAMFER =
  "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)";

/** The frame's foil in a rank color: light, dark, and back, so it catches the light. */
export function rankFrameFill(color: string): string {
  return `linear-gradient(150deg, color-mix(in srgb, ${color} 70%, white), color-mix(in srgb, ${color} 55%, black) 50%, ${color})`;
}

/** A few stars for the art bay's background. */
export const BAY_STARS =
  "radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,0.55), transparent 60%)," +
  "radial-gradient(1px 1px at 78% 14%, rgba(255,255,255,0.45), transparent 60%)," +
  "radial-gradient(1px 1px at 64% 72%, rgba(255,255,255,0.35), transparent 60%)," +
  "radial-gradient(1.5px 1.5px at 30% 80%, rgba(255,255,255,0.4), transparent 60%)," +
  "radial-gradient(1px 1px at 90% 58%, rgba(255,255,255,0.5), transparent 60%)," +
  "radial-gradient(1px 1px at 45% 10%, rgba(255,255,255,0.35), transparent 60%)";

/** The art bay's scanlines, drawn over its background. */
export const BAY_SCANLINES =
  "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)";

/** The art bay's background: stars and a glow in the given color. */
export function bayBackground(glow: string): string {
  return `${BAY_STARS}, radial-gradient(ellipse 70% 60% at 50% 55%, ${glow}, transparent 70%), linear-gradient(180deg, #111a24, var(--color-near-black))`;
}
