import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { addPlayerResult } from "@/app/lib/playerStatsWeb2";

// The signed-in web2 player's tutorial ("first battle") record. Players who
// haven't done it get it as the first mission on the Operations map
// (useTutorialCompletedWeb2). Web3 reads TutorialClaim.tutorialCompleted.

const PATHS = ["win", "loss", "skipped"] as const;
type TutorialPath = (typeof PATHS)[number];

// GET /api/user/me/tutorial
export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { tutorialCompleted: true, tutorialPath: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json(user);
}

// POST /api/user/me/tutorial { path: "win" | "loss" | "skipped" }
// A finished path isn't overwritten by a later skip or replay.
export async function POST(request: Request) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const body = (await request.json().catch(() => null)) as { path?: unknown } | null;
  const path = body?.path;
  if (typeof path !== "string" || !PATHS.includes(path as TutorialPath)) {
    return NextResponse.json({ error: "path must be win, loss or skipped" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId! },
    select: { tutorialCompleted: true, tutorialPath: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const keepPath = user.tutorialPath === "win" || user.tutorialPath === "loss";
  // The first finished path adds a win or a loss to the player's record, like
  // web3's TutorialClaim.completeTutorialWinPath/LossPath (GameResults).
  const recordResult = !keepPath && (path === "win" || path === "loss");
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId! },
      data: { tutorialCompleted: true, tutorialPath: keepPath ? user.tutorialPath : path },
      select: { tutorialCompleted: true, tutorialPath: true },
    });
    if (recordResult) await addPlayerResult(tx, userId!, path === "win" ? "win" : "loss");
    return u;
  });
  return NextResponse.json(updated);
}
