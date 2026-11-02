import { describe, expect, it } from "vitest";
import {
  aiFleetPendingWrites,
  aiFleetShipFromWeb2,
  aiFleetShipStatus,
  aiFleetToFile,
  newAIFleetShip,
  parseAIFleetFile,
  stripKey,
  withKey,
  type AIFleetShipData,
} from "../aiFleet";

function savedShip(configId: number, name = "Saved"): AIFleetShipData {
  return { ...stripKey(newAIFleetShip()), configId, name };
}

describe("aiFleet", () => {
  it("round-trips a fleet through its JSON file", () => {
    const ships = [withKey(savedShip(3, "Anvil")), { ...newAIFleetShip(), name: "New one" }];
    const text = JSON.stringify(aiFleetToFile(ships));
    const loaded = parseAIFleetFile(text);
    expect(loaded).toEqual(ships.map(stripKey));
  });

  it("rejects files that aren't fleet files or have bad values", () => {
    expect(() => parseAIFleetFile("not json")).toThrow(/valid JSON/);
    expect(() => parseAIFleetFile(JSON.stringify({ ships: [] }))).toThrow(/AI fleet file/);
    const file = aiFleetToFile([newAIFleetShip()]);
    (file.ships[0].traits as { hull: unknown }).hull = 1.5;
    expect(() => parseAIFleetFile(JSON.stringify(file))).toThrow(/Ship 1: hull/);
  });

  it("sorts ships into new, changed and saved, whatever the saved field order", () => {
    const saved = savedShip(7);
    // The same config with its fields in another order (as an API might send it).
    const reverse = (o: object) => Object.fromEntries(Object.entries(o).reverse());
    const reordered = { ...reverse(saved), traits: { ...reverse(saved.traits), colors: reverse(saved.traits.colors) } };
    const savedById = new Map([[7, reordered as unknown as AIFleetShipData]]);
    const same = withKey(saved);
    const changed = { ...withKey(saved), name: "Renamed" };
    const fresh = newAIFleetShip();
    const unknownId = withKey(savedShip(99));
    expect(aiFleetShipStatus(same, savedById)).toBe("saved");
    expect(aiFleetShipStatus(changed, savedById)).toBe("changed");
    expect(aiFleetShipStatus(fresh, savedById)).toBe("new");
    expect(aiFleetShipStatus(unknownId, savedById)).toBe("new");
    const { creates, updates } = aiFleetPendingWrites([same, changed, fresh], savedById);
    expect(creates).toEqual([fresh]);
    expect(updates).toEqual([changed]);
  });

  it("reads web2 configs with the third color set at its defaults", () => {
    const ship = aiFleetShipFromWeb2({
      id: 4,
      name: "W",
      equipment: { mainWeapon: 1, armor: 0, shields: 2, special: 0 },
      traits: { serialNumber: 0, colors: { h1: 1, s1: 2, l1: 3, h2: 4, s2: 5, l2: 6 }, variant: 2, accuracy: 0, hull: 1, speed: 2 },
      archetype: 3,
      shiny: true,
      shipsDestroyed: 120,
    });
    expect(ship.traits.colors).toEqual({ h1: 1, s1: 2, l1: 3, h2: 4, s2: 5, l2: 6 });
    expect(ship.configId).toBe(4);
    expect(ship).toMatchObject({ shiny: true, shipsDestroyed: 120 });
  });

  it("reads files saved before ships had shiny and kills as plain, unranked ships", () => {
    const file = aiFleetToFile([newAIFleetShip()]);
    const old = {
      ...file,
      ships: file.ships.map((ship) => {
        const rest: Partial<typeof ship> = { ...ship };
        delete rest.shiny;
        delete rest.shipsDestroyed;
        return rest;
      }),
    };
    expect(parseAIFleetFile(JSON.stringify(old))[0]).toMatchObject({ shiny: false, shipsDestroyed: 0 });
    const bad = aiFleetToFile([{ ...newAIFleetShip(), shipsDestroyed: -1 }]);
    expect(() => parseAIFleetFile(JSON.stringify(bad))).toThrow(/shipsDestroyed/);
  });

  it("rejects a kill count above AIEncounters.MAX_AI_KILLS", () => {
    const ok = aiFleetToFile([{ ...newAIFleetShip(), shipsDestroyed: 1_000_000 }]);
    expect(parseAIFleetFile(JSON.stringify(ok))[0].shipsDestroyed).toBe(1_000_000);
    const bad = aiFleetToFile([{ ...newAIFleetShip(), shipsDestroyed: 1_000_001 }]);
    expect(() => parseAIFleetFile(JSON.stringify(bad))).toThrow(/shipsDestroyed/);
  });

  it("counts a shiny or kills change as changed", () => {
    const saved = savedShip(5);
    const savedById = new Map([[5, saved]]);
    expect(aiFleetShipStatus({ ...withKey(saved), shiny: true }, savedById)).toBe("changed");
    expect(aiFleetShipStatus({ ...withKey(saved), shipsDestroyed: 300 }, savedById)).toBe("changed");
  });
});
