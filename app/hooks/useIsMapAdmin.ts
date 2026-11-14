"use client";

import { useRoles } from "../near/useRoles";
import { ROLE } from "../near/config";

/** Map geometry editing: MAP_EDITOR role or the contract owner. */
export function useIsMapAdmin(): boolean {
  return useRoles().has(ROLE.MAP_EDITOR);
}
