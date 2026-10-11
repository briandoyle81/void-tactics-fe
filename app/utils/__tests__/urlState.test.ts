import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { applyUrlParams, setUrlParams, useUrlParam } from "../urlState";
import { clientTabFromSlug, clientTabHref, openClientTab } from "../clientNavigation";

afterEach(() => {
  window.history.replaceState(null, "", "/play");
});

describe("applyUrlParams", () => {
  it("sets, deletes (null/empty) and clears keys", () => {
    expect(applyUrlParams("tab=battles&game=4", { game: null, replay: "1" })).toBe("tab=battles&replay=1");
    expect(applyUrlParams("tab=battles&game=4&chain=84532", { tab: "store" }, ["game"])).toBe(
      "tab=store&chain=84532",
    );
    expect(applyUrlParams("", { lobby: 12n, create: "" })).toBe("lobby=12");
  });
});

describe("setUrlParams", () => {
  it("pushes one entry per change, none for a no-op, and replace doesn't push", () => {
    const start = window.history.length;
    setUrlParams({ tab: "battles" });
    setUrlParams({ tab: "battles" });
    expect(window.history.length).toBe(start + 1);
    setUrlParams({ node: 3 }, { replace: true });
    expect(window.history.length).toBe(start + 1);
    expect(window.location.search).toBe("?tab=battles&node=3");
  });

  it("notifies useUrlParam subscribers", () => {
    const { result } = renderHook(() => useUrlParam("game"));
    expect(result.current).toBeNull();
    act(() => setUrlParams({ game: 7 }));
    expect(result.current).toBe("7");
  });
});

describe("setUrlParams back", () => {
  it("goes back when the previous entry is the screen it returns to", async () => {
    setUrlParams({ tab: "battles" });
    setUrlParams({ game: 4 });
    setUrlParams({ node: 2 }, { replace: true });
    const length = window.history.length;
    const popped = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
    setUrlParams({ game: null, node: null }, { back: true });
    await popped;
    expect(window.location.search).toBe("?tab=battles");
    expect(window.history.length).toBe(length);
  });

  it("replaces when the detail was opened directly", () => {
    window.history.replaceState(null, "", "/play?tab=battles&game=4");
    const length = window.history.length;
    setUrlParams({ game: null }, { back: true });
    expect(window.location.search).toBe("?tab=battles");
    expect(window.history.length).toBe(length);
  });

  it("replaces when the previous entry is a different screen", () => {
    setUrlParams({ tab: "deck" });
    setUrlParams({ tab: "battles", game: 4 });
    const length = window.history.length;
    setUrlParams({ game: null }, { back: true });
    expect(window.location.search).toBe("?tab=battles");
    expect(window.history.length).toBe(length);
  });
});

describe("openClientTab", () => {
  it("drops the previous screen's params on a tab change, keeps them on the same tab", () => {
    setUrlParams({ tab: "battles", game: 9, chain: "84532" });
    openClientTab("Games", { params: { replay: "1" } });
    expect(window.location.search).toBe("?tab=battles&game=9&chain=84532&replay=1");
    openClientTab("Store", { params: { section: "credits" } });
    expect(window.location.search).toBe("?tab=store&chain=84532&section=credits");
  });

  it("round-trips slugs and builds hrefs", () => {
    expect(clientTabFromSlug("fleet")).toBe("Manage Navy");
    expect(clientTabFromSlug("nope")).toBeNull();
    expect(clientTabHref("Store", { section: "credits" })).toBe("/play?tab=store&section=credits");
  });
});
