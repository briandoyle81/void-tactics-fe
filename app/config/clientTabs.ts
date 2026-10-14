// The game client's top-level screens and their URL slugs. The slug is the
// path segment after PLAY_PATH (/play/operations), or the whole path on the
// play host (/operations; see app/utils/hostRouting.ts). Pure so proxy.ts
// can use it.

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

export const CLIENT_TAB_SLUG_LIST: readonly string[] = Object.values(CLIENT_TAB_SLUGS);

export function clientTabFromSlug(slug: string | null): ClientTab | null {
  if (!slug) return null;
  const entry = (Object.entries(CLIENT_TAB_SLUGS) as [ClientTab, string][]).find(([, s]) => s === slug);
  return entry ? entry[0] : null;
}
