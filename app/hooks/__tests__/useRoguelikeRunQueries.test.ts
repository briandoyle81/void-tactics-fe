import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

vi.mock("../useShipsContract", () => ({ invalidateShipsReads: vi.fn() }));

import { invalidateRoguelikeRunQueries, resetRoguelikeRunQueries } from "../useRoguelikeRun";
import { RL_RUN_QUERY_ROOT } from "../useGameLens";
import { GAME_CONTRACT } from "../../near/config";

function seed(client: QueryClient) {
  client.setQueryData([RL_RUN_QUERY_ROOT, "run", "alice"], "run");
  client.setQueryData([RL_RUN_QUERY_ROOT, "hp", "alice", "1,2"], "hp");
  client.setQueryData([RL_RUN_QUERY_ROOT, "view", "alice"], "runView");
  client.setQueryData(["near", GAME_CONTRACT, "get_run", '{"account_id":"alice"}'], "getRun");
  client.setQueryData(["near", GAME_CONTRACT, "mt_balance_of", "{}"], "other");
  client.setQueryData(["near-owned-ships", "alice"], "ships");
}

describe("roguelike run query helpers", () => {
  it("reset removes run reads, leaving other queries", () => {
    const client = new QueryClient();
    seed(client);
    resetRoguelikeRunQueries(client);
    const data = client.getQueryCache().getAll().map((q) => q.state.data);
    expect(data).not.toContain("run");
    expect(data).not.toContain("hp");
    expect(data).not.toContain("runView");
    expect(data).not.toContain("getRun");
    expect(data).toContain("other");
    expect(data).toContain("ships");
  });

  it("invalidate marks run reads stale (e.g. roster HP after a win)", () => {
    const client = new QueryClient();
    seed(client);
    void invalidateRoguelikeRunQueries(client);
    const stale = client
      .getQueryCache()
      .getAll()
      .filter((q) => q.state.isInvalidated)
      .map((q) => q.state.data);
    expect(stale).toEqual(expect.arrayContaining(["run", "hp", "runView", "getRun"]));
    expect(stale).not.toContain("other");
    expect(stale).not.toContain("ships");
  });
});
