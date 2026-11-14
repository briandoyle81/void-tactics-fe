import { useMemo } from "react";
import { useNearView } from "../near/useNearView";
import { useChainAccount } from "../near/useChainAccount";
import { useGameRuleRead } from "./useGameRuleRead";
import type { Costs as NearCosts, VariantAttributeData as NearVariantAttributeData } from "../near/generated/voidTactics";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";
import { useGameSettings } from "../near/useGameSettings";
import type { GameSettings } from "../near/generated/voidTactics";

const selectMaxVariant = (s: GameSettings) => s.max_variant;

export interface GunData {
  range: number;
  damage: number;
  movement: number;
}

export interface ArmorData {
  damageReduction: number;
  movement: number;
}

export interface ShieldData {
  damageReduction: number;
  movement: number;
}

export interface SpecialData {
  range: number;
  strength: number;
  movement: number;
}

/** A published attributes table for one (variant, version). */
export interface VariantAttributeData {
  baseHull: number;
  baseSpeed: number;
  foreAccuracy: number[];
  hull: number[];
  engineSpeeds: number[];
  guns: GunData[];
  armors: ArmorData[];
  shields: ShieldData[];
  specials: SpecialData[];
  rankThresholds: number[];
  rankBonusPct: number[];
}

export interface Costs {
  version: number;
  baseCost: number;
  accuracy: number[];
  hull: number[];
  speed: number[];
  mainWeapon: number[];
  armor: number[];
  shields: number[];
  special: number[];
}

/** Fallback for the highest mintable variant until get_settings has loaded. */
export const MAX_VARIANT = 2;

export function toVariantAttributeData(d: NearVariantAttributeData): VariantAttributeData {
  return {
    baseHull: d.base_hull,
    baseSpeed: d.base_speed,
    foreAccuracy: d.fore_accuracy,
    hull: d.hull,
    engineSpeeds: d.engine_speeds,
    guns: d.guns,
    armors: d.armors.map((a) => ({ damageReduction: a.damage_reduction, movement: a.movement })),
    shields: d.shields.map((a) => ({ damageReduction: a.damage_reduction, movement: a.movement })),
    specials: d.specials,
    rankThresholds: d.rank_thresholds,
    rankBonusPct: d.rank_bonus_pct,
  };
}

/** App attributes table -> the contract's VariantAttributeData (publish_variant_attributes). */
export function fromVariantAttributeData(d: VariantAttributeData): NearVariantAttributeData {
  return {
    base_hull: d.baseHull,
    base_speed: d.baseSpeed,
    fore_accuracy: d.foreAccuracy,
    hull: d.hull,
    engine_speeds: d.engineSpeeds,
    guns: d.guns,
    armors: d.armors.map((a) => ({ damage_reduction: a.damageReduction, movement: a.movement })),
    shields: d.shields.map((a) => ({ damage_reduction: a.damageReduction, movement: a.movement })),
    specials: d.specials,
    rank_thresholds: d.rankThresholds,
    rank_bonus_pct: d.rankBonusPct,
  };
}

export function toCosts(c: NearCosts): Costs {
  return {
    version: c.version,
    baseCost: c.base_cost,
    accuracy: c.accuracy,
    hull: c.hull,
    speed: c.speed,
    mainWeapon: c.main_weapon,
    armor: c.armor,
    shields: c.shields,
    special: c.special,
  };
}

export function fromCosts(c: Costs): NearCosts {
  return {
    version: c.version,
    base_cost: c.baseCost,
    accuracy: c.accuracy,
    hull: c.hull,
    speed: c.speed,
    main_weapon: c.mainWeapon,
    armor: c.armor,
    shields: c.shields,
    special: c.special,
  };
}

/** The contract owner (owner_id), and whether the signed-in player is it. */
export function useShipAttributesOwner() {
  const { data } = useNearView("owner_id", {}, { staleTime: ADMIN_DATA_STALE_MS });
  const { address } = useChainAccount();
  const owner = typeof data === "string" ? data : undefined;
  return { owner, isOwner: !!address && !!owner && address === owner };
}

/** Callers that don't care about a specific faction use variant 1. */
export function useChainVariant() {
  return 1;
}

/** Highest ship variant (faction) players can mint; variants are 1..maxVariant. */
export function useMaxVariant() {
  const { data, isLoading, error } = useGameSettings(selectMaxVariant);
  return { data: data ?? MAX_VARIANT, isLoading, error };
}

/** The attributes version currently live for a variant; 0 means never configured. */
export function useCurrentAttributesVersion(variant: number) {
  const args = useMemo(() => ({ variant }), [variant]);
  return useNearView("get_current_attributes_version", args, { staleTime: ADMIN_DATA_STALE_MS });
}

/** Highest published version. The contract exposes only the live one, so this is the same. */
export function useLatestAttributesVersion(variant: number) {
  return useCurrentAttributesVersion(variant);
}

/** A variant's full attributes table at a given version; `version = 0` means "whatever's currently live". */
export function useVariantAttributes(variant: number, version: number = 0) {
  const current = useCurrentAttributesVersion(variant);
  const v = version || current.data || 0;
  const args = useMemo(() => (v > 0 ? { variant, version: v } : null), [variant, v]);
  const select = useMemo(
    () => (d: NearVariantAttributeData | null) => (d ? toVariantAttributeData(d) : undefined),
    [],
  );
  return useNearView("get_variant_attributes", args, { staleTime: ADMIN_DATA_STALE_MS, select });
}

const selectCosts = (c: NearCosts | null) => (c ? toCosts(c) : undefined);

/** A variant's live cost table version. */
export function useCurrentCostsVersion(variantOverride?: number) {
  const variant = variantOverride ?? 1;
  const args = useMemo(() => ({ variant }), [variant]);
  const result = useNearView("get_costs", args, { staleTime: ADMIN_DATA_STALE_MS, select: selectCosts });
  return { ...result, data: result.data?.version };
}

export function useCosts(variantOverride?: number) {
  const variant = variantOverride ?? 1;
  const args = useMemo(() => ({ variant }), [variant]);
  return useNearView("get_costs", args, { staleTime: ADMIN_DATA_STALE_MS, select: selectCosts });
}

/** A special's live stats (preview UI). */
export function useSpecialData(specialIndex: number, variant: number = 1) {
  const table = useVariantAttributes(variant || 1);
  const data = table.data?.specials[specialIndex];
  return { ...table, data };
}

// Specials are pinned per game: resolvers read a special's range/strength at
// the acting ship's pinned attributes.version, not the live table, so a
// mid-game rebalance can't change an in-flight game. In-game tooltips use
// these. Saved across sessions (useGameRuleRead): a pinned version's values
// never change.
function usePinnedSpecial(variant: number, version: number, special: number, enabled: boolean) {
  const args = useMemo(
    () => (enabled && version > 0 && variant > 0 ? { variant, version } : null),
    [enabled, variant, version],
  );
  const result = useGameRuleRead("get_variant_attributes", args);
  return { ...result, special: (result.data as NearVariantAttributeData | null | undefined)?.specials[special] };
}

export function useSpecialRangeAt(variant: number, version: number, special: number, enabled: boolean = true) {
  const r = usePinnedSpecial(variant, version, special, enabled);
  return { ...r, data: r.special?.range };
}

export function useSpecialStrengthAt(variant: number, version: number, special: number, enabled: boolean = true) {
  const r = usePinnedSpecial(variant, version, special, enabled);
  return { ...r, data: r.special?.strength };
}
