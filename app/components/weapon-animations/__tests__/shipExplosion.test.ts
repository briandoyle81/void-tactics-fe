import { describe, expect, it } from "vitest";
import { shipExplosionDelayMs } from "../ShipExplosionSound";

describe("shipExplosionDelayMs", () => {
  it("starts just after the weapon's hit", () => {
    // Laser: beams land at once.
    expect(shipExplosionDelayMs({ kind: "weapon", mainWeapon: 0, variant: 1, distanceCells: 3 })).toBe(400);
    // Railgun, 4 cells at 8 cells/s.
    expect(shipExplosionDelayMs({ kind: "weapon", mainWeapon: 1, variant: 1, distanceCells: 4 })).toBe(750);
    // Missiles: 0.5 s drift, 4 cells at 4 cells/s, the second missile 0.2 s behind.
    expect(shipExplosionDelayMs({ kind: "weapon", mainWeapon: 2, variant: 1, distanceCells: 4 })).toBe(1950);
    // Ram: its first impact.
    expect(shipExplosionDelayMs({ kind: "ram" })).toBe(920);
  });

  it("times slower rounds by their own speed", () => {
    const railgun = shipExplosionDelayMs({ kind: "weapon", mainWeapon: 1, variant: 1, distanceCells: 7 });
    const linearAccelerator = shipExplosionDelayMs({ kind: "weapon", mainWeapon: 1, variant: 2, distanceCells: 7 });
    expect(linearAccelerator).toBeGreaterThan(railgun);
  });
});
