"use client";

import React from "react";
import { STYLE_LABEL } from "../styles/fontStyles";
import { getDialogCharacter } from "../data/dialog/characters";
import { RESUPPLY_REPAIR_LINE } from "../data/dialog/stationDialog";
import { DialogPortrait } from "./DialogPortrait";

// The repair box on a resupply station's fleet screen, shared by web3 and
// web2: Bosch's note about the paid repair service, the cost to bring the
// roster to full hull, and the mode's own action (approve / repair).
export function ResupplyRepairBox({
  costLabel,
  missingHp,
  action,
}: {
  /** Formatted UTC amount, e.g. "0.9900". */
  costLabel: string;
  missingHp: number;
  action: React.ReactNode;
}) {
  const character = getDialogCharacter(RESUPPLY_REPAIR_LINE.characterId);
  const color = character?.textColor ?? "var(--color-amber)";
  const name = character?.name ?? "";

  return (
    <div className="flex flex-col border border-cyan/40 bg-cyan/10 md:flex-row" style={{ borderRadius: 0 }}>
      <div className="flex min-w-0 flex-1 items-start gap-3 border-l-2 p-3" style={{ borderColor: color }}>
        <DialogPortrait character={character} name={name} color={color} sizeClass="h-12 w-12" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ ...STYLE_LABEL, color }}>
              {name}
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color }}>
              {"// Station comms"}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">{RESUPPLY_REPAIR_LINE.text}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-cyan/40 p-3 md:shrink-0 md:border-l md:border-t-0">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted" style={STYLE_LABEL}>
            Repair service
          </span>
          <span className="font-mono text-lg font-bold leading-tight text-cyan">{costLabel} UTC</span>
          <span className="font-mono text-[11px] text-text-secondary">{missingHp} HP to full strength</span>
        </div>
        {action}
      </div>
    </div>
  );
}
