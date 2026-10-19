import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireWeb2Admin } from "@/app/lib/auth";
import { getMapZone } from "@/app/lib/deploymentZoneWeb2";
import { isDeploymentTile } from "@/app/utils/deploymentZone";

// GET /api/admin/ai-map-placements?mapId=1 — list placements for a map.
// PUT  { mapId, row, col, configId } — upsert a single placement (matches
// web3's AIEncounters.setMapPlacement 1:1).
// DELETE { mapId, row, col } — clear a placement.
// POST { mapId, placements: [{row, col, configId}] } — replace every
// placement for a map in one call, matching web3's setMapPlacements (whole-
// array replace) 1:1 — used by the map-placement editor's single "Save".
//
// Like AIEncounters (2026-10-19), a placement must be a tile of the map's
// joiner zone (default columns 13–16 when the map has none); clearing one
// always works.

async function outOfZoneError(mapId: number, tiles: { row: number; col: number }[]) {
  const zone = await getMapZone(mapId, false);
  const bad = tiles.find((t) => !isDeploymentTile(t.row, t.col, false, zone));
  return bad
    ? NextResponse.json(
        { error: `Tile (${bad.row}, ${bad.col}) is outside this map's joiner zone` },
        { status: 400 },
      )
    : null;
}

export async function GET(req: NextRequest) {
  const { error } = await requireWeb2Admin();
  if (error) return error;

  const mapId = Number(req.nextUrl.searchParams.get("mapId"));
  if (!Number.isInteger(mapId) || mapId <= 0) {
    return NextResponse.json({ error: "mapId is required" }, { status: 400 });
  }

  const placements = await prisma.aIMapPlacement.findMany({
    where: { mapId },
    include: { config: true },
    orderBy: [{ row: "asc" }, { col: "asc" }],
  });
  return NextResponse.json(placements);
}

export async function PUT(req: NextRequest) {
  const { error } = await requireWeb2Admin();
  if (error) return error;

  const body = await req.json();
  const { mapId, row, col, configId } = body ?? {};

  if (!Number.isInteger(mapId) || mapId <= 0) {
    return NextResponse.json({ error: "Invalid mapId" }, { status: 400 });
  }
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return NextResponse.json({ error: "Invalid row/col" }, { status: 400 });
  }
  if (!Number.isInteger(configId) || configId <= 0) {
    return NextResponse.json({ error: "Invalid configId" }, { status: 400 });
  }

  const zoneError = await outOfZoneError(mapId, [{ row, col }]);
  if (zoneError) return zoneError;

  const placement = await prisma.aIMapPlacement.upsert({
    where: { mapId_row_col: { mapId, row, col } },
    update: { configId },
    create: { mapId, row, col, configId },
    include: { config: true },
  });
  return NextResponse.json(placement);
}

export async function POST(req: NextRequest) {
  const { error } = await requireWeb2Admin();
  if (error) return error;

  const body = await req.json();
  const { mapId, placements } = body ?? {};

  if (!Number.isInteger(mapId) || mapId <= 0) {
    return NextResponse.json({ error: "Invalid mapId" }, { status: 400 });
  }
  if (!Array.isArray(placements)) {
    return NextResponse.json({ error: "placements must be an array" }, { status: 400 });
  }
  for (const p of placements) {
    if (!Number.isInteger(p?.row) || !Number.isInteger(p?.col) || !Number.isInteger(p?.configId)) {
      return NextResponse.json({ error: "Each placement needs row/col/configId" }, { status: 400 });
    }
  }

  const zoneError = await outOfZoneError(mapId, placements);
  if (zoneError) return zoneError;

  await prisma.$transaction(async (tx) => {
    await tx.aIMapPlacement.deleteMany({ where: { mapId } });
    if (placements.length > 0) {
      await tx.aIMapPlacement.createMany({
        data: placements.map((p: { row: number; col: number; configId: number }) => ({
          mapId,
          row: p.row,
          col: p.col,
          configId: p.configId,
        })),
      });
    }
  });

  const updated = await prisma.aIMapPlacement.findMany({
    where: { mapId },
    include: { config: true },
    orderBy: [{ row: "asc" }, { col: "asc" }],
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireWeb2Admin();
  if (error) return error;

  const body = await req.json();
  const { mapId, row, col } = body ?? {};
  if (!Number.isInteger(mapId) || !Number.isInteger(row) || !Number.isInteger(col)) {
    return NextResponse.json({ error: "Invalid mapId/row/col" }, { status: 400 });
  }

  try {
    await prisma.aIMapPlacement.delete({ where: { mapId_row_col: { mapId, row, col } } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Placement not found" }, { status: 404 });
  }
}
