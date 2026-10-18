import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// GET /api/flow/pending — card payments whose ships aren't minted yet
// (FlowFulfillment rows not MINTED), for support. A PENDING row older than a
// few minutes means the server stopped between claiming the payment and
// broadcasting the mint; check the minter wallet's history before setting it
// to FAILED so the buyer can retry. Requires ADMIN_SECRET (refused when unset,
// since the rows hold buyer addresses).

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET(req: NextRequest) {
  if (!ADMIN_SECRET || req.headers.get("authorization") !== `Bearer ${ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const unresolved = await prisma.flowFulfillment.findMany({
    where: { status: { not: "MINTED" } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ count: unresolved.length, unresolved });
}
