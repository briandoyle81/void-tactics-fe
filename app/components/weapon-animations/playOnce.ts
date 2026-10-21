// Sounds (and shakes) that belong to one move play once, not on every loop
// of its replay or every time the board re-mounts it: true the first time
// `playKey` is seen under `storageKey` this browser session, then false.
// Remembers the last 50 keys per storageKey.
export function takeFirstPlay(storageKey: string, playKey: string): boolean {
  try {
    const played = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]") as string[];
    if (played.includes(playKey)) return false;
    sessionStorage.setItem(storageKey, JSON.stringify([...played.slice(-49), playKey]));
    return true;
  } catch {
    return true;
  }
}
