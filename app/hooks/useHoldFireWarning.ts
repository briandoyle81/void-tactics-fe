"use client";

import { useCallback, useSyncExternalStore } from "react";

// Hold fire warning (Settings › Combat, and the battle Menu): before a ship
// holds fire while a target is in range of where it ends its move, ask the
// player to confirm (HoldFireConfirm). On by default; the confirmation's
// "Don't ask again" turns it off. Remembered in this browser and shared by
// every component through one store, like Combat view (useCombatView.ts).

const STORAGE_KEY = "vt-hold-fire-warning";
const CHANGE_EVENT = "vt-hold-fire-warning-change";

// This page's choice, used when storage is unavailable.
let pageSetting = true;

function readEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "off" ? false : stored === "on" ? true : pageSetting;
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

const getServerSnapshot = () => true;

/** Whether to confirm before holding fire with a target in range, and the Settings / battle Menu toggle. */
export function useHoldFireWarningSetting() {
  const enabled = useSyncExternalStore(subscribe, readEnabled, getServerSnapshot);
  const setEnabled = useCallback((next: boolean) => {
    pageSetting = next;
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // storage unavailable: setting lasts for this page only
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  const toggle = useCallback(() => setEnabled(!readEnabled()), [setEnabled]);
  return { enabled, setEnabled, toggle };
}
