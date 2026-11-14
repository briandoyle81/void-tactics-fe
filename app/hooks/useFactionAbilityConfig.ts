import { useMemo } from "react";
import { useGameRuleRead } from "./useGameRuleRead";
import type { Resolver } from "../near/generated/voidTactics";

// Every ship's innate faction ability — variant 1's Ram, variant 2's Repair —
// is dispatched via ActionType.FactionAbility and resolved by the variant's
// faction resolver (get_faction_resolver: Ram { range } or Repair { range,
// strength }), separate from the equipped-Special table.

function useFactionResolver(variant: number) {
  const args = useMemo(() => ({ variant }), [variant]);
  const { data } = useGameRuleRead("get_faction_resolver", args);
  return data as Resolver | null | undefined;
}

/** Variant 1's Ram (evict a downed enemy). */
export function useRamResolverConfig() {
  const resolver = useFactionResolver(1);
  const ram = resolver && "Ram" in resolver ? resolver.Ram : undefined;
  return { range: ram?.range, isSupported: true };
}

/** Variant 2's Repair (heal a friendly, including self). */
export function useRepairResolverConfig() {
  const resolver = useFactionResolver(2);
  const repair = resolver && "Repair" in resolver ? resolver.Repair : undefined;
  return { range: repair?.range, strength: repair?.strength, isSupported: true };
}

/** Whichever resolver applies to `variant` (defaults to Ram/variant 1 for an unknown/undefined variant). */
export function useFactionAbilityConfig(variant: number | undefined) {
  const ram = useRamResolverConfig();
  const repair = useRepairResolverConfig();
  return useMemo(() => {
    if (Number(variant) === 2) {
      return { range: repair.range, strength: repair.strength, isSupported: true, isHeal: true };
    }
    return { range: ram.range, strength: undefined, isSupported: true, isHeal: false };
  }, [variant, ram.range, repair.range, repair.strength]);
}
