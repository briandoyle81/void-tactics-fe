"use client";

import { useRoles } from "../near/useRoles";
import { ROLE } from "../near/config";

// AI fleet configs and map placements are edited by MAP_EDITOR (or the
// owner) on the game contract.
export function useIsEncounterEditor() {
  const roles = useRoles();
  return { isEditor: roles.has(ROLE.MAP_EDITOR), isLoading: roles.isLoading };
}
