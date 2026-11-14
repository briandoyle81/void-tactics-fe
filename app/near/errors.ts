/**
 * Contract panics come back as text like
 *   "Smart contract panicked: InsufficientStorageBalance"
 * (handoff §10: the same error names as the Solidity custom errors). These
 * helpers pull the name out so callers can match on it, the way they matched
 * viem's decoded custom errors before.
 */

export class NearContractError extends Error {
  readonly errorName: string | null;
  constructor(message: string) {
    super(message);
    this.name = "NearContractError";
    this.errorName = contractErrorName(message);
  }
}

const PANIC_RE = /(?:Smart contract panicked|panicked at)[:\s]+["']?([A-Za-z][A-Za-z0-9_]*)/;

/** The contract's error name from any error/message, e.g. "ShipAlreadyMoved", or null. */
export function contractErrorName(err: unknown): string | null {
  const text = errorText(err);
  const m = text.match(PANIC_RE);
  if (m) return m[1];
  // ExecutionError objects serialized into the message.
  const exec = text.match(/"ExecutionError"\s*:\s*"[^"]*?([A-Z][A-Za-z0-9_]+)"/);
  return exec ? exec[1] : null;
}

/** True when the error is (or contains) the named contract panic. */
export function isContractError(err: unknown, name: string): boolean {
  return contractErrorName(err) === name || errorText(err).includes(name);
}

export function errorText(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    return cause ? `${err.message} ${errorText(cause)}` : err.message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** The user closed or declined the Dynamic signing prompt. */
export function isUserRejection(err: unknown): boolean {
  const t = errorText(err).toLowerCase();
  return t.includes("user rejected") || t.includes("user denied") || t.includes("user cancelled") || t.includes("user canceled");
}

/** Short message for toasts: the contract error name when there is one. */
export function shortErrorMessage(err: unknown): string {
  return contractErrorName(err) ?? errorText(err).slice(0, 200);
}
