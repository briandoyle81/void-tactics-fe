import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { WEB2_TIE_SENTINEL } from "@/app/types/web2Game";

// GET /api/user/[id]/stats — a player's win/loss record. Web2-mode
// counterpart to web3's `usePlayerStats(address, chainId)` (an on-chain
// read) — shown next to a lobby's creator/joiner in LobbiesWeb2.tsx, same
// as Lobbies.tsx's `CreatorStats`. Any signed-in user can view any other
// user's basic record (matches the on-chain read being public), gated only
// on being signed in at all.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const stats = await prisma.playerStats.findUnique({
    where: { userId: id },
    select: { wins: true, losses: true, draws: true, totalGames: true },
  });

  // PlayerStats counts PvP games and the tutorial only (playerStatsWeb2.ts),
  // so the profile's PvP/PvE split counts the player's finished games by
  // kind (app/utils/playerRecord.ts).
  const PVE_LOBBY = { OR: [{ isAiGame: true }, { campaignNodeId: { not: null } }, { roguelikeRunId: { not: null } }] };
  const PVP_LOBBY = { isAiGame: false, campaignNodeId: null, roguelikeRunId: null };
  const mine = { OR: [{ player1Id: id }, { player2Id: id }] };
  const lost = { winnerId: { notIn: [id, WEB2_TIE_SENTINEL] }, NOT: { winnerId: null } };
  const [pvpWins, pvpLosses, pveWins, pveLosses] = await Promise.all([
    prisma.game.count({ where: { winnerId: id, lobby: PVP_LOBBY } }),
    prisma.game.count({ where: { AND: [mine, lost], lobby: PVP_LOBBY } }),
    prisma.game.count({ where: { winnerId: id, lobby: PVE_LOBBY } }),
    prisma.game.count({ where: { AND: [mine, lost], lobby: PVE_LOBBY } }),
  ]);

  return NextResponse.json({
    wins: stats?.wins ?? 0,
    losses: stats?.losses ?? 0,
    draws: stats?.draws ?? 0,
    totalGames: stats?.totalGames ?? 0,
    pvpGames: { wins: pvpWins, losses: pvpLosses },
    pveGames: { wins: pveWins, losses: pveLosses },
  });
}
