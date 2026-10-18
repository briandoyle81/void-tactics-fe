// Global BigInt-safe JSON.stringify shim
//
// Under SES + React dev, React's internal logging uses JSON.stringify
// on component props/state. When those objects contain BigInt values,
// the platform JSON.stringify throws a TypeError.
//
// To make this safe everywhere (dev + prod) without changing the rest
// of the codebase, we wrap JSON.stringify so that any BigInt is
// converted to a decimal string before serialization.

/* eslint-disable @typescript-eslint/no-explicit-any */

(() => {
  if (typeof JSON === "undefined" || typeof JSON.stringify !== "function") {
    return;
  }

  const originalStringify = JSON.stringify;

  // Avoid double-wrapping if this module is imported more than once
  // (e.g. via hot reload).
  const markerKey = "__voidTacticsBigIntSafeStringify__";
  const anyJson = JSON as any;
  if (anyJson[markerKey]) {
    return;
  }

  try {
    const safeStringify = function (
      this: any,
      value: any,
      replacer?: ((this: any, key: string, value: any) => any) | (number | string)[] | null,
      space?: string | number,
    ): string {
      const baseReplacer =
        typeof replacer === "function"
          ? replacer
          : (_key: string, v: any) => v;

      const wrappedReplacer = function (this: any, key: string, v: any) {
        const normalized = typeof v === "bigint" ? v.toString() : v;
        return baseReplacer.call(this, key, normalized);
      };

      return originalStringify.call(this, value, wrappedReplacer as any, space as any);
    };

    anyJson.stringify = safeStringify;
    anyJson[markerKey] = true;
  } catch {
    // If JSON is frozen under SES and cannot be patched, fail silently.
    // In that case, we fall back to the platform behavior.
  }
})();

export {};


