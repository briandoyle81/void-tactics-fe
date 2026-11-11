import { useEffect, useMemo } from "react";
import { useReadContract } from "wagmi";
import type { Abi } from "viem";
import type { QueryClient } from "@tanstack/react-query";

// Game-rule reads a live battle depends on: a special's range and strength at
// a ship's pinned attributes version, and the faction abilities' (Ram,
// Repair) range and strength. They change at most about once a month (a
// rebalance or redeploy), so each value is read once, saved in localStorage,
// and reused across games and sessions with no further reads. A failed move
// transaction may mean a saved value is out of date, so `refreshGameRuleReads`
// (called from the move error handler) drops the saved values and reads them
// again. Before this, a read that failed left the value missing for the rest
// of the session (staleTime Infinity, no retry), which left the special with
// no targets.

/** Marks these queries (wagmi `scopeKey`) so they can be refreshed together. */
export const GAME_RULE_SCOPE = "game-rules";
const STORAGE_PREFIX = "vt-game-rules:v1:";

type Stored = { n: string } | { v: unknown };

function storageKey(chainId: number, address: string, functionName: string, args: readonly unknown[] | undefined) {
  const argText = JSON.stringify(args ?? [], (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return `${STORAGE_PREFIX}${chainId}:${address.toLowerCase()}:${functionName}:${argText}`;
}

function readSaved(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Stored;
    return "n" in parsed ? BigInt(parsed.n) : parsed.v;
  } catch {
    return undefined;
  }
}

function writeSaved(key: string, value: unknown) {
  try {
    const stored: Stored = typeof value === "bigint" ? { n: value.toString() } : { v: value };
    localStorage.setItem(key, JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the in-memory query still has the value.
  }
}

/** A contract read of a game rule, saved across sessions (see the file comment). */
export function useGameRuleRead({
  address,
  abi,
  chainId,
  functionName,
  args,
  enabled = true,
}: {
  address: `0x${string}`;
  abi: Abi;
  chainId: number;
  functionName: string;
  args?: readonly unknown[];
  enabled?: boolean;
}) {
  const key = useMemo(
    () => storageKey(chainId, address, functionName, args),
    [chainId, address, functionName, args],
  );
  const saved = useMemo(() => (enabled ? readSaved(key) : undefined), [enabled, key]);

  const result = useReadContract({
    address,
    abi,
    chainId,
    functionName,
    args,
    scopeKey: GAME_RULE_SCOPE,
    query: {
      enabled,
      initialData: saved as never,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      notifyOnChangeProps: ["data", "error"],
    },
  });

  const { data, isFetchedAfterMount } = result;
  useEffect(() => {
    // Save values that came from the chain, not the saved copy echoed back.
    if (enabled && isFetchedAfterMount && data !== undefined) writeSaved(key, data);
  }, [enabled, isFetchedAfterMount, data, key]);

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
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const params = query.queryKey[1] as { scopeKey?: string } | undefined;
      return query.queryKey[0] === "readContract" && params?.scopeKey === GAME_RULE_SCOPE;
    },
  });
}
