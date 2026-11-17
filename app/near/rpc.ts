/**
 * The one NEAR RPC client. Views are plain JSON-RPC `call_function` queries
 * (no wallet needed); sends go through near-api-js (app/near/signers.ts).
 * Every request is counted in window.__vtRpcUsage (utils/rpcUsage.ts).
 */
import { FailoverRpcProvider, JsonRpcProvider } from "near-api-js";
import { NEAR_RPC_URLS, GAME_CONTRACT, RENDERER_CONTRACT } from "./config";
import { recordRpcMethod } from "../utils/rpcUsage";
import type { Views as GameViews } from "./generated/voidTactics";
import type { Views as RendererViews } from "./generated/voidRenderer";
import { NearContractError } from "./errors";

let provider: FailoverRpcProvider | JsonRpcProvider | null = null;

/**
 * Shared near-api-js provider (sends, tx status, access keys): every
 * endpoint in NEAR_RPC_URLS, failing over to the next when one errors.
 * Each retries a little itself first (near-api-js's default is 12 tries).
 */
export function getProvider(): FailoverRpcProvider | JsonRpcProvider {
  if (!provider) {
    const each = NEAR_RPC_URLS.map((url) => new JsonRpcProvider({ url }, { retries: 3, wait: 400, backoff: 1.5 }));
    provider = each.length > 1 ? new FailoverRpcProvider(each) : each[0];
  }
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

// The public RPCs rate-limit bursts (HTTP 429), and a 429 without CORS
// headers reaches the page as a bare network error ("NetworkError when
// attempting to fetch resource" / "Failed to fetch"). So views run at most
// MAX_IN_FLIGHT at a time, start on endpoints in turn (spreading load over
// each one's limit), and a rate-limited, 5xx or dropped request moves on to
// the next endpoint, backing off once it has tried them all.
// (Sends go through getProvider's failover.)
const MAX_IN_FLIGHT = 6;
const RETRIES = 5;
const RETRY_BASE_MS = 400;
let inFlight = 0;
const waiting: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function releaseSlot(): void {
  const next = waiting.shift();
  if (next) next();
  else inFlight--;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let nextEndpoint = 0;

async function postWithRetry(body: string): Promise<Response> {
  const start = nextEndpoint++ % NEAR_RPC_URLS.length;
  const tries = RETRIES * NEAR_RPC_URLS.length;
  for (let attempt = 0; ; attempt++) {
    const url = NEAR_RPC_URLS[(start + attempt) % NEAR_RPC_URLS.length];
    let res: Response | null = null;
    let networkError: unknown = null;
    await acquireSlot();
    try {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    } catch (e) {
      networkError = e;
    } finally {
      releaseSlot();
    }
    const retryable = networkError != null || (res != null && (res.status === 429 || res.status >= 500));
    if (!retryable || attempt >= tries) {
      if (networkError) throw networkError;
      return res!;
    }
    // Next endpoint right away; back off only after a full round of them.
    const round = Math.floor((attempt + 1) / NEAR_RPC_URLS.length);
    if ((attempt + 1) % NEAR_RPC_URLS.length === 0) {
      const retryAfter = Number(res?.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_BASE_MS * 2 ** (round - 1);
      await sleep(wait + Math.random() * 200);
    }
  }
}

async function rpc<T>(method: string, params: unknown, label: string): Promise<T> {
  recordRpcMethod(label);
  const res = await postWithRetry(JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }));
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
