import type { Ship } from "../types/types";
import type { Web2Ship } from "../types/web2Ship";
import { PREVIEW_SHIP_ID_OFFSET, type ShipPreviewSpec } from "./shipPreviewSpec";
import { calculateTutorialThreatPoints } from "./tutorialShipBuilder";
import type { ShipGrantSpec } from "./shipGrant";

// Preview ships in each mode's ship shape, for art before a ship exists:
// ship-pack demo ships (Store tier cards, the Command Deck's featured pack)
// from a ShipPreviewSpec, and roguelike reward ships from a ShipGrantSpec.

/** How often pack preview ships reroll — HeroShipShowcase's cadence. */
export const PREVIEW_REFRESH_INTERVAL_MS = 10000;

/** Web3 kills shown on a preview ship of the given rank. */
export function previewShipsDestroyedForRank(rank: number): number {
  switch (Math.min(5, rank)) {
    case 5:
      return 350;
    case 4:
      return 120;
    case 3:
      return 45;
    case 2:
      return 15;
    default:
      return 5;
  }
}

/** What a preview ship needs, in plain numbers; each mode's builder adds its id shape. */
interface PreviewShipFields {
  name: string;
  id: number;
  equipment: Ship["equipment"];
  colors: Ship["traits"]["colors"];
  variant: number;
  accuracy: number;
  hull: number;
  speed: number;
  shipsDestroyed: number;
  shiny: boolean;
  cost: number;
  isFree: boolean;
}

function web3PreviewShip(f: PreviewShipFields): Ship {
  const id = BigInt(f.id);
  return {
    name: f.name,
    id,
    equipment: f.equipment,
    traits: { serialNumber: id, colors: f.colors, variant: f.variant, accuracy: f.accuracy, hull: f.hull, speed: f.speed },
    shipData: {
      shipsDestroyed: f.shipsDestroyed,
      costsVersion: 0,
      cost: f.cost,
      shiny: f.shiny,
      constructed: true,
      inFleet: false,
      timestampDestroyed: 0n,
    },
    owner: "0x0000000000000000000000000000000000000000",
  };
}

function web2PreviewShip(f: PreviewShipFields): Web2Ship {
  return {
    name: f.name,
    id: f.id,
    equipment: f.equipment,
    traits: { serialNumber: f.id, colors: f.colors, variant: f.variant, accuracy: f.accuracy, hull: f.hull, speed: f.speed },
    shipData: {
      shipsDestroyed: f.shipsDestroyed,
      costsVersion: 0,
      cost: f.cost,
      shiny: f.shiny,
      constructed: true,
      inFleet: false,
      timestampDestroyed: 0,
      modifiedCount: 0,
      isFree: f.isFree,
    },
    owner: "",
  };
}

function packFields(spec: ShipPreviewSpec): PreviewShipFields {
  return {
    name: `Preview ${spec.seed}`,
    id: PREVIEW_SHIP_ID_OFFSET + spec.seed,
    equipment: spec.equipment,
    colors: spec.colors,
    variant: spec.variant,
    accuracy: spec.accuracy,
    hull: spec.hull,
    speed: spec.speed,
    shipsDestroyed: spec.shipsDestroyed,
    shiny: spec.shiny,
    cost: 0,
    isFree: false,
  };
}

/** A ship-pack preview ship (web3). */
export function toPreviewShip(spec: ShipPreviewSpec): Ship {
  return web3PreviewShip(packFields(spec));
}

/** A ship-pack preview ship (web2). */
export function toPreviewShipWeb2(spec: ShipPreviewSpec): Web2Ship {
  return web2PreviewShip(packFields(spec));
}

// A roguelike node's reward ship before it's minted (mission drawer, admin
// list). The cost uses the shared threat formula, as AI preview ships do.
function grantFields(grant: ShipGrantSpec, id: number): PreviewShipFields {
  const { h1, s1, l1, h2, s2, l2 } = grant.colors;
  return {
    name: grant.name,
    id,
    equipment: grant.equipment,
    colors: { h1, s1, l1, h2, s2, l2 },
    variant: grant.variant,
    accuracy: grant.accuracy,
    hull: grant.hull,
    speed: grant.speed,
    shipsDestroyed: grant.shipsDestroyed,
    shiny: grant.shiny,
    cost: calculateTutorialThreatPoints(
      grant.equipment,
      { accuracy: grant.accuracy, hull: grant.hull, speed: grant.speed },
      grant.variant,
    ),
    isFree: grant.isFreeShip,
  };
}

/** A reward ship preview (web3); `id` is rendering-only. */
export function shipGrantToPreviewShip(grant: ShipGrantSpec, id = PREVIEW_SHIP_ID_OFFSET): Ship {
  return web3PreviewShip(grantFields(grant, id));
}

/** A reward ship preview (web2); `id` is rendering-only. */
export function shipGrantToPreviewShipWeb2(grant: ShipGrantSpec, id = PREVIEW_SHIP_ID_OFFSET): Web2Ship {
  return web2PreviewShip(grantFields(grant, id));
}
