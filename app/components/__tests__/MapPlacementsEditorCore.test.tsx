import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MapPlacementsEditorCore } from "../MapPlacementsEditorCore";

vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderEditor() {
  const onSave = vi.fn(async () => "saved");
  const onClose = vi.fn();
  render(
    <MapPlacementsEditorCore
      mapId={67}
      roster={[]}
      savedPlacements={[{ configId: 1, row: 2, col: 14 }]}
      joinerZone={[]}
      maxPlacements={14}
      onSave={onSave}
      startOpen
      onClose={onClose}
      renderMap={({ placements, onShipMove }) => (
        <button type="button" onClick={() => onShipMove(placements[0].shipId, 3, 14)}>
          move ship
        </button>
      )}
    />,
  );
  const close = () => fireEvent.click(screen.getByRole("button", { name: "Close placements editor" }));
  return { onSave, onClose, close };
}

describe("MapPlacementsEditorCore leaving", () => {
  it("closes straight away with nothing unsaved", () => {
    const { onClose, close } = renderEditor();
    close();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("asks before dropping unsaved changes", () => {
    const { onClose, close } = renderEditor();
    fireEvent.click(screen.getByText("move ship"));
    close();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByText("Keep editing"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    close();
    fireEvent.click(screen.getByText("Discard"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("can save and leave", async () => {
    const { onSave, onClose, close } = renderEditor();
    fireEvent.click(screen.getByText("move ship"));
    close();
    fireEvent.click(screen.getByText("Save and leave"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith([{ row: 3, col: 14, configId: 1 }]);
  });
});
