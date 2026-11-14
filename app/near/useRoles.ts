"use client";

import { useMemo } from "react";
import { useNearView } from "./useNearView";
import { useChainAccount } from "./useChainAccount";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";

/**
 * The signed-in account's admin standing on the game contract: whether it's
 * the owner (who passes every role check) and its role bits (config.ts ROLE).
 */
export function useRoles() {
  const { address } = useChainAccount();
  const args = useMemo(() => (address ? { account_id: address } : null), [address]);
  const roles = useNearView("get_roles", args, { staleTime: ADMIN_DATA_STALE_MS });
  const owner = useNearView("owner_id", {}, { staleTime: ADMIN_DATA_STALE_MS });
  const isOwner = !!address && owner.data === address;
  const bits = roles.data ?? 0;
  return {
    isOwner,
    bits,
    /** Owner, or holds any of `roleBits`. */
    has: (roleBits: number) => isOwner || (bits & roleBits) !== 0,
    isLoading: roles.isLoading || owner.isLoading,
  };
}
