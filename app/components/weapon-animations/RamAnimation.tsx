"use client";

import React, { useEffect, useLayoutEffect, useState } from "react";
import { GridShip } from "../../types/gridDisplay";
import { GridShipImage } from "../GridShipImage";
import { playSoundEffect } from "../../hooks/useSoundEffects";
import { cellCenterOnGrid, gridLayoutSize } from "./gridLayout";

// Last-move effect for a Ram (variant 1's FactionAbility): the rammer's
// charge streaks from where it started to the victim's tile, a flash and
// sparks mark the impact, and the victim tumbles off the board away from
// the rammer (it fled, it wasn't destroyed). The rammer itself is drawn by
// its grid cell, which already shows it on the victim's tile (see
// ramLastMove.ts). Loops while the last move is on screen, like the shot
// effects; the crash sound and a board shake happen once per ram
// (remembered for the browser session, so a refresh doesn't replay them).
// Keyframes are in globals.css (ram-*); prefers-reduced-motion leaves only
// the flash.

const CYCLE_MS = 2400;
const PLAYED_KEY = "vt-ram-played-v1";
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function takeFirstPlay(playKey: string): boolean {
  try {
    const played = JSON.parse(sessionStorage.getItem(PLAYED_KEY) ?? "[]") as string[];
    if (played.includes(playKey)) return false;
    sessionStorage.setItem(PLAYED_KEY, JSON.stringify([...played.slice(-49), playKey]));
    return true;
  } catch {
    return true;
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface RamAnimationProps {
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Where the rammer started its turn. */
  fromRow: number;
  fromCol: number;
  /** The victim's tile, where the rammer ends up. */
  toRow: number;
  toCol: number;
  /** The rammed ship, for the tumble-off art (null: effect without it). */
  victim: GridShip | null;
  victimIsCreator: boolean;
  /** Identifies this ram, so the sound and shake play once. */
  playKey: string;
}

type Layout = {
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

export const RamAnimation = React.memo(function RamAnimation({
  gridContainerRef,
  fromRow,
  fromCol,
  toRow,
  toCol,
  victim,
  victimIsCreator,
  playKey,
}: RamAnimationProps) {
  const [layout, setLayout] = useState<Layout | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = gridContainerRef.current;
      if (!el) return;
      const { width, height, cellWidth, cellHeight } = gridLayoutSize(el);
      setLayout({
        width,
        height,
        cellWidth,
        cellHeight,
        from: cellCenterOnGrid(el, fromRow, fromCol),
        to: cellCenterOnGrid(el, toRow, toCol),
      });
    };
    measure();
    const el = gridContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridContainerRef, fromRow, fromCol, toRow, toCol]);

  // Sound and shake once per ram, timed to the first impact (~28% in).
  useEffect(() => {
    if (!takeFirstPlay(playKey)) return;
    const timer = window.setTimeout(() => {
      playSoundEffect("/sound/crash.mp3");
      const grid = gridContainerRef.current;
      if (grid && !prefersReducedMotion() && typeof grid.animate === "function") {
        // `translate` composes with any transform the grid already has.
        grid.animate(
          [
            { translate: "0 0" },
            { translate: "4px -3px" },
            { translate: "-3px 2px" },
            { translate: "2px 1px" },
            { translate: "0 0" },
          ],
          { duration: 260, easing: "ease-out" },
        );
      }
    }, CYCLE_MS * 0.28);
    return () => window.clearTimeout(timer);
  }, [playKey, gridContainerRef]);

  if (!layout) return null;
  const { width, height, cellWidth, cellHeight, from, to } = layout;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const unit = { x: dx / distance, y: dy / distance };
  const cell = Math.min(cellWidth, cellHeight);
  const cycle = { animationDuration: `${CYCLE_MS}ms` };

  return (
    <div className="absolute pointer-events-none z-30 overflow-visible" style={{ left: 0, top: 0, width, height }}>
      {/* Charge streak, from the start tile to the impact. */}
      <div
        className="ram-streak absolute"
        style={{
          ...cycle,
          left: from.x,
          top: from.y,
          width: distance,
          height: Math.max(3, cell * 0.08),
          marginTop: -Math.max(3, cell * 0.08) / 2,
          transform: `rotate(${angle}deg)`,
          transformOrigin: "0 50%",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(100, 200, 255, 0.35) 30%, rgba(200, 240, 255, 0.9) 80%, #ffffff 100%)",
          filter: "blur(1.5px)",
        }}
      />
      {/* Victim tumbling off, away from the rammer. */}
      {victim && (
        <div
          className="ram-knockoff absolute"
          style={
            {
              ...cycle,
              left: to.x - cellWidth / 2,
              top: to.y - cellHeight / 2,
              width: cellWidth,
              height: cellHeight,
              "--ram-kx": `${unit.x * cell * 1.4}px`,
              "--ram-ky": `${unit.y * cell * 1.4}px`,
              "--ram-spin": `${unit.x >= 0 ? 540 : -540}deg`,
            } as React.CSSProperties
          }
        >
          <div className={`h-full w-full ${victimIsCreator ? "scale-x-[-1]" : ""}`}>
            <GridShipImage ship={victim} className="h-full w-full object-contain" showLoadingState={false} hideRankStars />
          </div>
        </div>
      )}
      {/* Impact flash and sparks. */}
      <div
        className="ram-flash absolute rounded-full"
        style={{
          ...cycle,
          left: to.x - cell * 0.45,
          top: to.y - cell * 0.45,
          width: cell * 0.9,
          height: cell * 0.9,
          background:
            "radial-gradient(circle, #ffffff 0%, rgba(255, 220, 140, 0.95) 30%, rgba(255, 160, 60, 0.6) 55%, transparent 72%)",
        }}
      />
      {SPARK_ANGLES.map((a) => (
        <div
          key={a}
          className="ram-spark absolute"
          style={
            {
              ...cycle,
              left: to.x,
              top: to.y,
              width: cell * 0.22,
              height: 2,
              marginTop: -1,
              transformOrigin: "0 50%",
              background: "linear-gradient(90deg, #fff7d6, rgba(255, 170, 60, 0))",
              "--ram-a": `${a}deg`,
              "--ram-d": `${cell * 0.55}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
});
