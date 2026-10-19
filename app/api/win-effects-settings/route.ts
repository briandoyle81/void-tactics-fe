import { NextResponse } from "next/server";
import { getWinEffectsSettings } from "@/app/lib/winEffectsWeb2";

// GET /api/win-effects-settings — public, read-only view of the global
// win-effect numbers a player sees in a mission's dossier (DEC bonus,
// heal-above-floor %). Web2 counterpart to the public view functions on
// DECBonusWinEffect/HealAboveFloorWinEffect. Editing stays admin-only at
// /api/admin/win-effects-settings. Reward ships are per node:
// /api/roguelike/ship-grants.
export async function GET() {
  const settings = await getWinEffectsSettings();
  return NextResponse.json({
    decBonusAmount: settings.decBonusAmount,
    healAboveFloorPercent: settings.healAboveFloorPercent,
  });
}
