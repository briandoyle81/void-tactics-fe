// Refetch until the data shows the change we're waiting for. After a tx
// confirms, the RPC provider may answer from a node that hasn't seen that
// block yet, returning the old state; a single refetch then strands the
// screen on it until the next slow poll. Stops as soon as `hasChanged()` is
// true, or after the last attempt (~17s). Used by the AI turn loops.

const DEFAULT_DELAYS_MS = [0, 1_000, 2_500, 5_000, 8_000];

export async function refetchUntilChanged({
  refetch,
  hasChanged,
  delaysMs = DEFAULT_DELAYS_MS,
}: {
  refetch: () => unknown;
  hasChanged: () => boolean;
  delaysMs?: readonly number[];
}): Promise<void> {
  for (const delay of delaysMs) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    if (hasChanged()) return;
    try {
      await refetch();
    } catch {
      // A failed read is just another stale answer: try again on schedule.
    }
  }
}
