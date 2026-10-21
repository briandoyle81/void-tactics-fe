import { CLIENT_TAB_SLUG_LIST } from "../../../config/clientTabs";
import GameClient from "../GameClient";

// A game client tab (/play/operations, ...): the same page as /play, which
// reads the tab from the URL. Unknown slugs 404.

export const dynamicParams = false;

export function generateStaticParams() {
  return CLIENT_TAB_SLUG_LIST.map((tab) => ({ tab }));
}

export default function PlayTabPage() {
  return <GameClient />;
}
