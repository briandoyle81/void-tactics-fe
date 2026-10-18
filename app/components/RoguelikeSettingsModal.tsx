"use client";

import React from "react";
import type { Address } from "viem";
import {
  useCampaignAutoHealPercent,
  useRoguelikeCampaignRequiredVariant,
  useRoguelikeCampaignRootNode,
  useRoguelikeCampaignInitialCostCap,
} from "../hooks/useRoguelikeNodeMap";
import { useRoguelikeNodeMapAdmin } from "../hooks/useRoguelikeNodeMapAdmin";
import { useAIEncountersAdmin } from "../hooks/useAIEncountersAdmin";
import {
  useDECBonusAmount,
  useHealAboveFloorPercent,
  useShipGrantConfig,
} from "../hooks/useWinEffects";
import { useWinEffectsAdmin } from "../hooks/useWinEffectsAdmin";
import { RoguelikeSettingsForm } from "./operations/RoguelikeSettingsForm";

/**
 * Web3's campaign settings (see RoguelikeSettingsForm): each field reads
 * from and saves to its contract, one transaction per save. Bigints are
 * converted here.
 */
export function RoguelikeSettingsModal({
  campaignId,
  onClose,
  onSaved,
}: {
  campaignId: bigint;
  onClose: () => void;
  onSaved: () => void;
}) {
  const admin = useRoguelikeNodeMapAdmin();
  const encountersAdmin = useAIEncountersAdmin();
  const winEffectsAdmin = useWinEffectsAdmin();
  const { data: root, refetch: refetchRoot } = useRoguelikeCampaignRootNode(campaignId);
  const { data: autoHeal, refetch: refetchAutoHeal } = useCampaignAutoHealPercent(campaignId);
  const { data: requiredVariant, refetch: refetchVariant } = useRoguelikeCampaignRequiredVariant(campaignId);
  const { data: costCap, refetch: refetchCostCap } = useRoguelikeCampaignInitialCostCap(campaignId);
  const { data: decBonus, refetch: refetchDecBonus } = useDECBonusAmount();
  const { data: healAbove, refetch: refetchHealAbove } = useHealAboveFloorPercent();
  const { variant: grantVariant, tier: grantTier, refetch: refetchShipGrant } = useShipGrantConfig();

  return (
    <RoguelikeSettingsForm
      values={{
        rootNodeId: root != null ? Number(root) : undefined,
        autoHealPercent: autoHeal ?? undefined,
        requiredVariant: requiredVariant ?? undefined,
        initialCostCap: costCap?.toString(),
        decBonusAmount: decBonus?.toString(),
        healAboveFloorPercent: healAbove ?? undefined,
        shipGrantVariant: grantVariant ?? undefined,
        shipGrantTier: grantTier ?? undefined,
      }}
      saves={{
        rootNodeId: async (v) => {
          await admin.setCampaignRoot(campaignId, BigInt(v || "0"));
          await refetchRoot();
        },
        autoHealPercent: async (v) => {
          await admin.setCampaignAutoHealPercent(campaignId, v);
          await refetchAutoHeal();
        },
        requiredVariant: async (v) => {
          await admin.setCampaignRequiredVariant(campaignId, v);
          await refetchVariant();
        },
        initialCostCap: async (v) => {
          await admin.setCampaignInitialCostCap(campaignId, BigInt(v || "0"));
          await refetchCostCap();
        },
        repairCostPerHp: (v) => admin.setRepairCostPerHP(BigInt(v || "0")),
        decBonusAmount: async (v) => {
          await winEffectsAdmin.setDecBonusAmount(BigInt(v || "0"));
          await refetchDecBonus();
        },
        healAboveFloorPercent: async (v) => {
          await winEffectsAdmin.setHealAboveFloorPercent(v);
          await refetchHealAbove();
        },
        shipGrant: async (variant, tier) => {
          await winEffectsAdmin.setShipGrantConfig(variant, tier);
          await refetchShipGrant();
        },
      }}
      repairCostLabel="Repair cost per HP (wei)"
      decBonusLabel="DEC Bonus — amount minted per win"
      shipGrantLimits={{ variantMin: 1 }}
      onWithdraw={(to) => admin.withdrawResupplyFees(to as Address)}
      onSetEditor={async (address, allowed) => {
        await admin.setNodeEditor(address as Address, allowed);
        await encountersAdmin.setEncounterEditor(address as Address, allowed);
      }}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
