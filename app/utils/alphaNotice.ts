"use client";

import { useSyncExternalStore } from "react";

// Open/closed state of the Alpha notice (AlphaNoticeModal), shared so the
// [ALPHA] badges can open it.

const SEEN_KEY = "vt-alpha-notice-seen-v1";

let open = false;
const listeners = new Set<() => void>();

function setOpen(next: boolean) {
  if (open === next) return;
  open = next;
  listeners.forEach((l) => l());
}

export function openAlphaNotice() {
  setOpen(true);
}

/** Closes the notice and remembers it was seen, so it doesn't open on its own again. */
export function closeAlphaNotice() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage blocked: it may show again next visit */
  }
  setOpen(false);
}

/** Opens the notice on a first visit. Call once on mount. */
export function openAlphaNoticeIfFirstVisit() {
  try {
    if (localStorage.getItem(SEEN_KEY) === "1") return;
  } catch {
    return;
  }
  setOpen(true);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAlphaNoticeOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false);
}
