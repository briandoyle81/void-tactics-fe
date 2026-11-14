"use client";

/**
 * The write funnel for components: sends one contract call through the
 * NEAR session (session key when possible, else the Dynamic wallet) and
 * tracks pending/error state. Replaces useSponsoredWriteContract.
 *
 * Unlike EVM writes there is no separate "wait for receipt" step: the call
 * resolves with the executed transaction (NearReceipt: hash, success,
 * return value, events). A failed transaction rejects with
 * NearContractError, whose `errorName` is the contract's error.
 */
import { useCallback, useState } from "react";
import { useNearSession, type NearCallSpec } from "./session";
import type { NearReceipt } from "./codec";

export function useNearCall() {
  const { send } = useNearSession();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<NearReceipt | null>(null);

  const call = useCallback(
    async (spec: NearCallSpec): Promise<NearReceipt> => {
      setIsPending(true);
      setError(null);
      try {
        const receipt = await send(spec);
        setData(receipt);
        return receipt;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [send],
  );

  const reset = useCallback(() => {
    setError(null);
    setData(null);
  }, []);

  return { call, isPending, error, data, reset };
}

export type { NearCallSpec, NearReceipt };
