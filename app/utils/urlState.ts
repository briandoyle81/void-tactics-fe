"use client";

import { useCallback, useSyncExternalStore } from "react";

// Screen state for the game client (/play) and the Ops Console (/admin)
// lives in the URL's query string, so a refresh reopens exactly that screen
// and the browser's Back/Forward step through screens instead of leaving the
// app. Each navigation pushes a history entry; fine-grained selection (a
// node on a map) replaces the current one instead, so Back skips it.
//
// Keys in use (see CLIENT_CHILD_PARAMS for which are cleared on a tab
// change):
//   tab         top-level screen (app/play/page.tsx, app/admin/page.tsx)
//   section     Store / Fleet sub-tab
//   game        open match (Games / GamesWeb2); `replay=1` opened in replay
//   lobby       open lobby detail; `create=1` the create form; `fleet` (+
//               `fleetOwner`) the fleet viewer (Lobbies / LobbiesWeb2); on the
//               Mission tab, `fleet=select` is run fleet selection
//               (RoguelikeCampaign / RoguelikeCampaignWeb2)
//   tournament  open tournament (Tournaments / TournamentsWeb2)
//   ship        ship being customized (ManageNavy / ManageNavyWeb2)
//   node        selected node on the Operations map (replace, not push)
//
// Plain history.pushState: Next's App Router picks it up (useSearchParams
// stays in sync) without a navigation or re-render of the route.
//
// In-app back buttons close with `{ back: true }`: when the previous history
// entry is the screen they lead to, that's history.back(), so the in-app
// button and the browser's Back do the same thing and don't pile up entries.
// Each pushed entry records the query it was pushed from (PREV_KEY in
// history.state) to tell. Otherwise (landed on the detail from a link or a
// refresh in a new tab, or came from another screen) it replaces the entry.

const CHANGE_EVENT = "vt-url-state-change";
const PREV_KEY = "__vtPrevSearch";

/** Params owned by a screen inside a tab; dropped when the tab changes. */
export const CLIENT_CHILD_PARAMS = [
  "section",
  "game",
  "replay",
  "lobby",
  "create",
  "fleet",
  "fleetOwner",
  "fleetLobby",
  "tournament",
  "ship",
  "node",
] as const;

export type UrlParamUpdates = Record<string, string | number | bigint | null | undefined>;

export function getUrlParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

/** Search string (no "?") after applying `updates`; null/undefined/"" delete. */
export function applyUrlParams(
  search: string,
  updates: UrlParamUpdates,
  clear: readonly string[] = [],
): string {
  const params = new URLSearchParams(search);
  for (const key of clear) params.delete(key);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  return params.toString();
}

/**
 * Same screen: equal params regardless of order, ignoring `node` (a map
 * selection replaces its entry, so it may differ from what was recorded).
 */
export function isSameScreen(a: string, b: string): boolean {
  const normalize = (search: string) => {
    const params = new URLSearchParams(search);
    params.delete("node");
    params.sort();
    return params.toString();
  };
  return normalize(a) === normalize(b);
}

export type SetUrlParamsOptions = {
  /** Change the current entry instead of pushing one (automatic changes). */
  replace?: boolean;
  /** In-app back button: history.back() when that lands here, else replace. */
  back?: boolean;
  clear?: readonly string[];
};

/**
 * Updates the query string. Pushes a history entry unless `replace` or
 * `back`; a no-op when nothing changes, so it's safe to call from effects.
 */
export function setUrlParams(updates: UrlParamUpdates, options: SetUrlParamsOptions = {}): void {
  if (typeof window === "undefined") return;
  const current = window.location.search.replace(/^\?/, "");
  const next = applyUrlParams(current, updates, options.clear);
  if (next === current) return;
  const state = window.history.state as Record<string, unknown> | null;
  if (options.back && typeof state?.[PREV_KEY] === "string" && isSameScreen(state[PREV_KEY], next)) {
    // popstate (from Next's router listener and ours) updates subscribers.
    window.history.back();
    return;
  }
  const url = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
  if (options.replace || options.back) {
    window.history.replaceState(state, "", url);
  } else {
    window.history.pushState({ ...state, [PREV_KEY]: current }, "", url);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** One query param, live: updates on setUrlParams and on Back/Forward. */
export function useUrlParam(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getUrlParam(key),
    () => null,
  );
}

/** The whole query string (no "?"), live. */
export function useUrlSearch(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.search.replace(/^\?/, ""),
    () => "",
  );
}

/**
 * A screen's state backed by one query param: [value, set]. `set` pushes a
 * history entry (pass `{ replace: true }` for automatic changes, e.g.
 * closing a lobby that no longer exists, so Back doesn't land on it).
 */
export function useUrlValue(
  key: string,
): [string | null, (value: string | number | bigint | null, options?: SetUrlParamsOptions) => void] {
  const value = useUrlParam(key);
  const set = useCallback(
    (next: string | number | bigint | null, options?: SetUrlParamsOptions) =>
      setUrlParams({ [key]: next == null ? null : String(next) }, options),
    [key],
  );
  return [value, set];
}

/** Boolean form of useUrlValue (`key=1` when true). */
export function useUrlFlag(
  key: string,
): [boolean, (on: boolean, options?: SetUrlParamsOptions) => void] {
  const [value, setValue] = useUrlValue(key);
  const set = useCallback(
    (on: boolean, options?: SetUrlParamsOptions) => setValue(on ? "1" : null, options),
    [setValue],
  );
  return [value === "1", set];
}

/** Parses a bigint param, null when absent or malformed. */
export function parseBigintParam(value: string | null): bigint | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}
