import { openClientTab } from "./clientNavigation";

// Opens Battles, or a specific match in it (`/play/battles?game=<id>`, see
// urlState.ts), as a new history entry. Shared by every "go to the game"
// action: NodeMatchModal / CampaignNodePreview (launching or resuming a
// mission), the Operations run map, Lobbies once a match exists, Profile.
// The event tells the client to refetch its games list, which a new match
// may not be in yet (Games waits for it rather than dropping the id).

function notifyGamesOpened(): void {
  window.dispatchEvent(new CustomEvent("void-tactics-navigate-to-games"));
  document.dispatchEvent(new CustomEvent("void-tactics-navigate-to-games"));
}

/** Battles list (no match open). */
export function navigateToGamesTab(): void {
  if (typeof window === "undefined") return;
  openClientTab("Games", { params: { game: null, replay: null } });
  notifyGamesOpened();
}

/** A web3 match. `address` is unused now (kept for existing callers). */
export function navigateToGame(_address: string | undefined, gameId: bigint): void {
  if (typeof window === "undefined") return;
  openClientTab("Games", { params: { game: gameId.toString(), replay: null } });
  notifyGamesOpened();
}

/** A web2 match. `userId` is unused now (kept for existing callers). */
export function navigateToGameWeb2(_userId: string | null | undefined, gameId: number | string): void {
  if (typeof window === "undefined") return;
  openClientTab("Games", { params: { game: String(gameId), replay: null } });
  notifyGamesOpened();
}
