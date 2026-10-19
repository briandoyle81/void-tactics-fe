import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { dbShipToShip } from "@/app/lib/dbToType";

// GET /api/roguelike/ship-grants/award?lobbyId=1 — the reward ship the
// signed-in player received for winning this roguelike game (web2's
// ShipGranted), or { ship: null } when the win minted none.
export async function GET(req: NextRequest) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const lobbyId = Number(req.nextUrl.searchParams.get("lobbyId"));
  if (!Number.isInteger(lobbyId) || lobbyId <= 0) {
    return NextResponse.json({ error: "lobbyId is required" }, { status: 400 });
  }
  const award = await prisma.roguelikeShipGrantAward.findFirst({
    where: { lobbyId, userId },
    orderBy: { id: "desc" },
  });
  if (!award) return NextResponse.json({ ship: null });
  const ship = await prisma.ship.findFirst({ where: { id: award.shipId, ownerId: userId } });
  return NextResponse.json({ ship: ship ? dbShipToShip(ship) : null });
}
