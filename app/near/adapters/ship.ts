/**
 * NEAR ship JSON (snake_case, enum names as strings) -> the app's Ship
 * (camelCase, numeric enums, bigint ids), and back for arguments.
 */
import type { Ship, ShipEquipment } from "../../types/types";
import type {
  Armor,
  Equipment,
  MainWeapon,
  Shields,
  Ship as NearShip,
  ShipView,
  Special,
} from "../generated/voidTactics";
import { toBig } from "../codec";

const MAIN_WEAPONS: MainWeapon[] = ["Generic", "Sniper", "Missile", "Close", "Future1", "Future2", "Future3", "Future4"];
const ARMORS: Armor[] = ["None", "Light", "Medium", "Heavy", "Future1", "Future2", "Future3", "Future4"];
const SHIELDS: Shields[] = ["None", "Light", "Medium", "Heavy", "Future1", "Future2", "Future3", "Future4"];
const SPECIALS: Special[] = ["None", "Slot1", "Slot2", "Slot3", "Slot4", "Slot5", "Slot6", "Slot7"];

function indexOrZero<T>(list: readonly T[], value: T): number {
  const i = list.indexOf(value);
  return i < 0 ? 0 : i;
}

export const mainWeaponIndex = (v: MainWeapon) => indexOrZero(MAIN_WEAPONS, v);
export const armorIndex = (v: Armor) => indexOrZero(ARMORS, v);
export const shieldsIndex = (v: Shields) => indexOrZero(SHIELDS, v);
export const specialIndex = (v: Special) => indexOrZero(SPECIALS, v);

export const mainWeaponName = (i: number): MainWeapon => MAIN_WEAPONS[i] ?? "Generic";
export const armorName = (i: number): Armor => ARMORS[i] ?? "None";
export const shieldsName = (i: number): Shields => SHIELDS[i] ?? "None";
export const specialName = (i: number): Special => SPECIALS[i] ?? "None";

export function toEquipment(e: Equipment): ShipEquipment {
  return {
    mainWeapon: mainWeaponIndex(e.main_weapon),
    armor: armorIndex(e.armor),
    shields: shieldsIndex(e.shields),
    special: specialIndex(e.special),
  };
}

/** App equipment (numbers) -> the contract's Equipment JSON. */
export function fromEquipment(e: ShipEquipment): Equipment {
  return {
    main_weapon: mainWeaponName(e.mainWeapon),
    armor: armorName(e.armor),
    shields: shieldsName(e.shields),
    special: specialName(e.special),
  };
}

/** A contract Ship (+ owner) as the app's Ship. Empty names (about 1 in 22,000) show as "Ship #id". */
export function toShip(ship: NearShip, owner: string): Ship {
  const id = toBig(ship.id);
  return {
    id,
    name: ship.name || `Ship #${id.toString()}`,
    owner,
    equipment: toEquipment(ship.equipment),
    traits: {
      serialNumber: toBig(ship.traits.serial_number),
      colors: { ...ship.traits.colors },
      variant: ship.traits.variant,
      accuracy: ship.traits.accuracy,
      hull: ship.traits.hull,
      speed: ship.traits.speed,
    },
    shipData: {
      shipsDestroyed: ship.ship_data.ships_destroyed,
      costsVersion: ship.ship_data.costs_version,
      cost: ship.ship_data.cost,
      shiny: ship.ship_data.shiny,
      constructed: ship.ship_data.constructed,
      inFleet: ship.ship_data.in_fleet,
      isFreeShip: ship.ship_data.is_free_ship,
      timestampDestroyed: toBig(ship.ship_data.timestamp_destroyed),
    },
  };
}

export function toShipFromView(view: ShipView): Ship {
  return toShip(view.ship, view.owner);
}

/** The app's Ship as the contract's Ship JSON (for renderer views like token_uri). */
export function fromShip(ship: Ship): NearShip {
  return {
    id: Number(ship.id),
    name: ship.name,
    equipment: fromEquipment(ship.equipment),
    traits: {
      serial_number: Number(ship.traits.serialNumber),
      colors: { ...ship.traits.colors },
      variant: ship.traits.variant,
      accuracy: ship.traits.accuracy,
      hull: ship.traits.hull,
      speed: ship.traits.speed,
    },
    ship_data: {
      ships_destroyed: ship.shipData.shipsDestroyed,
      costs_version: ship.shipData.costsVersion,
      cost: ship.shipData.cost,
      shiny: ship.shipData.shiny,
      constructed: ship.shipData.constructed,
      in_fleet: ship.shipData.inFleet,
      is_free_ship: ship.shipData.isFreeShip ?? false,
      modified: 0,
      timestamp_destroyed: Number(ship.shipData.timestampDestroyed),
    },
  };
}
