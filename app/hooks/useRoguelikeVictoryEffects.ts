"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import {
  useDECBonusAmount,
  useHealAboveFloorPercent,
  useRoguelikeNodeWinEffects,
  useWinEffectAddresses,
} from "./useWinEffects";
import { useNodeRewardShip } from "./useShipGrants";
import { useNodeRewardShipWeb2 } from "./useShipGrantsWeb2";
import {
  NO_VICTORY_EFFECTS,
  type RoguelikeVictoryEffects,
} from "../utils/missionDossierRows";

/** Web3: a roguelike node's win effects with their current on-chain values. */
export function useRoguelikeVictoryEffects(nodeId: bigint | undefined): RoguelikeVictoryEffects {
  const { data: effectAddresses } = useRoguelikeNodeWinEffects(nodeId);
  const addressByKey = useWinEffectAddresses();
  const { data: decBonus } = useDECBonusAmount();
  const { data: healToPercent } = useHealAboveFloorPercent();
  const rewardShip = useNodeRewardShip(nodeId != null ? Number(nodeId) : undefined);

  return useMemo(() => {
    if (!effectAddresses || effectAddresses.length === 0) return NO_VICTORY_EFFECTS;
    const assigned = new Set(effectAddresses.map((a) => a.toLowerCase()));
    const has = (key: string) => !!addressByKey[key] && assigned.has(addressByKey[key].toLowerCase());
    return {
      healAboveFloorPercent:
        has("HEAL_ABOVE_FLOOR_WIN_EFFECT") && healToPercent != null ? Number(healToPercent) : null,
      decBonus: has("DEC_BONUS_WIN_EFFECT") && decBonus != null ? Number(decBonus) : null,
      // Only when the node runs Grant Ship: a grant on a node without the
      // effect never mints.
      shipGrant: has("SHIP_GRANT_WIN_EFFECT") ? rewardShip : null,
    };
  }, [effectAddresses, addressByKey, decBonus, healToPercent, rewardShip]);
}

interface PublicWinEffectsSettings {
  decBonusAmount: number;
  healAboveFloorPercent: number;
}

/** Web2: a roguelike node's win effects (keys from RoguelikeNode.winEffects) with current values. */
export function useRoguelikeVictoryEffectsWeb2(
  nodeId: number | undefined,
  winEffects: readonly string[] | undefined,
): RoguelikeVictoryEffects {
  const hasAny = !!winEffects && winEffects.length > 0;
  const hasGrantEffect = !!winEffects?.includes("SHIP_GRANT_WIN_EFFECT");
  const rewardShip = useNodeRewardShipWeb2(hasGrantEffect ? nodeId : undefined);
  const { data: settings } = useQuery({
    queryKey: ["win-effects-settings", "public"],
    queryFn: () => apiFetch<PublicWinEffectsSettings>("/api/win-effects-settings"),
    enabled: hasAny,
    staleTime: 60_000,
  });

  return useMemo(() => {
    if (!hasAny || !settings) return NO_VICTORY_EFFECTS;
    return {
      healAboveFloorPercent: winEffects!.includes("HEAL_ABOVE_FLOOR_WIN_EFFECT")
        ? settings.healAboveFloorPercent
        : null,
      decBonus: winEffects!.includes("DEC_BONUS_WIN_EFFECT") ? settings.decBonusAmount : null,
      shipGrant: hasGrantEffect ? rewardShip : null,
    };
  }, [hasAny, settings, winEffects, hasGrantEffect, rewardShip]);
}
