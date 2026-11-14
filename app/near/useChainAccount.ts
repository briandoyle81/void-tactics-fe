"use client";

/**
 * The signed-in player, in the shape the screens used to get from wagmi's
 * useAccount: `address` is now the NEAR account id (a 64-hex implicit
 * account), `isConnected`/`status` as before. `isOnboarded` says the account
 * is funded, has its session key and has registered storage
 * (app/near/session.tsx).
 *
 * Safe outside the NEAR providers (the website): reports disconnected.
 */
import { useOptionalNearSession } from "./session";
import type { Address } from "../types/chain";

export interface ChainAccount {
  address: Address | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  status: "connecting" | "connected" | "disconnected";
  isOnboarded: boolean;
}

export function useChainAccount(): ChainAccount {
  const session = useOptionalNearSession();
  const status = session?.status ?? "disconnected";
  const address = session?.accountId ?? undefined;
  return {
    address,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    isDisconnected: status === "disconnected",
    status,
    isOnboarded: session?.isOnboarded ?? false,
  };
}
