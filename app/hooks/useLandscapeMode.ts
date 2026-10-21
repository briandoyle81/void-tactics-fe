import React from "react";
import { exitFullscreen, isFullscreen } from "../utils/fullscreen";

/**
 * A phone: narrow in portrait (≤500px wide) or short in landscape (≤500px
 * tall, under 1024px wide). Tablets don't match in either orientation, so
 * an iPad held upright gets the regular layout instead of a rotate prompt.
 */
export const PHONE_MEDIA_QUERY = "(max-width: 500px), (max-width: 1023px) and (max-height: 500px)";

/**
 * A tablet held upright: portrait and up to 1024px wide (a 12.9" iPad Pro),
 * but not a phone. The battle views stack their side rail under the board
 * for it (see gameViewSideChrome), since side by side the board only filled
 * the top third of the screen.
 */
export const TABLET_PORTRAIT_MEDIA_QUERY = "(max-width: 1024px) and (orientation: portrait)";

// Bit flags for the layout snapshot, so useSyncExternalStore gets a stable
// primitive to compare.
const REQUIRES_LANDSCAPE = 1;
const LANDSCAPE_MOBILE = 2;
const PORTRAIT_TABLET = 4;

let layoutQueries: MediaQueryList[] | null = null;
function getLayoutQueries() {
  layoutQueries ??= [
    window.matchMedia("(orientation: landscape)"),
    window.matchMedia(PHONE_MEDIA_QUERY),
    window.matchMedia(TABLET_PORTRAIT_MEDIA_QUERY),
  ];
  return layoutQueries;
}

function getLayoutSnapshot() {
  const [orientationMq, mobileMq, tabletPortraitMq] = getLayoutQueries();
  const isMobile = mobileMq.matches;
  const isLandscape = orientationMq.matches;
  return (
    (isMobile && !isLandscape ? REQUIRES_LANDSCAPE : 0) |
    (isMobile && isLandscape ? LANDSCAPE_MOBILE : 0) |
    (!isMobile && tabletPortraitMq.matches ? PORTRAIT_TABLET : 0)
  );
}

// The server can't know the screen, so it renders the desktop layout.
const getServerLayoutSnapshot = () => 0;

function subscribeToLayout(onChange: () => void) {
  const queries = getLayoutQueries();
  queries.forEach((mq) => mq.addEventListener("change", onChange));
  return () => queries.forEach((mq) => mq.removeEventListener("change", onChange));
}

export function useLandscapeMode() {
  // Read during render (not in an effect), so a battle view mounting on a
  // phone draws the phone layout on its first frame instead of flashing the
  // desktop one.
  const layout = React.useSyncExternalStore(
    subscribeToLayout,
    getLayoutSnapshot,
    getServerLayoutSnapshot,
  );
  const requiresLandscapeMode = (layout & REQUIRES_LANDSCAPE) !== 0;
  const isLandscapeMobile = (layout & LANDSCAPE_MOBILE) !== 0;
  const isPortraitTablet = (layout & PORTRAIT_TABLET) !== 0;

  // Leaving the landscape battle layout (rotated upright, or left the
  // battle) leaves fullscreen too. Going fullscreen is the player's choice,
  // from FullscreenPrompt, since browsers only allow it from a tap.
  React.useEffect(() => {
    if (!isLandscapeMobile && isFullscreen()) exitFullscreen();
  }, [isLandscapeMobile]);

  return { isLandscapeMobile, requiresLandscapeMode, isPortraitTablet };
}
