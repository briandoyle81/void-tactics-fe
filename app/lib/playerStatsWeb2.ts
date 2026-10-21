import type { Prisma } from "../generated/prisma";

// A web2 player's record (PlayerStats) counts what web3's GameResults counts:
// PvP games (PvPMatch) and the tutorial's one win or loss (TutorialClaim).
// Games against the AI, campaign nodes and roguelike runs don't count.

type Tx = Prisma.TransactionClient;
type PlayerResult = "win" | "loss" | "draw";

const FIELD = { win: "wins", loss: "losses", draw: "draws" } as const;

export function isPvpLobby(lobby: {
  isAiGame: boolean;
  campaignNodeId: number | null;
  roguelikeRunId: number | null;
}): boolean {
  return !lobby.isAiGame && lobby.campaignNodeId == null && lobby.roguelikeRunId == null;
}

export async function addPlayerResult(tx: Tx, userId: string, result: PlayerResult): Promise<void> {
  const field = FIELD[result];
  await tx.playerStats.upsert({
    where: { userId },
    update: { [field]: { increment: 1 }, totalGames: { increment: 1 } },
    create: { userId, [field]: 1, totalGames: 1 },
  });
}

/** Records a finished game for both players, if it's PvP. */
export async function recordGameResult(
  tx: Tx,
  lobby: Parameters<typeof isPvpLobby>[0],
  result: { winnerId: string; loserId: string } | { draw: [string, string] },
): Promise<void> {
  if (!isPvpLobby(lobby)) return;
  if ("draw" in result) {
    await addPlayerResult(tx, result.draw[0], "draw");
    await addPlayerResult(tx, result.draw[1], "draw");
    return;
  }
  await addPlayerResult(tx, result.winnerId, "win");
  await addPlayerResult(tx, result.loserId, "loss");
}
