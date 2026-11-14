// Sentinel User id representing the AI opponent (web2 counterpart to
// AI_PLAYER in app/near/adapters/game.ts). Split out from app/lib/aiUser.ts, which also
// imports Prisma (server-only) — this file is safe to import from client
// components.
export const AI_USER_ID = "ai-player-void-tactics";
