import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MapEditor, withMapViewCleared } from "../MapEditor";

vi.mock("../MapGameView", () => ({
  MapGameView: ({ scoringGrid }: { scoringGrid: number[][] }) => (
    <div data-testid="game-view">{scoringGrid[2][3]}</div>
  ),
}));

const renderEditor = () =>
  render(
    <MapEditor
      mapId={4}
      initialBlockedPositions={[]}
      initialScoringPositions={[{ row: 2, col: 3, points: 5, onlyOnce: false }]}
      canEdit
      renderSaveButton={() => null}
    />,
  );

afterEach(() => {
  window.history.replaceState(null, "", "/");
  localStorage.clear();
});

describe("MapEditor view toggle", () => {
  it("starts in the editor view", () => {
    renderEditor();
    expect(screen.getByRole("button", { name: "Editor view" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByTestId("game-view")).toBeNull();
  });

  it("switches to the game view and back, keeping it in the URL", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Game view" }));
    expect(window.location.search).toBe("?mapView=game");
    expect(screen.getByTestId("game-view").textContent).toBe("5");

    fireEvent.click(screen.getByRole("button", { name: "Editor view" }));
    expect(window.location.search).toBe("");
    expect(screen.queryByTestId("game-view")).toBeNull();
  });

  it("opens in the game view from the URL", () => {
    window.history.replaceState(null, "", "/?mapView=game");
    renderEditor();
    expect(screen.getByTestId("game-view")).toBeTruthy();
  });

  it("clears the view when leaving the editor", () => {
    window.history.replaceState(null, "", "/?map=4&mapView=game");
    const leave = vi.fn();
    withMapViewCleared(leave)();
    expect(window.location.search).toBe("?map=4");
    expect(leave).toHaveBeenCalledTimes(1);
  });
});
