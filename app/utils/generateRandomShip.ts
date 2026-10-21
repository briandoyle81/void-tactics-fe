import { Ship, validSpecialsForVariant } from "../types/types";
import { randomMockDroneName } from "../data/mockDroneNames";
import { SHOWCASE_SHIP_NAMES } from "../data/content/showcaseShipNames";

// Variant 1 (consortium) names are a sample of the real ship names
// (app/data/content/showcaseShipNames.ts), not the whole list.
const SHIP_NAMES = SHOWCASE_SHIP_NAMES;

/**
 * Generate a random, fully-formed decorative Ship — no backend/on-chain data
 * required. `name` is a real consortium ship name for variant 1, a drone-style
 * call sign (data/mockDroneNames.ts) for variant 2. Uses Math.random(), so callers that
 * render during SSR must only call this client-side, after mount, to avoid a
 * hydration mismatch.
 */
export function generateRandomShip(index: number, variant: number): Ship {
  const name =
    variant === 2 ? randomMockDroneName() : SHIP_NAMES[Math.floor(Math.random() * SHIP_NAMES.length)];

  // Every 5th ship gets rank 3-5
  let shipsDestroyed = Math.floor(Math.random() * 10); // Default rank 1
  if (index % 5 === 0) {
    const rank = Math.floor(Math.random() * 3) + 3; // Rank 3, 4, or 5
    if (rank === 3) {
      shipsDestroyed = Math.floor(Math.random() * 70) + 30; // 30-99
    } else if (rank === 4) {
      shipsDestroyed = Math.floor(Math.random() * 200) + 100; // 100-299
    } else {
      shipsDestroyed = Math.floor(Math.random() * 700) + 300; // 300-999
    }
  }

  // Random equipment
  const mainWeapon = Math.floor(Math.random() * 4);
  const armor = Math.random() > 0.5 ? Math.floor(Math.random() * 3) + 1 : 0;
  const shields =
    armor === 0
      ? Math.random() > 0.5
        ? Math.floor(Math.random() * 3) + 1
        : 0
      : 0;
  // Variant 2 ("Drone" faction) ships use a disjoint Special value set
  // (Slot 4/5/6 instead of Slot 1/2/3) — picking from a flat 0-3 range here
  // produced invalid values for variant-2 ships. Must pick from the values
  // actually valid for this ship's variant instead.
  const validSpecials = validSpecialsForVariant(variant);
  const special = validSpecials[Math.floor(Math.random() * validSpecials.length)];

  // Random traits
  const accuracy = Math.floor(Math.random() * 3);
  const hull = Math.floor(Math.random() * 3);
  const speed = Math.floor(Math.random() * 3);

  // Random colors
  const h1 = Math.floor(Math.random() * 360);
  const s1 = Math.floor(Math.random() * 100);
  const l1 = Math.floor(Math.random() * 100);
  const h2 = Math.floor(Math.random() * 360);
  const s2 = Math.floor(Math.random() * 100);
  const l2 = Math.floor(Math.random() * 100);

  // 20% chance of being shiny
  const shiny = Math.random() < 0.2;

  return {
    name,
    id: BigInt(index),
    equipment: {
      mainWeapon,
      armor,
      shields,
      special,
    },
    traits: {
      serialNumber: BigInt(index),
      colors: {
        h1,
        s1,
        l1,
        h2,
        s2,
        l2,
      },
      variant,
      accuracy,
      hull,
      speed,
    },
    shipData: {
      shipsDestroyed,
      costsVersion: 0,
      cost: 0,
      shiny,
      constructed: true,
      inFleet: false,
      timestampDestroyed: BigInt(0),
    },
    owner: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  };
}
