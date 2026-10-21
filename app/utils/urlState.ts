"use client";
import { useSyncExternalStore } from "react";
import { CLIENT_TAB_SLUG_LIST } from "../config/clientTabs";
import { ADMIN_PATH, PLAY_PATH } from "../config/routes";

// Screen state for the game client (/play) and the Ops Console (/admin)
// lives in the URL, so a refresh reopens exactly that screen and the
// browser's Back/Forward step through screens instead of leaving the app.
// Each navigation pushes a history entry; fine-grained selection (a node on
// a map) replaces the current one instead, so Back skips it.
//
// `tab` is the path segment after the page (/play/operations,
// /admin/maps; /operations on the play host, see hostRouting.ts); every
// other key is in the query string. Both go through the same functions
// here. Keys in use (see CLIENT_CHILD_PARAMS for which are cleared on a tab
// change):
//   tab         top-level screen (app/(client)/play/GameClient.tsx,
//               app/(client)/admin/OpsConsole.tsx)
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
// Each pushed entry records the path and query it was pushed from
// (PREV_KEY in history.state) to tell. Otherwise (landed on the detail from a link or a
// refresh in a new tab, or came from another screen) it replaces the entry.

const CHANGE_EVENT = "vt-url-state-change";
const PREV_KEY = "__vtPrevLocation";

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

/** Pages whose first path segment after them is the `tab` param. */
const SCREEN_BASES = [PLAY_PATH, ADMIN_PATH];

/**
 * Splits a pathname into its page (`base`) and `tab` segment, or null for a
 * path that isn't a screen page. On the play host the client is at "/" and
 * its tabs at "/<slug>", so the base there is "".
 */
export function parseScreenPath(pathname: string): { base: string; tab: string | null } | null {
  for (const base of SCREEN_BASES) {
    if (pathname === base || pathname.startsWith(`${base}/`)) {
      return { base, tab: pathname.slice(base.length).split("/").filter(Boolean)[0] ?? null };
    }
  }
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return { base: "", tab: null };
  if (segments.length === 1 && CLIENT_TAB_SLUG_LIST.includes(segments[0])) {
    return { base: "", tab: segments[0] };
  }
  return null;
}

function screenPathname(base: string, tab: string | null): string {
  return tab ? `${base}/${tab}` : base || "/";
}

export function getUrlParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  if (key === "tab") return parseScreenPath(window.location.pathname)?.tab ?? null;
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
 * Same screen: two "path?query" locations with the same path and equal
 * params regardless of order, ignoring `node` (a map selection replaces its
 * entry, so it may differ from what was recorded).
 */
export function isSameScreen(a: string, b: string): boolean {
  const normalize = (location: string) => {
    const [path, search = ""] = location.split("?");
    const params = new URLSearchParams(search);
    params.delete("node");
    params.sort();
    return `${path}?${params.toString()}`;
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
 * Updates the URL (`tab` in the path, the rest in the query). Pushes a
 * history entry unless `replace` or `back`; a no-op when nothing changes,
 * so it's safe to call from effects.
 */
export function setUrlParams(updates: UrlParamUpdates, options: SetUrlParamsOptions = {}): void {
  if (typeof window === "undefined") return;
  const { tab, ...queryUpdates } = updates;
  const pathname = window.location.pathname;
  const screen = parseScreenPath(pathname);
  const nextPathname =
    "tab" in updates && screen ? screenPathname(screen.base, tab == null || tab === "" ? null : String(tab)) : pathname;
  const search = window.location.search.replace(/^\?/, "");
  const nextSearch = applyUrlParams(search, queryUpdates, options.clear);
  if (nextPathname === pathname && nextSearch === search) return;
  const current = `${pathname}${search ? `?${search}` : ""}`;
  const next = `${nextPathname}${nextSearch ? `?${nextSearch}` : ""}`;
  const state = window.history.state as Record<string, unknown> | null;
  if (options.back && typeof state?.[PREV_KEY] === "string" && isSameScreen(state[PREV_KEY], next)) {
    // popstate (from Next's router listener and ours) updates subscribers.
    window.history.back();
    return;
  }
  const url = `${next}${window.location.hash}`;
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

/** The whole query string (no "?"; `tab` is in the path), live. */
export function useUrlSearch(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.search.replace(/^\?/, ""),
    () => "",
  );
}

/** Parses a bigint param, null when absent or malformed. */
export function parseBigintParam(value: string | null): bigint | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}
