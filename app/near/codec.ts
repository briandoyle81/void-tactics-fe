/**
 * Encoding helpers for NEAR data: transaction outcomes (success, return
 * value, NEP-297 events) and yoctoNEAR amounts.
 */
import { YOCTO_PER_NEAR } from "./config";

/** One NEP-297 event (`EVENT_JSON:` log). `data` is the first element of the event's data array. */
export interface NearEvent<D = Record<string, unknown>> {
  standard: string;
  version: string;
  event: string;
  data: D;
}

/** The parts of an RPC transaction result this app reads. */
export interface NearOutcomeLike {
  transaction?: { hash?: string };
  transaction_outcome?: { id?: string; outcome?: { logs?: string[]; status?: unknown } };
  receipts_outcome?: Array<{ id?: string; outcome?: { logs?: string[]; status?: unknown } }>;
  status?: unknown;
}

/** A settled transaction, as TransactionButton and useNearCall hand it to callers. */
export interface NearReceipt {
  hash: string;
  success: boolean;
  /** The first function call's return value, JSON-decoded (null when none). */
  returnValue: unknown;
  events: NearEvent[];
  logs: string[];
  /** The failure text, when !success. */
  failure: string | null;
}

function allLogs(outcome: NearOutcomeLike): string[] {
  const logs: string[] = [];
  logs.push(...(outcome.transaction_outcome?.outcome?.logs ?? []));
  for (const r of outcome.receipts_outcome ?? []) logs.push(...(r.outcome?.logs ?? []));
  return logs;
}

/**
 * Every NEP-297 event in the transaction, across all its receipts (the
 * randomness self-callback runs in a later receipt of the same transaction,
 * so ship construction shows up here too).
 */
export function parseEvents(outcome: NearOutcomeLike): NearEvent[] {
  const events: NearEvent[] = [];
  for (const log of allLogs(outcome)) {
    if (!log.startsWith("EVENT_JSON:")) continue;
    try {
      const parsed = JSON.parse(log.slice("EVENT_JSON:".length)) as {
        standard: string;
        version: string;
        event: string;
        data?: unknown;
      };
      const data = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
      for (const d of data) {
        events.push({
          standard: parsed.standard,
          version: parsed.version,
          event: parsed.event,
          data: (d ?? {}) as Record<string, unknown>,
        });
      }
    } catch {
      // Not our JSON; ignore.
    }
  }
  return events;
}

/** Events with the given name (any standard). */
export function eventsNamed<D = Record<string, unknown>>(events: NearEvent[], name: string): NearEvent<D>[] {
  return events.filter((e) => e.event === name) as NearEvent<D>[];
}

function decodeBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function failureText(status: unknown): string | null {
  if (status && typeof status === "object" && "Failure" in status) {
    return JSON.stringify((status as { Failure: unknown }).Failure);
  }
  return null;
}

/** Whole-transaction status: the final status plus any failed receipt. */
export function toReceipt(outcome: NearOutcomeLike): NearReceipt {
  const hash = outcome.transaction?.hash ?? outcome.transaction_outcome?.id ?? "";
  let failure = failureText(outcome.status);
  if (!failure) {
    for (const r of outcome.receipts_outcome ?? []) {
      const f = failureText(r.outcome?.status);
      if (f) {
        failure = f;
        break;
      }
    }
  }
  let returnValue: unknown = null;
  const status = outcome.status as { SuccessValue?: string } | undefined;
  if (status && typeof status === "object" && typeof status.SuccessValue === "string" && status.SuccessValue) {
    const text = decodeBase64(status.SuccessValue);
    try {
      returnValue = JSON.parse(text);
    } catch {
      returnValue = text;
    }
  }
  return {
    hash,
    success: failure == null,
    returnValue,
    events: parseEvents(outcome),
    logs: allLogs(outcome),
    failure,
  };
}

/** u64/u128 from the contract (decimal string or JSON number) -> bigint. */
export function toBig(v: string | number | bigint | null | undefined): bigint {
  if (v == null || v === "") return BigInt(0);
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  return BigInt(v);
}

/** bigint -> the decimal string a U64/U128 argument expects. */
export function u64(v: bigint | number | string): string {
  return typeof v === "string" ? v : BigInt(v).toString();
}

/** yoctoNEAR -> "1.42" style NEAR string (trailing zeros trimmed). */
export function formatNear(yocto: bigint | string | number, maxDecimals = 4): string {
  const v = toBig(yocto);
  const neg = v < BigInt(0);
  const abs = neg ? -v : v;
  const whole = abs / YOCTO_PER_NEAR;
  const frac = abs % YOCTO_PER_NEAR;
  let fracStr = frac.toString().padStart(24, "0").slice(0, maxDecimals).replace(/0+$/, "");
  if (whole === BigInt(0) && fracStr === "" && frac > BigInt(0)) fracStr = "0".repeat(maxDecimals - 1) + "1";
  return `${neg ? "-" : ""}${whole.toString()}${fracStr ? `.${fracStr}` : ""}`;
}

/** "1.5" NEAR -> yoctoNEAR. */
export function parseNear(near: string): bigint {
  const [w, f = ""] = near.trim().split(".");
  return BigInt(w || "0") * YOCTO_PER_NEAR + BigInt((f + "0".repeat(24)).slice(0, 24) || "0");
}

const WEI_PER_UNIT = BigInt(10) ** BigInt(18);

/** 18-decimal token amount (UTC) -> display string. Same scale as viem's formatEther. */
export function formatUnits18(v: bigint | string | number, maxDecimals = 4): string {
  const x = toBig(v);
  const neg = x < BigInt(0);
  const abs = neg ? -x : x;
  const whole = abs / WEI_PER_UNIT;
  const frac = (abs % WEI_PER_UNIT).toString().padStart(18, "0").slice(0, maxDecimals).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${frac ? `.${frac}` : ""}`;
}

/** "1.5" -> 18-decimal amount. Same scale as viem's parseEther. */
export function parseUnits18(v: string): bigint {
  const [w, f = ""] = v.trim().split(".");
  return BigInt(w || "0") * WEI_PER_UNIT + BigInt((f + "0".repeat(18)).slice(0, 18) || "0");
}
