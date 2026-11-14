"use client";

/**
 * The contract's rules and economy settings (get_settings) and lobby
 * settings (get_lobby_config), one read each, shared by every screen that
 * needs one field. Admin writes invalidate them (nearViewPrefix).
 */
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";
import type { GameSettings, LobbyConfig } from "./generated/voidTactics";
import { useNearView } from "./useNearView";

const NO_ARGS = {} as Record<string, never>;

export function useGameSettings<T = GameSettings>(select?: (s: GameSettings) => T) {
  return useNearView("get_settings", NO_ARGS, { staleTime: ADMIN_DATA_STALE_MS, select });
}

export function useLobbyConfig<T = LobbyConfig>(select?: (c: LobbyConfig) => T) {
  return useNearView("get_lobby_config", NO_ARGS, { staleTime: ADMIN_DATA_STALE_MS, select });
}

/** The player's account summary (purchases, tutorial, verification, medal), or null when unregistered. */
export function usePlayerSummary(accountId: string | null | undefined) {
  return useNearView("get_player_summary", accountId ? { account_id: accountId } : null, { staleTime: 30_000 });
}
