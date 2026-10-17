import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireWeb2Admin } from "@/app/lib/auth";
import {
  getWinEffectsSettings,
  invalidateWinEffectsSettingsCache,
} from "@/app/lib/winEffectsWeb2";

// GET/PUT /api/admin/win-effects-settings — admin-only read/write for the
// global win-effect config (DEC bonus amount, grant-ship variant/tier, heal
// cap %). Web2 counterpart to Game.setHealCapPercent and the
// DECBonusWinEffect/ShipGrantWinEffect owner setters, gated on
// WEB2_ADMIN_EMAILS instead of contract ownership. Any subset of fields may
// be sent — omitted fields keep their current stored value (same merge
// pattern as /api/admin/lobby-settings).

export async function GET() {
  const { error } = await requireWeb2Admin();
  if (error) return error;

  const settings = await getWinEffectsSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const { error } = await requireWeb2Admin();
  if (error) return error;

  const body = (await req.json()) as Record<string, unknown>;
  const current = await getWinEffectsSettings();
  const next = { ...current };

  if (body.decBonusAmount !== undefined) {
    if (typeof body.decBonusAmount !== "number" || body.decBonusAmount < 0) {
      return NextResponse.json({ error: "decBonusAmount must be a non-negative number" }, { status: 400 });
    }
    next.decBonusAmount = body.decBonusAmount;
  }
  if (body.shipGrantVariant !== undefined) {
    if (typeof body.shipGrantVariant !== "number" || body.shipGrantVariant < 0 || body.shipGrantVariant > 2) {
      return NextResponse.json({ error: "shipGrantVariant must be 0-2" }, { status: 400 });
    }
    next.shipGrantVariant = body.shipGrantVariant;
  }
  if (body.shipGrantTier !== undefined) {
    if (typeof body.shipGrantTier !== "number" || body.shipGrantTier < 0 || body.shipGrantTier > 3) {
      return NextResponse.json({ error: "shipGrantTier must be 0-3" }, { status: 400 });
    }
    next.shipGrantTier = body.shipGrantTier;
  }
  if (body.healAboveFloorPercent !== undefined) {
    if (
      typeof body.healAboveFloorPercent !== "number" ||
      body.healAboveFloorPercent < 0 ||
      body.healAboveFloorPercent > 100
    ) {
      return NextResponse.json({ error: "healAboveFloorPercent must be 0-100" }, { status: 400 });
    }
    next.healAboveFloorPercent = body.healAboveFloorPercent;
  }
  if (body.healCapPercent !== undefined) {
    if (typeof body.healCapPercent !== "number" || body.healCapPercent < 0 || body.healCapPercent > 100) {
      return NextResponse.json({ error: "healCapPercent must be 0-100" }, { status: 400 });
    }
    next.healCapPercent = body.healCapPercent;
  }

  await prisma.config.upsert({
    where: { key: "win_effects_settings" },
    create: { key: "win_effects_settings", value: next },
    update: { value: next },
  });
  invalidateWinEffectsSettingsCache();

  return NextResponse.json({ ok: true, ...next });
}
