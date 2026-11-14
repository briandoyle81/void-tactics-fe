"use client";

/**
 * React Query views on the game (and renderer) contract. Replaces wagmi's
 * useReadContract / useReadContracts.
 *
 * RPC budget (CLAUDE.md "RPC Call Memoization"): the query key is the
 * method plus a stable serialization of the args, so re-renders with equal
 * args never refetch. Pass `select` through useCallback or define it at
 * module level.
 */
import { useQueries, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { GAME_CONTRACT } from "./config";
import { viewGame } from "./rpc";
import type { Views } from "./generated/voidTactics";

export type ViewName = keyof Views;
export type ViewArgs<M extends ViewName> = Views[M]["args"];
export type ViewResult<M extends ViewName> = Views[M]["result"];

/** Stable JSON for query keys (bigints as strings, keys sorted). */
export function stableKey(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === "bigint") return v.toString();
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  });
}

/** Query key for a game-contract view; use it to invalidate or setQueryData. */
export function nearViewKey<M extends ViewName>(method: M, args?: ViewArgs<M> | null) {
  return args === undefined
    ? (["near", GAME_CONTRACT, method] as const)
    : (["near", GAME_CONTRACT, method, stableKey(args)] as const);
}

/** Prefix that matches every cached call of a view (for invalidateQueries). */
export function nearViewPrefix(method: ViewName) {
  return ["near", GAME_CONTRACT, method] as const;
}

function jsonArgs<A>(args: A): A {
  return JSON.parse(stableKey(args)) as A;
}

export interface NearViewOptions<M extends ViewName, T> {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchInterval?: number | false;
  select?: (data: ViewResult<M>) => T;
  placeholderData?: UseQueryOptions<ViewResult<M>, Error, T>["placeholderData"];
}

/**
 * One view. `args === null` disables the query (missing inputs), so callers
 * don't need a separate `enabled` for "no account yet".
 */
export function useNearView<M extends ViewName, T = ViewResult<M>>(
  method: M,
  args: ViewArgs<M> | null,
  options: NearViewOptions<M, T> = {},
) {
  const { enabled = true, select, ...rest } = options;
  return useQuery<ViewResult<M>, Error, T>({
    queryKey: nearViewKey(method, args ?? undefined),
    queryFn: () => viewGame(method, jsonArgs(args as ViewArgs<M>)),
    enabled: enabled && args !== null,
    select,
    ...rest,
  });
}

/** Many calls of one view in parallel (e.g. get_ship for each id). Results in the same order. */
export function useNearViews<M extends ViewName>(
  method: M,
  argsList: readonly ViewArgs<M>[] | null,
  options: { enabled?: boolean; staleTime?: number; refetchInterval?: number | false } = {},
) {
  const { enabled = true, ...rest } = options;
  return useQueries({
    queries: (argsList ?? []).map((args) => ({
      queryKey: nearViewKey(method, args),
      queryFn: () => viewGame(method, jsonArgs(args)),
      enabled: enabled && argsList !== null,
      ...rest,
    })),
  });
}

/**
 * Fetches every page of a `(from_index, limit)` view. For small, bounded
 * lists (owned ships, open lobbies); stops at the first short page.
 */
export async function fetchAllPages<T>(
  fetchPage: (fromIndex: number, limit: number) => Promise<T[]>,
  pageSize = 50,
  maxPages = 40,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const items = await fetchPage(page * pageSize, pageSize);
    out.push(...items);
    if (items.length < pageSize) break;
  }
  return out;
}
