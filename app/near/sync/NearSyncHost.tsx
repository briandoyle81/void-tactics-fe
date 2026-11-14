"use client";

/**
 * Keeps the client's chain data fresh. Replaces the EVM event watcher
 * (useContractEvents): NEAR has no log search, so instead
 *  - each open match polls get_game_version on a fast cadence and refetches
 *    its board only when the version changed;
 *  - the player's data polls get_player_nonce on a slow cadence and
 *    refetches the player's ships, games, lobbies, run and balances only
 *    when it changed (it moves on anything that changes the player's data,
 *    including other players' calls);
 *  - the open lobby list (other players' lobbies) refetches slowly;
 *  - after each of the player's own transactions, its events (NEP-297 and
 *    the standard nft_/mt_ events) invalidate exactly what it changed;
 *  - becoming active again refetches once.
 * Hidden tabs don't poll, except a PvP match waiting on the opponent
 * (setHiddenTurnWatch), slowly.
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { NEAR_TX_SETTLED_EVENT, useNearSession, type NearSettledDetail } from "../session";
import { nearViewPrefix } from "../useNearView";
import { viewGame } from "../rpc";
import { globalGameRefetchFunctions, NEAR_QUERY_ROOTS } from "./gameRefetchRegistry";
import { usePageVisible, useWindowFocused } from "../../hooks/usePageVisible";
import {
  isFastEventPollingRequested,
  isHiddenTurnWatchRequested,
  subscribeFastEventPolling,
} from "../../utils/contractEventRouting";

const FAST_POLL_MS = 4000;
const SLOW_POLL_MS = 20_000;
const NONCE_POLL_MS = 8000;
const BLURRED_POLL_MS = 60_000;
const HIDDEN_TURN_POLL_MS = 60_000;

const SHIP_EVENTS = new Set([
  "nft_mint",
  "nft_transfer",
  "nft_burn",
  "ship_constructed",
  "free_ships_claimed",
  "tutorial_completed",
  "ship_granted",
  "randomness_resolved",
  "fleet_created",
  "run_started",
  "run_ended",
  "roster_modified",
]);
const TOKEN_EVENTS = new Set(["mt_mint", "mt_transfer", "mt_burn", "cores_turned_in", "game_ended"]);
const GAME_LIST_EVENTS = new Set([
  "game_started",
  "node_match_started",
  "combat_node_entered",
  "game_ended",
  "game_result_recorded",
  "lobby_created",
  "player_joined_lobby",
  "game_accepted",
  "game_rejected",
  "lobby_reset",
  "lobby_abandoned",
  "lobby_terminated",
  "lobby_pruned",
]);

/** Everything that hangs off the player's account (get_player_nonce moves when any of it does). */
function invalidatePlayerData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [NEAR_QUERY_ROOTS.ownedShips] });
  void queryClient.invalidateQueries({ queryKey: [NEAR_QUERY_ROOTS.playerGames] });
  void queryClient.invalidateQueries({ queryKey: [NEAR_QUERY_ROOTS.lobbies] });
  for (const method of [
    "mt_balance_of",
    "mt_batch_balance_of",
    "storage_balance_of",
    "storage_used_bytes",
    "get_claim_status",
    "get_run",
    "get_run_view",
    "get_player_summary",
    "get_player_lobbies",
    "is_tutorial_completed",
    "is_rl_grant_claimed",
    "get_player_stats",
  ] as const) {
    void queryClient.invalidateQueries({ queryKey: nearViewPrefix(method) });
  }
}

export function NearSyncHost() {
  const { accountId } = useNearSession();
  const queryClient = useQueryClient();

  // A match view (Games detail) switches to the fast cadence.
  const [matchViewOpen, setMatchViewOpen] = useState(false);
  useEffect(() => {
    const onDetail = (event: Event) => {
      setMatchViewOpen(Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active));
    };
    window.addEventListener("void-tactics-games-detail-active", onDetail);
    return () => window.removeEventListener("void-tactics-games-detail-active", onDetail);
  }, []);

  const [fastRequested, setFastRequested] = useState(isFastEventPollingRequested);
  const [hiddenTurnWatch, setHiddenTurnWatch] = useState(isHiddenTurnWatchRequested);
  useEffect(
    () =>
      subscribeFastEventPolling(() => {
        setFastRequested(isFastEventPollingRequested());
        setHiddenTurnWatch(isHiddenTurnWatchRequested());
      }),
    [],
  );

  const isPageVisible = usePageVisible();
  const isWindowFocused = useWindowFocused();

  // Our own transactions: invalidate what their events say changed.
  useEffect(() => {
    const onSettled = (event: Event) => {
      const receipt = (event as CustomEvent<NearSettledDetail>).detail;
      if (!receipt) return;
      // Admin settings writes: the shared settings reads.
      if (/^set_|^update_|^publish_|^transfer_ownership|^accept_ownership/.test(receipt.method)) {
        void queryClient.invalidateQueries({ queryKey: nearViewPrefix("get_settings") });
        void queryClient.invalidateQueries({ queryKey: nearViewPrefix("get_lobby_config") });
      }
      const names = new Set(receipt.events.map((e) => e.event));
      void queryClient.invalidateQueries({ queryKey: nearViewPrefix("storage_balance_of") });
      void queryClient.invalidateQueries({ queryKey: nearViewPrefix("storage_used_bytes") });
      if ([...names].some((n) => SHIP_EVENTS.has(n))) {
        void queryClient.invalidateQueries({ queryKey: [NEAR_QUERY_ROOTS.ownedShips] });
      }
      if ([...names].some((n) => TOKEN_EVENTS.has(n))) {
        void queryClient.invalidateQueries({ queryKey: nearViewPrefix("mt_balance_of") });
        void queryClient.invalidateQueries({ queryKey: nearViewPrefix("mt_batch_balance_of") });
        void queryClient.invalidateQueries({ queryKey: nearViewPrefix("get_claim_status") });
      }
      if ([...names].some((n) => GAME_LIST_EVENTS.has(n))) {
        void queryClient.invalidateQueries({ queryKey: [NEAR_QUERY_ROOTS.playerGames] });
        void queryClient.invalidateQueries({ queryKey: [NEAR_QUERY_ROOTS.lobbies] });
      }
      if (names.has("run_started") || names.has("run_ended") || names.has("combat_node_entered")) {
        void queryClient.invalidateQueries({ queryKey: nearViewPrefix("get_run") });
      }
    };
    window.addEventListener(NEAR_TX_SETTLED_EVENT, onSettled);
    return () => window.removeEventListener(NEAR_TX_SETTLED_EVENT, onSettled);
  }, [queryClient]);

  // Fast cadence: each open match checks its version, and refetches its
  // board only when it moved. The first check after a game opens refetches
  // once (the board may have loaded before a change).
  const fast = matchViewOpen || fastRequested;
  const watching = !!accountId && (isPageVisible || hiddenTurnWatch);
  const gameVersionsRef = useRef<Map<number, string>>(new Map());
  useEffect(() => {
    if (!watching || !fast) return;
    const interval = !isPageVisible ? HIDDEN_TURN_POLL_MS : isWindowFocused ? FAST_POLL_MS : BLURRED_POLL_MS;
    let inFlight = false;
    const id = setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      const entries = [...globalGameRefetchFunctions.entries()];
      void Promise.all(
        entries.map(async ([gameId, refetch]) => {
          const version = await viewGame("get_game_version", { game_id: String(gameId) }).catch(() => undefined);
          if (version === undefined) return;
          const seen = gameVersionsRef.current.get(gameId);
          gameVersionsRef.current.set(gameId, String(version));
          if (seen !== String(version)) refetch();
        }),
      ).finally(() => {
        inFlight = false;
      });
    }, interval);
    return () => clearInterval(id);
  }, [watching, fast, isPageVisible, isWindowFocused]);

  // Slow cadence: the player's nonce; refetch the player's data when it moved.
  const nonceRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    nonceRef.current = undefined;
  }, [accountId]);
  useEffect(() => {
    if (!accountId || !isPageVisible) return;
    const interval = isWindowFocused ? NONCE_POLL_MS : BLURRED_POLL_MS;
    let inFlight = false;
    const id = setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      viewGame("get_player_nonce", { account_id: accountId })
        .then((nonce) => {
          const seen = nonceRef.current;
          nonceRef.current = nonce;
          if (seen !== undefined && seen !== nonce) invalidatePlayerData(queryClient);
        })
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    }, interval);
    return () => clearInterval(id);
  }, [accountId, isPageVisible, isWindowFocused, queryClient]);

  // Slow cadence: the open lobby list (other players' lobbies don't move our nonce).
  useEffect(() => {
    if (!accountId || !isPageVisible || matchViewOpen) return;
    const interval = isWindowFocused ? SLOW_POLL_MS : BLURRED_POLL_MS;
    const id = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: [NEAR_QUERY_ROOTS.lobbies] });
    }, interval);
    return () => clearInterval(id);
  }, [accountId, isPageVisible, isWindowFocused, matchViewOpen, queryClient]);

  // Becoming active again: one catch-up refetch.
  const isActive = isPageVisible && isWindowFocused;
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActiveRef.current && accountId) {
      void queryClient.invalidateQueries({ queryKey: [NEAR_QUERY_ROOTS.playerGames] });
      if (!matchViewOpen) void queryClient.invalidateQueries({ queryKey: [NEAR_QUERY_ROOTS.ownedShips] });
      globalGameRefetchFunctions.forEach((refetch) => refetch());
    }
    wasActiveRef.current = isActive;
  }, [isActive, accountId, matchViewOpen, queryClient]);

  // A lobby reserved for this player (seen on the slow lobby poll).
  const reservedSeenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!accountId) return;
    const unsubscribe = queryClient.getQueryCache().subscribe((e) => {
      const key = e.query.queryKey;
      if (key[0] !== NEAR_QUERY_ROOTS.lobbies || e.type !== "updated") return;
      const data = e.query.state.data;
      if (!Array.isArray(data)) return;
      const lobbies = data as Array<{ basic?: { id?: bigint }; players?: { reservedJoiner?: string } }>;
      for (const l of lobbies) {
        const id = String(l.basic?.id ?? "");
        if (l.players?.reservedJoiner === accountId && id && !reservedSeenRef.current.has(id)) {
          reservedSeenRef.current.add(id);
          toast.success("A game has been reserved for you!");
        }
      }
    });
    return unsubscribe;
  }, [accountId, queryClient]);

  return null;
}
