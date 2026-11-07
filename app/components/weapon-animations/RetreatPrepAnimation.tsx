"use client";

import React, { useEffect, useRef } from "react";
import { RETREAT_GLOW_BUILD_MS } from "../../constants/animationTiming";
import { GridShip } from "../../types/gridDisplay";
import { GridShipImage } from "../GridShipImage";
import { SosHullFires } from "../SosHullFires";

interface RetreatPrepAnimationProps {
  ship: GridShip;
  /** True if ship belongs to creator, false if joiner. Retreat flip: creator = native (no flip), joiner = opposite of native (flip). */
  isCreator: boolean;
  /** A disabled ship (0 HP, the only kind that retreats): drawn tilted with its hull fires, as its cell draws it. */
  disabled?: boolean;
  /** Same outline as selected ship: ring-2 ring-blue-400 (current player) or ring-2 ring-purple-400 (opponent). */
  selectionOutlineClassName?: string;
}

// The engine plume off the stern (the art faces left, its engines at 92%
// across, 48% down), as RetreatAnimation draws it: a soft cyan streak with a
// white-hot core and a glow at the nozzle. Sizes are fractions of the cell.
const PLUME_LAYERS: Array<{ height: string; color: string }> = [
  { height: "20%", color: "rgba(130, 215, 255, 0.3)" },
  { height: "8%", color: "rgba(130, 215, 255, 0.75)" },
  { height: "3%", color: "rgba(255, 250, 240, 0.9)" },
];

/**
 * Shown in-cell when the player selects Retreat: the ship turns to face its
 * starting side and its engine plume powers up and pulses. Solid, not a
 * hologram: the retreat plays as the ship itself turning and powering up,
 * through to RetreatAnimation's jump.
 */
export const RetreatPrepAnimation = React.memo(function RetreatPrepAnimation({
  ship,
  isCreator,
  disabled = false,
  selectionOutlineClassName = "ring-2 ring-blue-400",
}: RetreatPrepAnimationProps) {
  // Opacity ramps through the DOM, not React state: a per-frame setState
  // re-rendered this cell (and its ship image) for the whole build-up.
  const glowRef = useRef<HTMLDivElement | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    startTimeRef.current = performance.now();
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const elapsed = performance.now() - (startTimeRef.current ?? 0);
      const t = Math.min(1, elapsed / RETREAT_GLOW_BUILD_MS);
      if (glowRef.current) glowRef.current.style.opacity = String(t * 0.95);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // In game: creator ships have scale-x-[-1], joiner have no flip. When retreating we want opposite of in-game.
  // Creator retreating = native NFT position = no flip. Joiner retreating = opposite of native = flip.
  const shipFlipForRetreat = isCreator ? "scaleX(1)" : "scaleX(-1)";

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center pointer-events-none z-20 rounded-sm ${selectionOutlineClassName}`}
    >
      <div className="relative h-full w-full" style={{ transform: disabled ? "rotate(15deg)" : undefined }}>
        {/* Ship art, its plume and its fires, mirrored together: creator = native (no flip), joiner = flip. */}
        <div className="relative h-full w-full" style={{ transform: shipFlipForRetreat }}>
          <div
            ref={glowRef}
            className="absolute pointer-events-none animate-thrust-pulse"
            style={{ left: "92%", top: "48%", width: "60%", height: "100%", marginTop: "-50%", opacity: 0, transformOrigin: "0 50%" }}
          >
            {PLUME_LAYERS.map((layer) => (
              <div
                key={layer.height}
                className="absolute left-0 rounded-full"
                style={{
                  top: "50%",
                  width: "100%",
                  height: layer.height,
                  transform: "translateY(-50%)",
                  background: `linear-gradient(90deg, ${layer.color}, transparent)`,
                }}
              />
            ))}
            <div
              className="absolute rounded-full"
              style={{
                left: 0,
                top: "50%",
                width: "40%",
                height: "24%",
                transform: "translate(-50%, -50%)",
                background:
                  "radial-gradient(closest-side, rgba(255, 250, 240, 0.8), rgba(130, 215, 255, 0.5) 40%, transparent)",
              }}
            />
          </div>
          <GridShipImage ship={ship} className="relative w-full h-full object-contain" showLoadingState={false} />
          {disabled && <SosHullFires shipId={ship.id} failing />}
        </div>
      </div>
    </div>
  );
});
