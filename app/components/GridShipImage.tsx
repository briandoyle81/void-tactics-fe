import React, { useEffect, useMemo } from "react";
import { destroyedShipImage, unconstructedShipImage } from "../utils/shipRenderer/stateArt";
import { renderGridShipImageSync, useGridShipRenderer } from "../hooks/useGridShipRenderer";
import { hasDroneArt, withoutSpecialArt } from "./weapon-animations/droneArt";
import { GridShip } from "../types/gridDisplay";
import { calculateShipRank } from "../utils/shipLevel";
import { SHIP_IMAGE_RANK_STAR_BOX, SHIP_IMAGE_RANK_STAR_BOX_LARGE } from "./ShipImage";

// Shared ship-image renderer for the unified game grid — same presentation
// as `ShipImage`/`ShipImageWeb2`, backed by `useGridShipRenderer` and typed
// on `GridShip` so one component serves both modes inside `GameGridCell`/
// `RetreatPrepAnimation`. See app/types/gridDisplay.ts.

interface GridShipImageProps {
  ship: GridShip;
  className?: string;
  showLoadingState?: boolean;
  style?: React.CSSProperties;
  rankStarsSize?: "default" | "large";
  hideRankStars?: boolean;
  /**
   * Draw it without its drones (they're out flying, drawn by the drone
   * effect: droneArt.ts). Passed (true or false) by the places that can hide
   * them, which keeps the drone-less image ready so the swap never flashes.
   */
  hideSpecialArt?: boolean;
}

export function GridShipImage({
  ship,
  className = "",
  showLoadingState = true,
  style,
  rankStarsSize = "default",
  hideRankStars = false,
  hideSpecialArt,
}: GridShipImageProps) {
  const { dataUrl: fullUrl, isLoading, error } = useGridShipRenderer(ship);
  // The ship without its drones, rendered ahead (and decoded) wherever they can be hidden.
  const canHide = hideSpecialArt !== undefined && hasDroneArt(ship);
  const plainUrl = useMemo(() => (canHide ? renderGridShipImageSync(withoutSpecialArt(ship)) : null), [canHide, ship]);
  useEffect(() => {
    if (!plainUrl) return;
    const img = new Image();
    img.src = plainUrl;
    void img.decode?.().catch(() => {});
  }, [plainUrl]);
  const dataUrl = hideSpecialArt && plainUrl ? plainUrl : fullUrl;

  const rankStarBox =
    rankStarsSize === "large"
      ? SHIP_IMAGE_RANK_STAR_BOX_LARGE
      : SHIP_IMAGE_RANK_STAR_BOX;

  const isDestroyed = ship.shipData.timestampDestroyed > 0;
  const isNotConstructed = !ship.shipData.constructed;

  const rankStarsOverlay =
    ship.shipData.constructed && !hideRankStars ? (
      <div
        className="ship-rank-stars pointer-events-none absolute right-[2.5%] top-[5%] z-10 leading-none text-amber"
        style={{
          fontSize: rankStarBox,
        }}
      >
        {Array.from({ length: calculateShipRank(ship).rank }, (_, i) => (
          <span key={i}>⭐</span>
        ))}
      </div>
    ) : null;

  if (isDestroyed) {
    return (
      <div
        className={`relative min-h-0 [container-type:size] ${className}`}
        style={style}
      >
        <img
          src={destroyedShipImage(ship.traits.variant)}
          alt={`Destroyed Ship #${ship.id}`}
          className="h-full w-full object-contain"
        />
        {rankStarsOverlay}
      </div>
    );
  }

  if (isNotConstructed) {
    return (
      <div
        className={`relative min-h-0 [container-type:size] ${className}`}
        style={style}
      >
        <img
          src={unconstructedShipImage(ship.traits.variant)}
          alt={`Unconstructed Ship #${ship.id}`}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  if (isLoading && showLoadingState && !dataUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-steel/50 border border-gunmetal rounded-none ${className}`}
      >
        <div className="text-text-muted text-xs text-center p-2 font-mono tracking-widest animate-pulse">
          &gt;&gt;
          {error && <div className="text-amber text-xs mt-1">{error}</div>}
        </div>
      </div>
    );
  }

  if ((error || !dataUrl) && !dataUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-steel/50 border border-gunmetal rounded-none ${className}`}
      >
        <div className="text-text-muted text-xs text-center p-2 font-mono tracking-widest animate-pulse">
          &gt;&gt;
          {error && <div className="text-amber text-xs mt-1">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative min-h-0 [container-type:size] ${className}`}
      style={style}
    >
      <img
        src={dataUrl}
        alt={`Ship #${ship.id}`}
        className="h-full w-full object-contain"
        onError={(e) => {
          console.error("Failed to load ship image:", e);
        }}
      />
      {rankStarsOverlay}
    </div>
  );
}
