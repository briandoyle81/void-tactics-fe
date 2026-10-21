// Fullscreen for the battle views on phones (FullscreenPrompt,
// useLandscapeMode). Safari still uses the webkit-prefixed API, and the
// iPhone has none at all for pages, so callers check fullscreenSupported().

type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export const FULLSCREEN_CHANGE_EVENTS = ["fullscreenchange", "webkitfullscreenchange"] as const;

export function fullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as WebkitDocument;
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as WebkitDocument;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}

/** Already full screen as an installed app (home-screen shortcut). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches;
}

/** Must run from a tap (browsers only allow it in response to one). */
export function enterFullscreen(): Promise<void> {
  const el = document.documentElement as WebkitElement;
  const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
  if (!request) return Promise.resolve();
  return Promise.resolve(request()).catch(() => {});
}

export function exitFullscreen(): void {
  const d = document as WebkitDocument;
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else if (d.webkitFullscreenElement) void Promise.resolve(d.webkitExitFullscreen?.()).catch(() => {});
}
