"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

// Combat view (Settings › Combat, and the battle Menu): how a move's attack
// plays back. "cinematic" (the default) plays an attack on an enemy ship as
// two comic panels over the board (CombatCinematic); "board" plays the
// weapon on the board itself (MovePlaybackLayer). The on-board effects and
// sounds stay in place either way; cinematic only suppresses them while the
// panels play. Remembered in this browser and shared by every component
// through one store, like Debug mode (useDebugMode.ts).

export type CombatView = "cinematic" | "board";

const STORAGE_KEY = "vt-combat-view";
const CHANGE_EVENT = "vt-combat-view-change";

// This page's choice, used when storage is unavailable.
let pageSetting: CombatView = "cinematic";

function readCombatView(): CombatView {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "board" || stored === "cinematic" ? stored : pageSetting;
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

const getServerSnapshot = (): CombatView => "cinematic";

/**
 * A board that always plays combat one way, whatever the setting: the
 * website's hero demo plays its shot as the cinematic (on the board on phones).
 */
const CombatViewOverrideContext = createContext<CombatView | null>(null);
export const CombatViewOverride = CombatViewOverrideContext.Provider;

/** How this board plays an attack back. */
export function useCombatView(): CombatView {
  const override = useContext(CombatViewOverrideContext);
  const setting = useSyncExternalStore(subscribe, readCombatView, getServerSnapshot);
  return override ?? setting;
}

/** The Settings / battle Menu toggle. */
export function useCombatViewSetting() {
  const view = useSyncExternalStore(subscribe, readCombatView, getServerSnapshot);
  const setView = useCallback((next: CombatView) => {
    pageSetting = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable: setting lasts for this page only
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  const toggle = useCallback(() => setView(readCombatView() === "cinematic" ? "board" : "cinematic"), [setView]);
  return { view, setView, toggle };
}

/** The setting's name for players. */
export const COMBAT_VIEW_LABEL: Record<CombatView, string> = {
  cinematic: "Cinematic",
  board: "On-board",
};
