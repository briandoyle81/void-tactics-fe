import { CLIENT_TAB_SLUG_LIST } from "../config/clientTabs";
import { ADMIN_PATH, PLAY_PATH } from "../config/routes";

export type HostRouteDecision =
  /** Serve the path as requested. */
  | { type: "next"; noIndex: boolean }
  /** Serve a different path under the same URL. */
  | { type: "rewrite"; pathname: string; noIndex: boolean }
  /** Send the browser elsewhere; `url` is absolute or root-relative. */
  | { type: "redirect"; url: string };

export interface HostRoutingConfig {
  /** Origin of the game client host, e.g. https://play.voidtactics.xyz. */
  playUrl?: string;
  /** Origin of the website, e.g. https://voidtactics.xyz. */
  siteUrl?: string;
}

/** Paths that belong to the game client rather than the website. */
const CLIENT_PATH = /^\/(?:play|admin|tournaments)(?:\/|$)|^\/\d+\/?$/;

/**
 * Old links kept the tab in the query (`/play?tab=operations`); it's in the
 * path now (`/play/operations`). Returns the new path and query for such a
 * link, or null. `root` is where the client is served at "/" (the play
 * host).
 */
function moveTabToPath(
  pathname: string,
  search: string,
  root: boolean,
): { pathname: string; search: string } | null {
  if (pathname !== PLAY_PATH && pathname !== ADMIN_PATH && !(root && pathname === "/")) return null;
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  if (!tab || !/^[a-z-]+$/.test(tab)) return null;
  params.delete("tab");
  const rest = params.toString();
  return { pathname: `${pathname === "/" ? "" : pathname}/${tab}`, search: rest ? `?${rest}` : "" };
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Decides how a request is routed between the website and the game client.
 *
 * - On the play host, "/" serves the client, "/<tab>" its tabs
 *   (/play/<tab>), and every page is marked no-index.
 * - On the site host (and its www), client paths (/play, /admin,
 *   /tournaments, /<gameId>) and old `/?chain=` links redirect to the play
 *   host.
 * - Anywhere else (local dev, previews, or no play host configured), the
 *   client stays at /play and `/?chain=` links redirect there.
 * - Old `?tab=` links redirect to the tab's path (see moveTabToPath).
 *
 * Pure so it can be tested; proxy.ts applies the decision.
 */
export function resolveHostRoute(
  host: string,
  pathname: string,
  search: string,
  config: HostRoutingConfig,
): HostRouteDecision {
  const playHost = hostOf(config.playUrl);
  const hasChainParam = new URLSearchParams(search).has("chain");

  if (playHost && host === playHost) {
    const moved = moveTabToPath(pathname, search, true);
    if (moved) return { type: "redirect", url: `${moved.pathname}${moved.search}` };
    if (pathname === "/") return { type: "rewrite", pathname: PLAY_PATH, noIndex: true };
    // A client tab. This shadows the standalone /tournaments list on this
    // host; /tournaments/<id> still serves its own page.
    const segment = pathname.slice(1);
    if (CLIENT_TAB_SLUG_LIST.includes(segment)) {
      return { type: "rewrite", pathname: `${PLAY_PATH}/${segment}`, noIndex: true };
    }
    return { type: "next", noIndex: true };
  }

  const siteHost = hostOf(config.siteUrl);
  const isSiteHost = siteHost !== null && (host === siteHost || host === `www.${siteHost}`);

  if (playHost && isSiteHost) {
    const playOrigin = new URL(config.playUrl!).origin;
    if (CLIENT_PATH.test(pathname)) {
      const moved = moveTabToPath(pathname, search, false) ?? { pathname, search };
      const isPlayPath = moved.pathname === PLAY_PATH || moved.pathname.startsWith(`${PLAY_PATH}/`);
      const target = isPlayPath ? moved.pathname.slice(PLAY_PATH.length) || "/" : moved.pathname;
      return { type: "redirect", url: `${playOrigin}${target}${moved.search}` };
    }
    if (pathname === "/" && hasChainParam) {
      return { type: "redirect", url: `${playOrigin}/${search}` };
    }
    return { type: "next", noIndex: false };
  }

  if (pathname === "/" && hasChainParam) {
    return { type: "redirect", url: `${PLAY_PATH}${search}` };
  }
  const moved = moveTabToPath(pathname, search, false);
  if (moved) return { type: "redirect", url: `${moved.pathname}${moved.search}` };
  return { type: "next", noIndex: false };
}
