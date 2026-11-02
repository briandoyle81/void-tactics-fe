import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireWeb2Admin } from "@/app/lib/auth";
import { AI_FLEET_MAX_KILLS } from "@/app/utils/aiFleet";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireWeb2Admin();
  if (error) return error;

  const { id } = await params;
  const configId = Number(id);
  if (isNaN(configId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const { name, equipment, traits, archetype, shiny = false, shipsDestroyed = 0 } = body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!Number.isInteger(archetype) || archetype < 0 || archetype > 5) {
    return NextResponse.json({ error: "Invalid archetype" }, { status: 400 });
  }
  if (typeof shiny !== "boolean") {
    return NextResponse.json({ error: "Invalid shiny" }, { status: 400 });
  }
  // AIEncounters.MAX_AI_KILLS on chain.
  if (!Number.isInteger(shipsDestroyed) || shipsDestroyed < 0 || shipsDestroyed > AI_FLEET_MAX_KILLS) {
    return NextResponse.json({ error: "Invalid shipsDestroyed" }, { status: 400 });
  }

  try {
    const config = await prisma.aIShipConfig.update({
      where: { id: configId },
      data: { name: name.trim(), equipment, traits, archetype, shiny, shipsDestroyed },
    });
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireWeb2Admin();
  if (error) return error;

  const { id } = await params;
  const configId = Number(id);
  if (isNaN(configId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const inUse = await prisma.aIMapPlacement.findFirst({ where: { configId } });
  if (inUse) {
    return NextResponse.json(
      { error: "Config is still placed on a map — remove its placements first" },
      { status: 409 },
    );
  }

  try {
    await prisma.aIShipConfig.delete({ where: { id: configId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }
}
