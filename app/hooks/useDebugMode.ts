"use client";

import { useCallback, useSyncExternalStore } from "react";

// Debug mode (Settings › Developer › Debug mode). Off by default; while it's
// off every debug control is hidden: cache resets, the battle debug panel,
// the tutorial card's step-skip checkbox, raw board coordinates and art-slot
// labels. The setting is remembered in this browser and shared by every
// component through one store, so flipping it updates the whole page.

const STORAGE_KEY = "vt-debug-mode";
const CHANGE_EVENT = "vt-debug-mode-change";

// This page's choice, used when storage is unavailable.
let pageSetting = false;

function readDebugMode(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? pageSetting : stored === "1";
  } catch {
    return pageSetting;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const getServerSnapshot = () => false;

/** Whether debug UI is shown. */
export function useDebugMode(): boolean {
  return useSyncExternalStore(subscribe, readDebugMode, getServerSnapshot);
}

/** The Settings toggle. */
export function useDebugModeSetting() {
  const enabled = useDebugMode();
  const toggle = useCallback(() => {
    const next = !readDebugMode();
    pageSetting = next;
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // storage unavailable: setting lasts for this page only
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return { enabled, toggle };
}
