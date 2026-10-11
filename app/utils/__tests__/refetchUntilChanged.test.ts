import { describe, expect, it, vi } from "vitest";
import { refetchUntilChanged } from "../refetchUntilChanged";

describe("refetchUntilChanged", () => {
  it("refetches until the change shows up, then stops", async () => {
    let calls = 0;
    const refetch = vi.fn(() => {
      calls += 1;
    });
    await refetchUntilChanged({ refetch, hasChanged: () => calls >= 2, delaysMs: [0, 1, 1, 1, 1] });
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last attempt, and keeps going past failed reads", async () => {
    const refetch = vi.fn(() => Promise.reject(new Error("rpc")));
    await refetchUntilChanged({ refetch, hasChanged: () => false, delaysMs: [0, 1, 1] });
    expect(refetch).toHaveBeenCalledTimes(3);
  });
});
