import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { applyUrlParams, getUrlParam, isSameScreen, parseScreenPath, setUrlParams, useUrlParam } from "../urlState";
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
    expect(window.location.pathname).toBe("/play/battles");
    expect(window.location.search).toBe("?node=3");
  });

  it("keeps the tab in the path and the rest in the query", () => {
    setUrlParams({ tab: "store", section: "credits" });
    expect(`${window.location.pathname}${window.location.search}`).toBe("/play/store?section=credits");
    expect(getUrlParam("tab")).toBe("store");
    setUrlParams({ tab: null });
    expect(window.location.pathname).toBe("/play");
    expect(getUrlParam("tab")).toBeNull();
  });

  it("uses the bare path on the play host", () => {
    window.history.replaceState(null, "", "/");
    setUrlParams({ tab: "operations" });
    expect(window.location.pathname).toBe("/operations");
    expect(getUrlParam("tab")).toBe("operations");
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
    expect(`${window.location.pathname}${window.location.search}`).toBe("/play/battles");
    expect(window.history.length).toBe(length);
  });

  it("replaces when the detail was opened directly", () => {
    window.history.replaceState(null, "", "/play/battles?game=4");
    const length = window.history.length;
    setUrlParams({ game: null }, { back: true });
    expect(`${window.location.pathname}${window.location.search}`).toBe("/play/battles");
    expect(window.history.length).toBe(length);
  });

  it("replaces when the previous entry is a different screen", () => {
    setUrlParams({ tab: "deck" });
    setUrlParams({ tab: "battles", game: 4 });
    const length = window.history.length;
    setUrlParams({ game: null }, { back: true });
    expect(`${window.location.pathname}${window.location.search}`).toBe("/play/battles");
    expect(window.history.length).toBe(length);
  });
});

describe("openClientTab", () => {
  it("drops the previous screen's params on a tab change, keeps them on the same tab", () => {
    setUrlParams({ tab: "battles", game: 9, chain: "84532" });
    openClientTab("Games", { params: { replay: "1" } });
    expect(`${window.location.pathname}${window.location.search}`).toBe("/play/battles?game=9&chain=84532&replay=1");
    openClientTab("Store", { params: { section: "credits" } });
    expect(`${window.location.pathname}${window.location.search}`).toBe("/play/store?chain=84532&section=credits");
  });

  it("round-trips slugs and builds hrefs", () => {
    expect(clientTabFromSlug("fleet")).toBe("Manage Navy");
    expect(clientTabFromSlug("nope")).toBeNull();
    expect(clientTabHref("Store", { section: "credits" })).toBe("/play/store?section=credits");
    expect(clientTabHref("Games")).toBe("/play/battles");
  });
});

describe("parseScreenPath", () => {
  it("finds the tab after /play and /admin, and at the root on the play host", () => {
    expect(parseScreenPath("/play")).toEqual({ base: "/play", tab: null });
    expect(parseScreenPath("/play/operations")).toEqual({ base: "/play", tab: "operations" });
    expect(parseScreenPath("/admin/maps")).toEqual({ base: "/admin", tab: "maps" });
    expect(parseScreenPath("/")).toEqual({ base: "", tab: null });
    expect(parseScreenPath("/battles")).toEqual({ base: "", tab: "battles" });
    expect(parseScreenPath("/42")).toBeNull();
    expect(parseScreenPath("/tournaments/3")).toBeNull();
  });
});

describe("isSameScreen", () => {
  it("compares path and params, ignoring order and node", () => {
    expect(isSameScreen("/play/battles?a=1&b=2", "/play/battles?b=2&a=1&node=4")).toBe(true);
    expect(isSameScreen("/play/battles", "/play/store")).toBe(false);
  });
});
