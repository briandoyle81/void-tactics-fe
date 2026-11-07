import { describe, expect, it } from "vitest";
import { shipIdsKey } from "../shipIdsKey";

describe("shipIdsKey", () => {
  it("is the same for the same ships in any order (a retreat moves a ship to the end of the list)", () => {
    expect(shipIdsKey([3n, 10n, 7n])).toBe(shipIdsKey([10n, 7n, 3n]));
    expect(shipIdsKey([3n, 10n, 7n, 3n])).toBe(shipIdsKey([3n, 7n, 10n]));
  });

  it("orders ids numerically, not as text", () => {
    expect(shipIdsKey([10n, 9n, 100000000001n])).toBe("9,10,100000000001");
  });

  it("changes when the ships do", () => {
    expect(shipIdsKey([1n, 2n])).not.toBe(shipIdsKey([1n, 2n, 3n]));
  });
});
