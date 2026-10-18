// Kept as thin wrappers so callers don't need mass-updated imports.
// All values are plain numbers now; no special encoding needed.

export function stringifyWithBigint(value: unknown): string {
  return JSON.stringify(value);
}
