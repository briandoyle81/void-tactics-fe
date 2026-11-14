"use client";

/**
 * The player's NEAR session: who they are (the implicit account of their
 * Dynamic Solana embedded wallet), whether the account is set up, and the
 * one write funnel, `send`.
 *
 * Setup ("onboarding") is three steps, each skipped once done:
 *   1. fund: the faucet (/api/faucet/near) sends test NEAR, which creates
 *      the implicit account;
 *   2. session key: the wallet adds a function-call key for the game
 *      contract (sessionKey.ts), so gameplay is signed here with no prompt;
 *   3. storage: the wallet pays the first NEP-145 storage deposit.
 * Steps 2 and 3 are separate transactions (an AddKey goes to the player's
 * own account, storage_deposit to the game contract).
 *
 * `send` signs with the session key when it can (no deposit, game
 * contract, key on chain) and with the Dynamic wallet otherwise.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getAuthToken, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { Account, KeyPairSigner, actions, type KeyPair } from "near-api-js";
import {
  GAME_CONTRACT,
  GAS_DEFAULT,
  INITIAL_STORAGE_DEPOSIT,
  SESSION_KEY_ALLOWANCE,
  TGAS,
} from "./config";
import { getProvider, viewAccessKey, viewAccount, viewGame } from "./rpc";
import { implicitAccountFromSolanaAddress } from "./identity";
import { loadOrCreateSessionKey, loadSessionKey, clearSessionKey } from "./sessionKey";
import { DynamicNearSigner, type DynamicSolanaWalletLike } from "./dynamicSigner";
import { toReceipt, type NearOutcomeLike, type NearReceipt } from "./codec";
import { NearContractError, errorText } from "./errors";
import type { Calls } from "./generated/voidTactics";

/** One contract call to send. */
interface NearCallOptions {
  /** Attached yoctoNEAR. Any deposit (even 1 yocto) needs the wallet. */
  deposit?: bigint;
  gas?: bigint;
  /** Another contract than the game (always signed by the wallet). */
  contractId?: string;
}

/**
 * One call: a game method with its exact args (checked against the
 * generated ABI types), or a call on another contract (`contractId`) with
 * free-form args.
 */
export type NearCallSpec =
  | { [M in keyof Calls]: { method: M; args: Calls[M]["args"] } & NearCallOptions }[keyof Calls]
  | ({ method: string; args: Record<string, unknown>; contractId: string } & NearCallOptions);

export type OnboardingStep = "idle" | "funding" | "adding-key" | "registering" | "done" | "error";

export interface NearSessionState {
  /** The player's NEAR account (implicit account), when signed in with a Solana wallet. */
  accountId: string | null;
  /** The Dynamic Solana address behind it. */
  solanaAddress: string | null;
  status: "connecting" | "connected" | "disconnected";
  accountExists: boolean | null;
  sessionKeyReady: boolean | null;
  storageRegistered: boolean | null;
  /** All three setup steps are done. */
  isOnboarded: boolean;
  onboardingStep: OnboardingStep;
  onboardingError: string | null;
}

interface NearSessionApi extends NearSessionState {
  send: (spec: NearCallSpec) => Promise<NearReceipt>;
  /** Runs whichever setup steps are missing (wallet prompts for 2 and 3). */
  runOnboarding: () => Promise<void>;
  /** Re-reads account / key / storage state from chain. */
  refreshSetup: () => Promise<void>;
  logout: () => Promise<void>;
}

const NearSessionContext = createContext<NearSessionApi | null>(null);

/** Fired on window after every settled transaction (detail: NearSettledDetail), for app-wide refreshes. */
export const NEAR_TX_SETTLED_EVENT = "vt-near-tx-settled";

/** A settled transaction's receipt plus the method it called. */
export type NearSettledDetail = NearReceipt & { method: string };

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, jsonSafe(v)]));
  }
  return value;
}

function isAccessKeyProblem(err: unknown): boolean {
  const t = errorText(err);
  return (
    t.includes("NotEnoughAllowance") ||
    t.includes("InvalidAccessKeyError") ||
    t.includes("AccessKeyNotFound") ||
    t.includes("does not exist while viewing") ||
    t.includes("DepositWithFunctionCall") ||
    t.includes("ReceiverMismatch") ||
    t.includes("MethodNameMismatch")
  );
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export function NearSessionProvider({ children }: { children: React.ReactNode }) {
  const { primaryWallet, sdkHasLoaded, handleLogOut } = useDynamicContext();

  const solanaAddress = useMemo(() => {
    const w = primaryWallet as unknown as { address?: string; chain?: string } | null;
    if (!w?.address) return null;
    // Only the Solana (Ed25519) wallet maps to a NEAR account.
    const chain = String(w.chain ?? "").toUpperCase();
    if (chain && chain !== "SOL" && chain !== "SOLANA") return null;
    try {
      implicitAccountFromSolanaAddress(w.address);
      return w.address;
    } catch {
      return null;
    }
  }, [primaryWallet]);

  const accountId = useMemo(
    () => (solanaAddress ? implicitAccountFromSolanaAddress(solanaAddress) : null),
    [solanaAddress],
  );

  const [accountExists, setAccountExists] = useState<boolean | null>(null);
  const [sessionKeyReady, setSessionKeyReady] = useState<boolean | null>(null);
  const [storageRegistered, setStorageRegistered] = useState<boolean | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("idle");
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  // Signers/accounts for the current player, rebuilt when the wallet changes.
  const walletRef = useRef<DynamicSolanaWalletLike | null>(null);
  walletRef.current = solanaAddress ? (primaryWallet as unknown as DynamicSolanaWalletLike) : null;

  const walletAccount = useMemo(() => {
    if (!accountId || !solanaAddress) return null;
    return new Account(accountId, getProvider(), new DynamicNearSigner(walletRef.current!));
  }, [accountId, solanaAddress]);

  const sessionKeyRef = useRef<KeyPair | null>(null);
  const sessionAccount = useMemo(() => {
    if (!accountId) return null;
    const kp = loadSessionKey(accountId);
    sessionKeyRef.current = kp;
    return kp ? new Account(accountId, getProvider(), new KeyPairSigner(kp)) : null;
    // sessionKeyReady flips when onboarding adds a key, so the account is rebuilt with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, sessionKeyReady]);

  const refreshSetup = useCallback(async () => {
    if (!accountId) {
      setAccountExists(null);
      setSessionKeyReady(null);
      setStorageRegistered(null);
      return;
    }
    try {
      const acct = await viewAccount(accountId);
      setAccountExists(acct != null);
      if (!acct) {
        setSessionKeyReady(false);
        setStorageRegistered(false);
        return;
      }
      const kp = loadSessionKey(accountId);
      const key = kp ? await viewAccessKey(accountId, kp.getPublicKey().toString()) : null;
      const keyOk =
        !!key &&
        typeof key.permission === "object" &&
        key.permission.FunctionCall.receiver_id === GAME_CONTRACT;
      setSessionKeyReady(keyOk);
      const storage = await viewGame("storage_balance_of", { account_id: accountId });
      setStorageRegistered(storage != null);
    } catch (e) {
      console.warn("[near] setup check failed:", e);
    }
  }, [accountId]);

  useEffect(() => {
    void refreshSetup();
  }, [refreshSetup]);

  const sendWithWallet = useCallback(
    async (receiverId: string, actionList: ReturnType<typeof actions.functionCall>[]) => {
      if (!walletAccount) throw new Error("Sign in first");
      const outcome = (await walletAccount.signAndSendTransaction({
        receiverId,
        actions: actionList,
        waitUntil: "EXECUTED_OPTIMISTIC",
        throwOnFailure: false,
      })) as unknown as NearOutcomeLike;
      return toReceipt(outcome);
    },
    [walletAccount],
  );

  const runOnboarding = useCallback(async () => {
    if (!accountId || !solanaAddress) throw new Error("Sign in first");
    setOnboardingError(null);
    try {
      // 1. Fund (creates the implicit account).
      if (!(await viewAccount(accountId))) {
        setOnboardingStep("funding");
        const token = getAuthToken();
        const res = await fetch("/api/faucet/near", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ address: solanaAddress }),
        });
        const body = (await res.json().catch(() => ({}))) as { status?: string; reason?: string; error?: string };
        if (!res.ok || (body.status !== "sent" && body.status !== "already-claimed")) {
          throw new Error(body.error ?? body.reason ?? "The faucet couldn't fund your account");
        }
        for (let i = 0; i < 20 && !(await viewAccount(accountId)); i++) await sleep(1500);
        if (!(await viewAccount(accountId))) throw new Error("Your account isn't funded yet. Try again in a minute.");
      }
      setAccountExists(true);

      // 2. Session key.
      const kp = loadOrCreateSessionKey(accountId);
      sessionKeyRef.current = kp;
      const pk = kp.getPublicKey();
      const onChain = await viewAccessKey(accountId, pk.toString());
      if (!onChain) {
        setOnboardingStep("adding-key");
        const receipt = await sendWithWallet(accountId, [
          actions.addFunctionCallAccessKey(pk, GAME_CONTRACT, [], SESSION_KEY_ALLOWANCE),
        ]);
        if (!receipt.success) throw new NearContractError(receipt.failure ?? "Adding the session key failed");
      }
      setSessionKeyReady(true);

      // 3. Storage.
      const storage = await viewGame("storage_balance_of", { account_id: accountId });
      if (!storage) {
        setOnboardingStep("registering");
        const receipt = await sendWithWallet(GAME_CONTRACT, [
          actions.functionCall(
            "storage_deposit",
            { account_id: null, registration_only: false },
            BigInt(30) * TGAS,
            INITIAL_STORAGE_DEPOSIT,
          ),
        ]);
        if (!receipt.success) throw new NearContractError(receipt.failure ?? "Storage registration failed");
      }
      setStorageRegistered(true);
      setOnboardingStep("done");
    } catch (e) {
      setOnboardingStep("error");
      setOnboardingError(errorText(e).slice(0, 300));
      throw e;
    }
  }, [accountId, solanaAddress, sendWithWallet]);

  const send = useCallback(
    async (spec: NearCallSpec): Promise<NearReceipt> => {
      if (!accountId) throw new Error("Sign in first");
      const receiverId = spec.contractId ?? GAME_CONTRACT;
      const deposit = spec.deposit ?? BigInt(0);
      const action = actions.functionCall(
        spec.method,
        jsonSafe(spec.args ?? {}) as object,
        spec.gas ?? GAS_DEFAULT,
        deposit,
      );
      const canUseSessionKey =
        receiverId === GAME_CONTRACT && deposit === BigInt(0) && sessionKeyReady === true && !!sessionAccount;

      let receipt: NearReceipt;
      if (canUseSessionKey) {
        try {
          const outcome = (await sessionAccount!.signAndSendTransaction({
            receiverId,
            actions: [action],
            waitUntil: "EXECUTED_OPTIMISTIC",
            throwOnFailure: false,
          })) as unknown as NearOutcomeLike;
          receipt = toReceipt(outcome);
        } catch (e) {
          if (!isAccessKeyProblem(e)) throw e;
          // Key missing or out of allowance: send this one with the wallet,
          // and let onboarding add a fresh key next time.
          setSessionKeyReady(false);
          clearSessionKey(accountId);
          receipt = await sendWithWallet(receiverId, [action]);
        }
      } else {
        receipt = await sendWithWallet(receiverId, [action]);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent<NearSettledDetail>(NEAR_TX_SETTLED_EVENT, { detail: { ...receipt, method: spec.method } }),
        );
      }
      if (!receipt.success) throw new NearContractError(receipt.failure ?? "Transaction failed");
      return receipt;
    },
    [accountId, sessionAccount, sessionKeyReady, sendWithWallet],
  );

  const logout = useCallback(async () => {
    await handleLogOut();
  }, [handleLogOut]);

  const status: NearSessionState["status"] = !sdkHasLoaded
    ? "connecting"
    : accountId
      ? "connected"
      : "disconnected";

  const value = useMemo<NearSessionApi>(
    () => ({
      accountId,
      solanaAddress,
      status,
      accountExists,
      sessionKeyReady,
      storageRegistered,
      isOnboarded: accountExists === true && sessionKeyReady === true && storageRegistered === true,
      onboardingStep,
      onboardingError,
      send,
      runOnboarding,
      refreshSetup,
      logout,
    }),
    [
      accountId,
      solanaAddress,
      status,
      accountExists,
      sessionKeyReady,
      storageRegistered,
      onboardingStep,
      onboardingError,
      send,
      runOnboarding,
      refreshSetup,
      logout,
    ],
  );

  return <NearSessionContext.Provider value={value}>{children}</NearSessionContext.Provider>;
}

export function useNearSession(): NearSessionApi {
  const ctx = useContext(NearSessionContext);
  if (!ctx) throw new Error("useNearSession must be used inside NearSessionProvider");
  return ctx;
}

/** Same session, or null outside the provider (the website has no providers). */
export function useOptionalNearSession(): NearSessionApi | null {
  return useContext(NearSessionContext);
}
