/**
 * Roguelike win effects on NEAR are values stored per node
 * (RlNode.win_effects: DecBonus { amount } | HealAboveFloor { percent } |
 * ShipGrant { grant }), not separate effect contracts with global settings
 * as on Base. The screens still talk about "effect addresses" (which
 * effects a node runs), so each kind gets a stable id here, scoped to the
 * game contract, and these helpers convert between that list and the
 * contract's WinEffect values.
 */
import { GAME_CONTRACT } from "../config";
import type { ShipGrant, WinEffect } from "../generated/voidTactics";
import type { ShipGrantSpec } from "../../utils/shipGrant";
import { fromEquipment, toEquipment } from "./ship";

export const WIN_EFFECT_IDS = {
  DEC_BONUS_WIN_EFFECT: `${GAME_CONTRACT}#dec_bonus`,
  HEAL_ABOVE_FLOOR_WIN_EFFECT: `${GAME_CONTRACT}#heal_above_floor`,
  SHIP_GRANT_WIN_EFFECT: `${GAME_CONTRACT}#ship_grant`,
} as const;

export type WinEffectKey = keyof typeof WIN_EFFECT_IDS;

export function winEffectKey(e: WinEffect): WinEffectKey {
  if ("DecBonus" in e) return "DEC_BONUS_WIN_EFFECT";
  if ("HealAboveFloor" in e) return "HEAL_ABOVE_FLOOR_WIN_EFFECT";
  return "SHIP_GRANT_WIN_EFFECT";
}

export function winEffectId(e: WinEffect): string {
  return WIN_EFFECT_IDS[winEffectKey(e)];
}

export function keyForId(id: string): WinEffectKey | null {
  const entry = Object.entries(WIN_EFFECT_IDS).find(([, v]) => v.toLowerCase() === id.toLowerCase());
  return entry ? (entry[0] as WinEffectKey) : null;
}

export function decBonusOf(effects: readonly WinEffect[] | undefined): bigint | undefined {
  const e = effects?.find((x) => "DecBonus" in x) as { DecBonus: { amount: string } } | undefined;
  return e ? BigInt(e.DecBonus.amount) : undefined;
}

export function healPercentOf(effects: readonly WinEffect[] | undefined): number | undefined {
  const e = effects?.find((x) => "HealAboveFloor" in x) as { HealAboveFloor: { percent: number } } | undefined;
  return e?.HealAboveFloor.percent;
}

export function shipGrantOf(effects: readonly WinEffect[] | undefined): ShipGrant | undefined {
  const e = effects?.find((x) => "ShipGrant" in x) as { ShipGrant: ShipGrant } | undefined;
  return e?.ShipGrant;
}

export function toShipGrantSpec(g: ShipGrant): ShipGrantSpec {
  return {
    name: g.name,
    equipment: toEquipment(g.equipment),
    colors: { ...g.colors },
    variant: g.variant,
    accuracy: g.accuracy,
    hull: g.hull,
    speed: g.speed,
    shipsDestroyed: g.ships_destroyed,
    shiny: g.shiny,
    isFreeShip: g.is_free_ship,
    oncePerAddress: g.once_per_address,
  };
}

export function fromShipGrantSpec(s: ShipGrantSpec): ShipGrant {
  return {
    name: s.name.trim(),
    equipment: fromEquipment(s.equipment),
    colors: { ...s.colors },
    variant: s.variant,
    accuracy: s.accuracy,
    hull: s.hull,
    speed: s.speed,
    ships_destroyed: s.shipsDestroyed,
    shiny: s.shiny,
    is_free_ship: s.isFreeShip,
    once_per_address: s.oncePerAddress,
  };
}

/** Defaults for an effect newly added to a node. */
export interface WinEffectDefaults {
  decBonus: bigint;
  healPercent: number;
}

export const DEFAULT_WIN_EFFECTS: WinEffectDefaults = { decBonus: BigInt(1), healPercent: 50 };

/**
 * The node's new WinEffect list for a list of effect ids (in order),
 * keeping each kept effect's current values. A ship grant can only be kept,
 * not added from an id (it needs a ship: set one in Reward Ships).
 */
export function buildWinEffects(
  ids: readonly string[],
  current: readonly WinEffect[],
  defaults: WinEffectDefaults = DEFAULT_WIN_EFFECTS,
): WinEffect[] {
  const out: WinEffect[] = [];
  for (const id of ids) {
    const key = keyForId(id);
    const existing = current.find((e) => key && winEffectKey(e) === key);
    if (existing) {
      out.push(existing);
    } else if (key === "DEC_BONUS_WIN_EFFECT") {
      out.push({ DecBonus: { amount: defaults.decBonus.toString() } });
    } else if (key === "HEAL_ABOVE_FLOOR_WIN_EFFECT") {
      out.push({ HealAboveFloor: { percent: defaults.healPercent } });
    }
  }
  return out;
}
