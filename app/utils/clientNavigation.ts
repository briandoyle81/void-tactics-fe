import { CLIENT_TAB_SLUGS, type ClientTab } from "../config/clientTabs";
import { PLAY_PATH } from "../config/routes";
import { applyUrlParams, CLIENT_CHILD_PARAMS, getUrlParam, setUrlParams, type UrlParamUpdates } from "./urlState";

export { CLIENT_TAB_SLUGS, clientTabFromSlug, type ClientTab } from "../config/clientTabs";

// The game client (app/(client)/play/GameClient.tsx) keeps its screen in the URL (see
// urlState.ts): the tab in the path (/play/<slug>) plus whatever the screen
// adds to the query. Inside the client, navigation pushes history entries;
// from pages without it (Ops Console, spectator) it loads the same URL.

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

/** The URL for `tab` and its params: /play/<slug>?<params>. */
export function clientTabHref(tab: ClientTab, params: UrlParamUpdates = {}): string {
  const search = applyUrlParams("", params);
  return `${PLAY_PATH}/${CLIENT_TAB_SLUGS[tab]}${search ? `?${search}` : ""}`;
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
