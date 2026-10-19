import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireWeb2Admin } from "@/app/lib/auth";
import { resetShipGrantClaim } from "@/app/lib/shipGrantsWeb2";

// POST { nodeId, player } — web2's ShipGrantWinEffect.resetClaim: the player
// (an email or user id) can receive this node's once-only ship again.
export async function POST(req: NextRequest) {
  const { error } = await requireWeb2Admin();
  if (error) return error;

  const body = (await req.json()) as { nodeId?: unknown; player?: unknown };
  const nodeId = Number(body.nodeId);
  const player = typeof body.player === "string" ? body.player.trim() : "";
  if (!Number.isInteger(nodeId) || nodeId <= 0 || !player) {
    return NextResponse.json({ error: "nodeId and player are required" }, { status: 400 });
  }
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: player }, { email: { equals: player, mode: "insensitive" } }] },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "No player with that email or id" }, { status: 404 });

  const reset = await resetShipGrantClaim(nodeId, user.id);
  return NextResponse.json({ reset });
}
