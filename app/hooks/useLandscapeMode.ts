import React from "react";

/**
 * A phone: narrow in portrait (≤500px wide) or short in landscape (≤500px
 * tall, under 1024px wide). Tablets don't match in either orientation, so
 * an iPad held upright gets the regular layout instead of a rotate prompt.
 */
export const PHONE_MEDIA_QUERY = "(max-width: 500px), (max-width: 1023px) and (max-height: 500px)";

export function useLandscapeMode() {
  const [isLandscapeMobile, setIsLandscapeMobile] = React.useState(false);
  const [requiresLandscapeMode, setRequiresLandscapeMode] =
    React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const orientationMq = window.matchMedia("(orientation: landscape)");
    const mobileMq = window.matchMedia(PHONE_MEDIA_QUERY);
    const sync = () => {
      const isMobile = mobileMq.matches;
      const isLandscape = orientationMq.matches;
      setRequiresLandscapeMode(isMobile && !isLandscape);
      setIsLandscapeMobile(isMobile && isLandscape);
    };
    sync();
    orientationMq.addEventListener("change", sync);
    mobileMq.addEventListener("change", sync);
    return () => {
      orientationMq.removeEventListener("change", sync);
      mobileMq.removeEventListener("change", sync);
    };
  }, []);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    type WebkitFullscreenDocument = Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    type WebkitFullscreenElement = HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const webkitDocument = document as WebkitFullscreenDocument;
    const isCurrentlyFullscreen = () =>
      Boolean(
        document.fullscreenElement || webkitDocument.webkitFullscreenElement,
      );

    if (!isLandscapeMobile) {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      } else if (webkitDocument.webkitFullscreenElement) {
        void Promise.resolve(
          webkitDocument.webkitExitFullscreen?.(),
        ).catch(() => {});
      }
      return;
    }

    if (isCurrentlyFullscreen()) return;

    const rootEl = document.documentElement as WebkitFullscreenElement;
    const tryEnterFullscreen = () => {
      if (isCurrentlyFullscreen()) return;
      const requestFullscreen =
        rootEl.requestFullscreen?.bind(rootEl) ??
        rootEl.webkitRequestFullscreen?.bind(rootEl);
      if (!requestFullscreen) return;
      void Promise.resolve(requestFullscreen()).catch(() => {});
    };

    const onFirstInteraction = () => {
      tryEnterFullscreen();
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("touchend", onFirstInteraction);
    };

    window.addEventListener("pointerdown", onFirstInteraction, {
      passive: true,
    });
    window.addEventListener("touchend", onFirstInteraction, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("touchend", onFirstInteraction);
    };
  }, [isLandscapeMobile]);

  return { isLandscapeMobile, requiresLandscapeMode };
}
