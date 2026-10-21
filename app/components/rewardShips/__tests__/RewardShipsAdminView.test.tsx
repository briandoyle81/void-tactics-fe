import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RewardShipsAdminView } from "../RewardShipsAdminView";
import { DEFAULT_SHIP_GRANT, type ShipGrantSpec } from "../../../utils/shipGrant";

vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const SAVED: ShipGrantSpec = { ...DEFAULT_SHIP_GRANT, name: "Vanguard", oncePerAddress: true };

function renderView(overrides: Partial<React.ComponentProps<typeof RewardShipsAdminView>> = {}) {
  const props: React.ComponentProps<typeof RewardShipsAdminView> = {
    nodes: [
      { id: 1, campaignId: 1, title: "First", hasGrantEffect: true },
      { id: 2, campaignId: 1, title: "Second", hasGrantEffect: false },
    ],
    grantsByNodeId: new Map([[1, SAVED]]),
    isLoading: false,
    canEdit: true,
    maxVariant: 2,
    specialsForVariant: () => [0, 1, 2, 3],
    playerLabel: "Player wallet address",
    onSave: vi.fn(async () => "saved"),
    onClear: vi.fn(async () => "cleared"),
    onResetClaim: vi.fn(async () => "reset"),
    onAttachEffect: vi.fn(async () => "attached"),
    ...overrides,
  };
  render(<RewardShipsAdminView {...props} />);
  return props;
}

describe("RewardShipsAdminView", () => {
  it("lists only nodes with a reward ship", () => {
    window.history.replaceState(null, "", "/admin/reward-ships");
    renderView();
    expect(screen.getByText("Vanguard")).toBeTruthy();
    expect(screen.queryByText(/#2 Second/)).toBeNull();
    expect(screen.getByText(/Pick a reward ship on the left/)).toBeTruthy();
  });

  it("adds a reward ship to a node picked from the dropdown", () => {
    window.history.replaceState(null, "", "/admin/reward-ships");
    renderView();
    fireEvent.click(screen.getByText("[+ ADD REWARD SHIP]"));
    const confirm = screen.getByText("[CONFIRM]") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    const select = screen.getByLabelText("Node") as HTMLSelectElement;
    // Only nodes without a reward ship are offered.
    expect([...select.options].map((o) => o.value)).toEqual(["", "2"]);
    fireEvent.change(select, { target: { value: "2" } });
    fireEvent.click(confirm);
    expect(new URLSearchParams(window.location.search).get("node")).toBe("2");
    // The new node shows in the list and opens in the editor with the default ship.
    expect(screen.getAllByText(/#2 Second/).length).toBeGreaterThan(0);
    expect((screen.getByPlaceholderText("Enter ship name") as HTMLInputElement).value).toBe("Reward Ship");
  });

  it("disables adding without edit rights", () => {
    window.history.replaceState(null, "", "/admin/reward-ships");
    renderView({ canEdit: false, editBlockedReason: "Connect the owner wallet." });
    const add = screen.getByText("[+ ADD REWARD SHIP]") as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(add.title).toBe("Connect the owner wallet.");
  });

  it("loads the selected node's grant and saves the edited one", async () => {
    window.history.replaceState(null, "", "/admin/reward-ships?node=1");
    const props = renderView();
    const name = screen.getByPlaceholderText("Enter ship name") as HTMLInputElement;
    expect(name.value).toBe("Vanguard");

    const save = screen.getByText("[SAVE REWARD]") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(name, { target: { value: "Vanguard II" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(1, { ...SAVED, name: "Vanguard II" }));

    fireEvent.change(screen.getByLabelText("Player wallet address"), { target: { value: "0xabc" } });
    fireEvent.click(screen.getByText("[RESET CLAIM]"));
    await waitFor(() => expect(props.onResetClaim).toHaveBeenCalledWith(1, "0xabc"));
  });

  it("offers to add the Grant Ship effect and blocks an invalid grant", async () => {
    window.history.replaceState(null, "", "/admin/reward-ships?node=2");
    const props = renderView();
    fireEvent.click(screen.getByText("[ADD GRANT SHIP EFFECT]"));
    await waitFor(() => expect(props.onAttachEffect).toHaveBeenCalledWith(2));

    fireEvent.change(screen.getByPlaceholderText("Enter ship name"), { target: { value: " " } });
    expect(screen.getByText("The ship needs a name.")).toBeTruthy();
    expect((screen.getByText("[SAVE REWARD]") as HTMLButtonElement).disabled).toBe(true);
  });
});
