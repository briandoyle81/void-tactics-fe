import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireWeb2Admin } from "@/app/lib/auth";
import { clearShipGrant, getShipGrants, setShipGrant, validateShipGrant } from "@/app/lib/shipGrantsWeb2";

// Web2 counterpart to ShipGrantWinEffect's owner calls
// (docs/frontend-handoff-2026-10-19.md §2).
// GET — every node's reward ship.
// PUT { nodeId, grant } — setGrant, with the contract's validation.
// DELETE { nodeId } — clearGrant.

export async function GET() {
  const { error } = await requireWeb2Admin();
  if (error) return error;
  const grants = await getShipGrants();
  return NextResponse.json({ grants: [...grants].map(([nodeId, grant]) => ({ nodeId, grant })) });
}

export async function PUT(req: NextRequest) {
  const { error } = await requireWeb2Admin();
  if (error) return error;

  const body = (await req.json()) as { nodeId?: unknown; grant?: unknown };
  const nodeId = Number(body.nodeId);
  if (!Number.isInteger(nodeId) || nodeId <= 0) {
    return NextResponse.json({ error: "Invalid nodeId" }, { status: 400 });
  }
  const node = await prisma.roguelikeNode.findUnique({ where: { id: nodeId }, select: { kind: true } });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
  if (node.kind !== 0) return NextResponse.json({ error: "Only combat nodes have reward ships" }, { status: 400 });

  const parsed = validateShipGrant(body.grant);
  if (parsed.error !== null) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await setShipGrant(nodeId, parsed.grant);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireWeb2Admin();
  if (error) return error;

  const body = (await req.json()) as { nodeId?: unknown };
  const nodeId = Number(body.nodeId);
  if (!Number.isInteger(nodeId) || nodeId <= 0) {
    return NextResponse.json({ error: "Invalid nodeId" }, { status: 400 });
  }
  await clearShipGrant(nodeId);
  return NextResponse.json({ ok: true });
}
