"use client";

import React from "react";

const MONO_FONT = "var(--font-jetbrains-mono), 'Courier New', monospace";

// The HUD's square icon buttons (Header: battles bell, settings, audio).
export function HudIconButton({
  label,
  onClick,
  children,
  badge,
  expanded,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      className="relative flex h-8 w-8 shrink-0 items-center justify-center border border-solid transition-colors duration-150 hover:bg-slate"
      style={{
        color: "var(--color-cyan)",
        backgroundColor: "var(--color-near-black)",
        borderColor: "var(--color-gunmetal)",
      }}
    >
      {children}
      {badge != null && badge > 0 && (
        <span
          className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center px-1 text-[10px] font-bold leading-none"
          style={{
            fontFamily: MONO_FONT,
            backgroundColor: "var(--color-phosphor-green)",
            color: "var(--color-near-black)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
