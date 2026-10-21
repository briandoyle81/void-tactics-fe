// Top-level routes for the website / game client split.
//
// The website (marketing) lives at "/", the game client at PLAY_PATH and the
// admin Ops Console at ADMIN_PATH. When NEXT_PUBLIC_PLAY_URL is set (e.g.
// https://play.voidtactics.xyz), proxy.ts also serves the client at "/" on
// that host and redirects client paths on the site host to it — see
// app/utils/hostRouting.ts. Links inside the app always use these paths;
// they work on every host.

/** The game client. */
export const PLAY_PATH = "/play";

/** Admin tools: maps, AI encounters, ship attributes, purchase prices. */
export const ADMIN_PATH = "/admin";

/** Ops Console › Reward Ships, optionally opened on one roguelike node. */
export function rewardShipsAdminHref(nodeId?: number): string {
  return `${ADMIN_PATH}/reward-ships${nodeId != null ? `?node=${nodeId}` : ""}`;
}

/** Ops Console › Admin, where the mission seed files (and the reward ship app copy) are exported. */
export function missionSeedExportHref(): string {
  return `${ADMIN_PATH}/admin`;
}

/**
 * The website's home page, for links out of the game client. With a
 * separate play host (NEXT_PUBLIC_PLAY_URL), "/" there is the client, so
 * this is the site host; otherwise the website is "/" on this host.
 */
export const WEBSITE_HREF = process.env.NEXT_PUBLIC_PLAY_URL
  ? (process.env.NEXT_PUBLIC_SITE_URL ?? "https://voidtactics.xyz")
  : "/";
