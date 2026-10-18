import { Ship } from "../types/types";
import type { ShipVisual, ShipVisualData } from "../types/shipVisual";
import { toShipVisual } from "./toShipVisual";
import { getRankProgressInfo } from "./shipLevel";
import type { ShipCardData } from "../types/shipCardData";

/** What a ship card needs, number-native (web2's Web2Ship already fits). */
interface ShipCardSource extends ShipVisual {
  id: number | string;
  name: string;
  shipData: ShipVisualData & { inFleet: boolean; cost: number };
}

/** ShipCard's data for a web2 ship, or any number-native ship. */
export function toShipCardDataWeb2(ship: ShipCardSource): ShipCardData {
  const rankInfo = getRankProgressInfo(ship);
  return {
    id: String(ship.id),
    name: ship.name,
    isShiny: ship.shipData.shiny,
    isConstructed: ship.shipData.constructed,
    isDestroyed: ship.shipData.timestampDestroyed > 0,
    timestampDestroyedSeconds: ship.shipData.timestampDestroyed,
    inFleet: ship.shipData.inFleet,
    cost: ship.shipData.cost,
    equipment: {
      mainWeapon: ship.equipment.mainWeapon,
      armor: ship.equipment.armor,
      shields: ship.equipment.shields,
      special: ship.equipment.special,
    },
    traits: {
      variant: ship.traits.variant,
      accuracy: ship.traits.accuracy,
      hull: ship.traits.hull,
      speed: ship.traits.speed,
    },
    rank: rankInfo.rank,
    rankShipsDestroyed: rankInfo.shipsDestroyed,
    rankNextRank: rankInfo.nextRank,
    rankKillsToNextRank: rankInfo.killsToNextRank,
  };
}

/** ShipCard's data for a web3 ship: its bigint fields become numbers here. */
export function toShipCardData(ship: Ship): ShipCardData {
  const visual = toShipVisual(ship);
  return toShipCardDataWeb2({
    ...visual,
    id: ship.id.toString(),
    name: ship.name,
    shipData: { ...visual.shipData, inFleet: ship.shipData.inFleet, cost: Number(ship.shipData.cost) },
  });
}
