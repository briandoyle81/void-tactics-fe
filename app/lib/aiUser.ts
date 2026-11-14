import { prisma } from "./prisma";
import { AI_USER_ID } from "../config/aiUser";

// Sentinel User row representing the AI opponent — the web2 analog of
// the game contract (AI_PLAYER, app/near/adapters/game.ts) on the web3 side.
// A real User row (not a nullable/optional FK) so every existing
// User-FK-dependent code path (Game.player1Id/player2Id, Fleet.ownerId,
// PlayerStats, etc.) works unmodified.
export { AI_USER_ID };

export async function ensureAiUser(): Promise<void> {
  await prisma.user.upsert({
    where: { id: AI_USER_ID },
    update: {},
    create: {
      id: AI_USER_ID,
      email: "ai@void-tactics.internal",
      username: "AI Opponent",
    },
  });
}
