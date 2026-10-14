/**
 * POST /api/roguelike/run/nodes/[id]/enter-resupply
 *
 * Web2 counterpart to RoguelikeMatch.enterResupplyNode — advances the run's
 * position to a reachable Resupply node. No Game/Lobby involved.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { canLeaveCurrentNodeWeb2, FINISH_CURRENT_MISSION_ERROR } from "@/app/lib/roguelikeAdvance";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const targetNodeId = Number((await params).id);
  if (!Number.isInteger(targetNodeId)) {
    return NextResponse.json({ error: "Invalid node id" }, { status: 400 });
  }

  const run = await prisma.roguelikeRun.findFirst({
    where: { userId: userId!, status: "ACTIVE" },
  });
  if (!run) {
    return NextResponse.json({ error: "No active run" }, { status: 404 });
  }
  if (run.activeLobbyId) {
    return NextResponse.json({ error: "A match is already in progress" }, { status: 409 });
  }

  const node = await prisma.roguelikeNode.findUnique({ where: { id: targetNodeId } });
  if (!node || node.kind !== 1) {
    return NextResponse.json({ error: "This node isn't a resupply node" }, { status: 400 });
  }

  if (targetNodeId !== run.currentNodeId && !(await canLeaveCurrentNodeWeb2(run))) {
    return NextResponse.json({ error: FINISH_CURRENT_MISSION_ERROR }, { status: 409 });
  }
  if (targetNodeId !== run.currentNodeId) {
    // Edges are forward-only, matching RoguelikeMatch: a run moves only to
    // a child of its current node.
    const edge = await prisma.roguelikeEdge.findUnique({
      where: { parentId_childId: { parentId: run.currentNodeId, childId: targetNodeId } },
    });
    if (!edge) {
      return NextResponse.json(
        { error: "This node isn't reachable from your current position" },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.roguelikeRun.update({
    where: { id: run.id },
    data: { currentNodeId: targetNodeId },
  });

  return NextResponse.json({ run: updated });
}
