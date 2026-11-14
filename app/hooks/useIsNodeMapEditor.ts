"use client";

import { useRoles } from "../near/useRoles";
import { ROLE } from "../near/config";

// Campaign nodes are edited by NODE_EDITOR (or the owner) on the game contract.
export function useIsNodeMapEditor() {
  const roles = useRoles();
  return { isEditor: roles.has(ROLE.NODE_EDITOR), isLoading: roles.isLoading };
}
