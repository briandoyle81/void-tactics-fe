import { describe, expect, it } from "vitest";
import { DEFAULT_SHIP_GRANT, parseShipGrant, shipGrantError, shipGrantToVisual, type ShipGrantSpec } from "../shipGrant";

const grant = (patch: Partial<ShipGrantSpec> = {}): ShipGrantSpec => ({ ...DEFAULT_SHIP_GRANT, ...patch });

describe("shipGrantError", () => {
  it("accepts the default grant", () => {
    expect(shipGrantError(grant(), 2)).toBeNull();
  });

  it("rejects a trait above 2 (InvalidTraitValue)", () => {
    expect(shipGrantError(grant({ accuracy: 3 }), 2)).toMatch(/accuracy/);
    expect(shipGrantError(grant({ hull: 3 }), 2)).toMatch(/hull/);
    expect(shipGrantError(grant({ speed: 3 }), 2)).toMatch(/speed/);
  });

  it("rejects variant 0 or above maxVariant (InvalidVariant)", () => {
    expect(shipGrantError(grant({ variant: 0 }), 2)).toMatch(/Variant/);
    expect(shipGrantError(grant({ variant: 3 }), 2)).toMatch(/Variant/);
    expect(shipGrantError(grant({ variant: 2 }), 2)).toBeNull();
  });

  it("rejects armor and shields together (ArmorAndShieldsBothSet)", () => {
    const equipment = { ...DEFAULT_SHIP_GRANT.equipment, armor: 1, shields: 1 };
    expect(shipGrantError(grant({ equipment }), 2)).toMatch(/armor and shields/);
  });

  it("rejects an empty name and out-of-range colors", () => {
    expect(shipGrantError(grant({ name: "  " }), 2)).toMatch(/name/);
    expect(shipGrantError(grant({ colors: { ...DEFAULT_SHIP_GRANT.colors, h3: 361 } }), 2)).toMatch(/Color 3/);
  });
});

describe("parseShipGrant", () => {
  it("round-trips a grant through JSON", () => {
    const g = grant({ name: "Vanguard", shipsDestroyed: 30, shiny: true, oncePerAddress: false });
    expect(parseShipGrant(JSON.parse(JSON.stringify(g)))).toEqual(g);
  });

  it("rejects non-objects and a missing name, and leaves bad numbers for shipGrantError", () => {
    expect(parseShipGrant(null)).toBeNull();
    expect(parseShipGrant({})).toBeNull();
    const parsed = parseShipGrant({ ...grant(), accuracy: "2" });
    expect(parsed).not.toBeNull();
    expect(shipGrantError(parsed!, 2)).toMatch(/accuracy/);
  });
});

describe("shipGrantToVisual", () => {
  it("keeps the first two color sets, the rank and the constructed flag", () => {
    const visual = shipGrantToVisual(grant({ shipsDestroyed: 100, shiny: true }));
    expect(visual.traits.colors).toEqual({ h1: 220, s1: 50, l1: 50, h2: 220, s2: 50, l2: 50 });
    expect(visual.shipData).toMatchObject({ shipsDestroyed: 100, shiny: true, constructed: true });
  });
});
