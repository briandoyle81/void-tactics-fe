// Polling requests for the app-wide NEAR sync host (app/near/sync/NearSyncHost):
// NEAR has no log search, so open screens are kept fresh by polling their
// views; these let a screen ask for the fast cadence, or for a slow poll
// while the tab is hidden. Pure, so it's testable.

// Fast polling on request: screens waiting on another player (e.g. the
// lobby waiting for an opponent's fleet) ask for the match-speed interval
// while they wait.
const fastPollingSources = new Set<string>();
const listeners = new Set<() => void>();

export function setFastEventPolling(source: string, on: boolean): void {
  const had = fastPollingSources.has(source);
  if (on === had) return;
  if (on) fastPollingSources.add(source);
  else fastPollingSources.delete(source);
  listeners.forEach((listener) => listener());
}

export function isFastEventPollingRequested(): boolean {
  return fastPollingSources.size > 0;
}

export function subscribeFastEventPolling(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Hidden-tab turn watch: an open PvP match waiting on the opponent asks the
// host to keep a slow poll running while the tab is hidden, so the "your
// turn" cue still fires. Everything else stops polling in hidden tabs.
const hiddenTurnWatchSources = new Set<string>();

export function setHiddenTurnWatch(source: string, on: boolean): void {
  const had = hiddenTurnWatchSources.has(source);
  if (on === had) return;
  if (on) hiddenTurnWatchSources.add(source);
  else hiddenTurnWatchSources.delete(source);
  listeners.forEach((listener) => listener());
}

export function isHiddenTurnWatchRequested(): boolean {
  return hiddenTurnWatchSources.size > 0;
}
