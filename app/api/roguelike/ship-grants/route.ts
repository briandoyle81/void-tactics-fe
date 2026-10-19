import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { claimedNodeIds, getShipGrants } from "@/app/lib/shipGrantsWeb2";

// GET /api/roguelike/ship-grants?nodeIds=1,2 — the reward ship for each
// node (web2's ShipGrantWinEffect.getGrant), plus, when signed in, which of
// those nodes' once-only ships this player already received (hasClaimed).
export async function GET(req: NextRequest) {
  const nodeIds = (req.nextUrl.searchParams.get("nodeIds") ?? "")
    .split(",")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 200);
  if (nodeIds.length === 0) return NextResponse.json({ grants: [], claimedNodeIds: [] });

  const grants = await getShipGrants(nodeIds);
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const claimed = userId ? await claimedNodeIds(userId, [...grants.keys()]) : new Set<number>();

  return NextResponse.json({
    grants: [...grants].map(([nodeId, grant]) => ({ nodeId, grant })),
    claimedNodeIds: [...claimed],
  });
}
