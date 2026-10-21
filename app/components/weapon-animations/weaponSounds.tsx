"use client";

import { createContext, useContext } from "react";

// Weapon animations play their sounds (missile launch, laser snaps) unless a
// board turns them off: the website's hero demo loops a battle on its own,
// and visitors shouldn't hear it.
const WeaponSoundsMutedContext = createContext(false);

export const WeaponSoundsMuted = WeaponSoundsMutedContext.Provider;

export function useWeaponSoundsMuted(): boolean {
  return useContext(WeaponSoundsMutedContext);
}
