"use client";

import React from "react";
import type { RoguelikeCampaignWeb2 } from "../hooks/useRoguelikeWeb2";
import { useRoguelikeAdminWeb2 } from "../hooks/useRoguelikeAdminWeb2";
import { useWinEffectsAdminWeb2 } from "../hooks/useWinEffectsAdminWeb2";
import { RoguelikeSettingsForm } from "./operations/RoguelikeSettingsForm";

/**
 * Web2's campaign settings (see RoguelikeSettingsForm): campaign fields save
 * as one full-replace PUT. No editor-permission section (a flat admin
 * allowlist) and no withdraw (repair charges come straight off players' UTC
 * balances, nothing is escrowed).
 */
export function RoguelikeSettingsModalWeb2({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: RoguelikeCampaignWeb2;
  onClose: () => void;
  onSaved: () => void;
}) {
  const admin = useRoguelikeAdminWeb2();
  const winEffectsAdmin = useWinEffectsAdminWeb2();
  const [repairCostPerHp, setRepairCostPerHp] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    void admin.getRepairCostPerHp().then((s) => setRepairCostPerHp(s.repairCostPerHp.toString()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveCampaign = (overrides: Partial<RoguelikeCampaignWeb2>) =>
    admin.updateCampaign({ ...campaign, ...overrides });
  const settings = winEffectsAdmin.settings;

  return (
    <RoguelikeSettingsForm
      values={{
        rootNodeId: campaign.rootNodeId ?? null,
        autoHealPercent: campaign.autoHealPercent,
        requiredVariant: campaign.requiredVariant,
        initialCostCap: campaign.initialCostCap.toString(),
        repairCostPerHp,
        decBonusAmount: settings?.decBonusAmount.toString(),
        healAboveFloorPercent: settings?.healAboveFloorPercent,
        shipGrantVariant: settings?.shipGrantVariant,
        shipGrantTier: settings?.shipGrantTier,
      }}
      saves={{
        rootNodeId: (v) => saveCampaign({ rootNodeId: Number(v) || null }),
        autoHealPercent: (v) => saveCampaign({ autoHealPercent: v }),
        requiredVariant: (v) => saveCampaign({ requiredVariant: v }),
        initialCostCap: (v) => saveCampaign({ initialCostCap: Number(v) || 0 }),
        repairCostPerHp: (v) => admin.setRepairCostPerHp(Math.max(0, Number(v) || 0)),
        decBonusAmount: (v) => winEffectsAdmin.update({ decBonusAmount: Math.max(0, Number(v) || 0) }),
        shipGrant: (variant, tier) => winEffectsAdmin.update({ shipGrantVariant: variant, shipGrantTier: tier }),
      }}
      repairCostLabel="Repair cost per HP"
      decBonusLabel="DEC Bonus — amount credited per win"
      shipGrantLimits={{ variantMin: 0, variantMax: 2, tierMax: 3 }}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
