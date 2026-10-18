"use client";

import type { ReactNode } from "react";
import { ART_SLOTS, type ArtSlotId } from "../config/art";
import { useDebugMode } from "../hooks/useDebugMode";

/**
 * An image area filled from app/config/art.ts. Until the art exists it
 * draws a dark grid backdrop (labeled in debug mode). Children render on
 * top, e.g. a tile's title panel.
 */
export function ArtSlot({
  slot,
  className = "",
  children,
}: {
  slot: ArtSlotId;
  className?: string;
  children?: ReactNode;
}) {
  const { label, src, position = "center" } = ART_SLOTS[slot];
  const showSlotLabel = useDebugMode();
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={
        src
          ? { backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: position }
          : {
              backgroundColor: "#0f161e",
              backgroundImage:
                "radial-gradient(ellipse at 70% 30%, rgba(86,214,255,0.12), transparent 60%), linear-gradient(rgba(86,214,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(86,214,255,0.05) 1px, transparent 1px)",
              backgroundSize: "auto, 28px 28px, 28px 28px",
            }
      }
    >
      {!src && showSlotLabel && (
        <span className="pointer-events-none absolute left-2 top-2 border border-dashed border-text-muted/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted/70">
          Art · {label}
        </span>
      )}
      {children}
    </div>
  );
}
