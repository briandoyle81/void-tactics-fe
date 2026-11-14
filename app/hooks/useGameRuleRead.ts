import { useEffect, useMemo } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { viewGame } from "../near/rpc";
import { GAME_CONTRACT } from "../near/config";
import { stableKey, type ViewArgs, type ViewName, type ViewResult } from "../near/useNearView";

// Game-rule reads a live battle depends on: a variant's attribute table at a
// ship's pinned version (special range/strength), and the faction abilities'
// (Ram, Repair) range and strength. They change at most about once a month
// (a rebalance or redeploy), so each value is read once, saved in
// localStorage, and reused across games and sessions with no further reads.
// A failed move transaction may mean a saved value is out of date, so
// `refreshGameRuleReads` (called from the move error handler) drops the saved
// values and reads them again.

const SCOPE = "near-game-rules";
const STORAGE_PREFIX = "vt-game-rules:near-v1:";

function storageKey(method: string, args: unknown) {
  return `${STORAGE_PREFIX}${GAME_CONTRACT}:${method}:${stableKey(args)}`;
}

function readSaved(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { v: unknown }).v : undefined;
  } catch {
    return undefined;
  }
}

function writeSaved(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ v: value }));
  } catch {
    // Storage full or blocked: the in-memory query still has the value.
  }
}

/** A game-contract view of a game rule, saved across sessions (see the file comment). */
export function useGameRuleRead<M extends ViewName>(method: M, args: ViewArgs<M> | null, enabled = true) {
  const on = enabled && args !== null;
  const key = useMemo(() => storageKey(method, args), [method, args]);
  const saved = useMemo(() => (on ? (readSaved(key) as ViewResult<M> | undefined) : undefined), [on, key]);

  const result = useQuery({
    queryKey: [SCOPE, method, stableKey(args)],
    queryFn: () => viewGame(method, args as ViewArgs<M>),
    enabled: on,
    initialData: saved,
    staleTime: Infinity,
  });

  const { data, isFetchedAfterMount } = result;
  useEffect(() => {
    // Save values that came from the chain, not the saved copy echoed back.
    if (on && isFetchedAfterMount && data !== undefined) writeSaved(key, data);
  }, [on, isFetchedAfterMount, data, key]);

  return result;
}

/**
 * Drops every saved game-rule value and reads the ones in use again. Called
 * when a move transaction fails, in case a rule changed onchain.
 */
export function refreshGameRuleReads(queryClient: QueryClient) {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // Storage blocked: nothing was saved.
  }
  void queryClient.invalidateQueries({ queryKey: [SCOPE] });
}
