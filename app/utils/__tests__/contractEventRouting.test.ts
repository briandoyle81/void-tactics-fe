import { describe, expect, it, vi } from "vitest";
import {
  isFastEventPollingRequested,
  setFastEventPolling,
  subscribeFastEventPolling,
} from "../contractEventRouting";

describe("fast event polling requests", () => {
  it("is on while any source requests it, and notifies on changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFastEventPolling(listener);
    setFastEventPolling("lobby", true);
    setFastEventPolling("lobby", true);
    setFastEventPolling("other", true);
    expect(isFastEventPollingRequested()).toBe(true);
    setFastEventPolling("lobby", false);
    expect(isFastEventPollingRequested()).toBe(true);
    setFastEventPolling("other", false);
    expect(isFastEventPollingRequested()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
  });
});
