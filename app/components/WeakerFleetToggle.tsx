"use client";

import React from "react";

// Beside a resupply station's confirm button while the selected fleet is
// under the run's minimum value (minRosterCostFor): ticking it lets the
// player commit the weaker fleet anyway, e.g. when they no longer own enough
// ships to reach the minimum. Sized like the header button it sits next to.
// Shared by RoguelikeResupplyPanel and its web2 counterpart.
export function WeakerFleetToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className="flex shrink-0 cursor-pointer items-center gap-2.5 border-2 border-amber/60 px-4 py-3 text-sm font-bold uppercase tracking-wider text-amber transition-colors hover:bg-amber/10"
      style={{ borderRadius: 0 }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-amber"
      />
      Commit weaker fleet
    </label>
  );
}
