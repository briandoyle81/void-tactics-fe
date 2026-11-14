/**
 * The one NEAR RPC client. Views are plain JSON-RPC `call_function` queries
 * (no wallet needed); sends go through near-api-js (app/near/signers.ts).
 * Every request is counted in window.__vtRpcUsage (utils/rpcUsage.ts).
 */
import { JsonRpcProvider } from "near-api-js";
import { NEAR_RPC_URL, GAME_CONTRACT, RENDERER_CONTRACT } from "./config";
import { recordRpcMethod } from "../utils/rpcUsage";
import type { Views as GameViews } from "./generated/voidTactics";
import type { Views as RendererViews } from "./generated/voidRenderer";
import { NearContractError } from "./errors";

let provider: JsonRpcProvider | null = null;

/** Shared near-api-js provider (sends, tx status, access keys). */
export function getProvider(): JsonRpcProvider {
  if (!provider) provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
  return provider;
}

function encodeArgs(args: unknown): string {
  const json = JSON.stringify(args ?? {}, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * JSON.parse, except integers too large for a JS number (raw u64 fields such
 * as map bitmap words) come back as decimal strings instead of losing
 * precision. Callers convert with codec.toBig.
 */
export function parseJsonKeepingBigInts(text: string): unknown {
  const safe = text.replace(/([:[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g, (m, pre: string, num: string) =>
    Number.isSafeInteger(Number(num)) ? m : `${pre}"${num}"`,
  );
  return JSON.parse(safe);
}

let requestId = 0;

async function rpc<T>(method: string, params: unknown, label: string): Promise<T> {
  recordRpcMethod(label);
  const res = await fetch(NEAR_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
  });
  if (!res.ok) throw new Error(`NEAR RPC ${res.status}: ${await res.text().catch(() => "")}`);
  const body = (await res.json()) as { result?: T & { error?: string }; error?: unknown };
  if (body.error) throw new NearContractError(JSON.stringify(body.error));
  if (body.result && typeof body.result === "object" && "error" in body.result && body.result.error) {
    throw new NearContractError(String(body.result.error));
  }
  return body.result as T;
}

/** Raw view call on any contract. Prefer the typed `viewGame` / `viewRenderer`. */
export async function viewRaw<T>(contractId: string, method: string, args: object = {}): Promise<T> {
  const result = await rpc<{ result: number[] }>(
    "query",
    {
      request_type: "call_function",
      finality: "optimistic",
      account_id: contractId,
      method_name: method,
      args_base64: encodeArgs(args),
    },
    `view:${method}`,
  );
  const text = new TextDecoder().decode(new Uint8Array(result.result));
  return (text ? parseJsonKeepingBigInts(text) : null) as T;
}

/** Typed view on the game contract. */
export function viewGame<M extends keyof GameViews>(
  method: M,
  args: GameViews[M]["args"],
): Promise<GameViews[M]["result"]> {
  return viewRaw(GAME_CONTRACT, method, args);
}

/** Typed view on the renderer contract. */
export function viewRenderer<M extends keyof RendererViews>(
  method: M,
  args: RendererViews[M]["args"],
): Promise<RendererViews[M]["result"]> {
  return viewRaw(RENDERER_CONTRACT, method, args);
}

export interface NearAccountView {
  amount: string;
  locked: string;
  storage_usage: number;
}

/** `view_account`, or null when the account doesn't exist yet (an unfunded implicit account). */
export async function viewAccount(accountId: string): Promise<NearAccountView | null> {
  try {
    return await rpc<NearAccountView>(
      "query",
      { request_type: "view_account", finality: "optimistic", account_id: accountId },
      "view_account",
    );
  } catch (e) {
    if (String(e).includes("UNKNOWN_ACCOUNT") || String(e).includes("does not exist")) return null;
    throw e;
  }
}

export interface NearAccessKeyView {
  nonce: number;
  permission:
    | "FullAccess"
    | { FunctionCall: { allowance: string | null; receiver_id: string; method_names: string[] } };
}

/** `view_access_key`, or null when the key isn't on the account. */
export async function viewAccessKey(accountId: string, publicKey: string): Promise<NearAccessKeyView | null> {
  try {
    return await rpc<NearAccessKeyView>(
      "query",
      { request_type: "view_access_key", finality: "optimistic", account_id: accountId, public_key: publicKey },
      "view_access_key",
    );
  } catch (e) {
    if (String(e).includes("UNKNOWN_ACCESS_KEY") || String(e).includes("does not exist")) return null;
    throw e;
  }
}
