"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { viewAccount } from "./rpc";
import { formatNear } from "./codec";

/** yoctoNEAR per byte of account storage (protocol storage price: 1 NEAR per 100 KB). */
const STORAGE_PRICE_PER_BYTE = BigInt(10) ** BigInt(19);

export const NEAR_BALANCE_ROOT = "near-balance";

/**
 * An account's spendable NEAR (wagmi useBalance's shape: `value` in
 * yoctoNEAR, `formatted`, `symbol`). Spendable = balance minus what the
 * account's own storage locks; a missing (unfunded) account reads 0.
 */
export function useNearBalance(accountId: string | undefined) {
  const query = useQuery({
    queryKey: [NEAR_BALANCE_ROOT, accountId ?? ""],
    queryFn: () => viewAccount(accountId!),
    enabled: !!accountId,
    staleTime: 15_000,
  });
  const data = useMemo(() => {
    if (query.data === undefined) return undefined;
    const acct = query.data;
    if (!acct) return { value: BigInt(0), formatted: "0", symbol: "NEAR", decimals: 24 };
    const locked = BigInt(acct.storage_usage) * STORAGE_PRICE_PER_BYTE;
    const amount = BigInt(acct.amount);
    const value = amount > locked ? amount - locked : BigInt(0);
    return { value, formatted: formatNear(value), symbol: "NEAR", decimals: 24 };
  }, [query.data]);
  return { ...query, data };
}
