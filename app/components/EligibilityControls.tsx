"use client";

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { TransactionButton } from "./TransactionButton";
import { useRoles } from "../near/useRoles";
import { useGameSettings } from "../near/useGameSettings";

/**
 * Selfie Check (World ID) verification for free claims and the tutorial:
 * one owner setting on the game contract (set_verification_requirements:
 * free claim, tutorial, and whether a verification's nullifier may be used
 * by only one account). The toggles start from get_settings; saving sets
 * all three at once.
 */
const EligibilityControls: React.FC = () => {
  const { isOwner } = useRoles();
  const [freeClaim, setFreeClaim] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [nullifierCheck, setNullifierCheck] = useState(true);
  const { data: settings } = useGameSettings();
  useEffect(() => {
    if (!settings) return;
    setFreeClaim(settings.free_claim_requires_verification);
    setTutorial(settings.tutorial_requires_verification);
    setNullifierCheck(settings.nullifier_check_enabled);
  }, [settings]);

  const toggle = (label: string, value: boolean, set: (v: boolean) => void) => (
    <label className="flex items-center gap-2 text-sm font-mono text-text-secondary cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );

  return (
    <div className="bg-near-black rounded-none p-4 border border-gunmetal">
      <h3 className="text-lg font-mono text-white mb-4">Free Ship / Tutorial Eligibility Verification</h3>
      <p className="text-xs text-text-muted font-mono mb-4">
        Whether claiming free ships or completing the tutorial requires passing Selfie Check identity
        verification. Off means fully open.
      </p>
      {!isOwner ? (
        <p className="text-text-muted text-xs font-mono">Only the game contract&apos;s owner can change this.</p>
      ) : (
        <div className="space-y-3">
          {toggle("Require verification for free ship claims", freeClaim, setFreeClaim)}
          {toggle("Require verification for the tutorial reward", tutorial, setTutorial)}
          {toggle("One account per verification (nullifier check)", nullifierCheck, setNullifierCheck)}
          <TransactionButton
            transactionId="set-verification-requirements"
            call={{
              method: "set_verification_requirements",
              args: { free_claim: freeClaim, tutorial, nullifier_check: nullifierCheck },
            }}
            className="w-full px-3 py-2 border border-cyan text-cyan rounded-none font-mono hover:bg-cyan/10 transition-colors text-sm"
            onSuccess={() => {
              toast.success("Verification settings saved");
            }}
            onError={(e) => {
              toast.error(`Failed to save verification settings: ${e.message.split("\n")[0]}`);
            }}
          >
            Save Verification Settings
          </TransactionButton>
        </div>
      )}
    </div>
  );
};

export default EligibilityControls;
