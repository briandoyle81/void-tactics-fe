/** A list of ship ids as a key: the same ships give the same key, whatever their order or repeats. */
export function shipIdsKey(shipIds: readonly bigint[]): string {
  return Array.from(new Set(shipIds.map((id) => id.toString())))
    .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
    .join(",");
}
