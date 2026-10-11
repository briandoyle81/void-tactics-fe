// Generic dialog lines a player chose not to see again ("Don't show again"
// on a line with canHide: true, see genericDialog.ts). Per device, in
// localStorage: a viewing preference, not game state.

const STORAGE_KEY = "vt-hidden-dialog-lines-v1";

export function getHiddenDialogLineIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function setDialogLineHidden(lineId: string, hidden: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const ids = getHiddenDialogLineIds();
    if (hidden) ids.add(lineId);
    else ids.delete(lineId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage unavailable: the line just keeps showing.
  }
}
