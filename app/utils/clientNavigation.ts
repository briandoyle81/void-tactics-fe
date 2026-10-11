import { PLAY_PATH } from "../config/routes";
import { applyUrlParams, CLIENT_CHILD_PARAMS, getUrlParam, setUrlParams, type UrlParamUpdates } from "./urlState";

// The game client (app/play/page.tsx) keeps its screen in the URL (see
// urlState.ts): `?tab=<slug>` plus whatever the screen adds. Inside the
// client, navigation pushes history entries; from pages without it (Ops
// Console, spectator) it loads PLAY_PATH with the same query.

/** Top-level client screens (the names older builds saved, kept as-is). */
export type ClientTab =
  | "Command Deck"
  | "Mission"
  | "Lobbies"
  | "Tournaments"
  | "Games"
  | "Manage Navy"
  | "Store"
  | "Profile";

/** URL slug for each tab. */
export const CLIENT_TAB_SLUGS: Record<ClientTab, string> = {
  "Command Deck": "deck",
  Mission: "operations",
  Lobbies: "skirmish",
  Tournaments: "tournaments",
  Games: "battles",
  "Manage Navy": "fleet",
  Store: "store",
  Profile: "profile",
};

export function clientTabFromSlug(slug: string | null): ClientTab | null {
  if (!slug) return null;
  const entry = (Object.entries(CLIENT_TAB_SLUGS) as [ClientTab, string][]).find(([, s]) => s === slug);
  return entry ? entry[0] : null;
}

/**
 * Inside the client: switch to `tab` (a new history entry unless
 * `replace`). Changing tab drops the previous screen's params; `params`
 * adds the new screen's (e.g. `{ section: "credits" }`, `{ game: 12 }`).
 */
export function openClientTab(
  tab: ClientTab,
  options: { params?: UrlParamUpdates; replace?: boolean } = {},
): void {
  const slug = CLIENT_TAB_SLUGS[tab];
  const sameTab = getUrlParam("tab") === slug;
  setUrlParams(
    { tab: slug, ...options.params },
    { replace: options.replace, clear: sameTab ? [] : CLIENT_CHILD_PARAMS },
  );
}

/** PLAY_PATH with the query for `tab` and its params. */
export function clientTabHref(tab: ClientTab, params: UrlParamUpdates = {}): string {
  const search = applyUrlParams("", { tab: CLIENT_TAB_SLUGS[tab], ...params });
  return `${PLAY_PATH}?${search}`;
}

/** Set by the game client while it's mounted. */
export function setGameClientMounted(mounted: boolean): void {
  if (typeof document === "undefined") return;
  if (mounted) document.documentElement.dataset.vtGameClient = "1";
  else delete document.documentElement.dataset.vtGameClient;
}

/**
 * Opens `tab` in the game client: fires `eventName` (with `detail`, e.g.
 * `{ section: "credits" }`) when the client is on screen, otherwise
 * navigates to it with `push` (a router push) or a full page load.
 */
export function navigateToClientTab(
  tab: ClientTab,
  eventName: string,
  push?: (href: string) => void,
  detail?: Record<string, string>,
): void {
  if (typeof window === "undefined") return;
  if (document.documentElement.dataset.vtGameClient === "1") {
    window.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail }));
    document.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail }));
    return;
  }
  const href = clientTabHref(tab, detail?.section ? { section: detail.section } : {});
  if (push) push(href);
  else window.location.assign(href);
}
