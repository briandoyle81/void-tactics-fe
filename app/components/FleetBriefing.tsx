"use client";

import React from "react";
import { STYLE_LABEL, STYLE_MONO } from "../styles/fontStyles";
import { DialogPortrait } from "./DialogPortrait";
import { useCrewReporter } from "./CrewReport";
import { getFactionName } from "../config/factions";
import { navigateToClientTab } from "../utils/clientNavigation";
import type { RoguelikeRunRequirements } from "../utils/roguelikeRunRequirements";

// The roguelike "Select your fleet" screen's briefing (RoguelikeRunStart /
// RoguelikeRunStartWeb2): the adjutant says what to do next and why, by
// step, with the run's requirements as live status tags under it. The one
// action for the step sits in the screen's header in the Start run spot
// (claim, construct, then start: fleetBriefingStep picks which).

export type FleetBriefingStep = "claim" | "construct" | "pick" | "ready";

export function fleetBriefingStep(params: {
  shipCount: number;
  unconstructedCount: number;
  requirements: RoguelikeRunRequirements;
  rosterValid: boolean;
}): FleetBriefingStep {
  if (params.shipCount === 0) return "claim";
  if (!params.requirements.hasEnoughConstructed && params.unconstructedCount > 0) return "construct";
  return params.rosterValid ? "ready" : "pick";
}

function briefingText(params: {
  step: FleetBriefingStep;
  minConstructed: number;
  minRosterCost: number;
  costLimit: number;
  rosterCost: number;
  requiredVariant: number;
}): string {
  const { step, minConstructed, minRosterCost, costLimit, rosterCost, requiredVariant } = params;
  switch (step) {
    case "claim":
      return "Admiral, our hangar is empty. Our membership in the Consortium allows us to claim ships from the drone shipyards. Once the claim is complete, the drones will construct them. In case you forgot, the drones are a bit weird. They construct the ships amazingly quickly, but generally ignore specific instructions on what to fit them with.";
    case "construct":
      return `The claim went through, and our hulls are waiting at the drone yards. Give the order and they'll be built and ready to fly. Headquarters won't clear us to launch with fewer than ${minConstructed} ships built, so let's get them all done.`;
    case "pick": {
      const faction = requiredVariant ? ` ${getFactionName(requiredVariant)} hulls only.` : "";
      return `Now pick who flies. Choose carefully: whoever we take stays with us for the whole operation, damage and all, and we can't swap ships between missions. Headquarters will fund up to ${costLimit} in fleet value, but won't sign off on less than ${minRosterCost}. They want a committed force.${faction}`;
    }
    case "ready":
      return `That's a solid group, Admiral: ${rosterCost} of our ${costLimit}. Headquarters has signed off. One more thing: the routes ahead branch, and once we commit to a path the others close behind us. Start the run when you're ready.`;
  }
}

function StatusTag({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`border border-solid px-2.5 py-1.5 ${ok ? "text-phosphor-green" : "text-amber"}`}
      style={{ borderColor: "var(--color-gunmetal)" }}
    >
      {ok ? "[OK]" : "[ ]"} {children}
    </span>
  );
}

export function FleetBriefing({
  step,
  requirements,
  minConstructed,
  rosterCost,
  costLimit,
  requiredVariant,
  hasFactionShips,
  selectedCount,
}: {
  step: FleetBriefingStep;
  requirements: RoguelikeRunRequirements;
  minConstructed: number;
  rosterCost: number;
  costLimit: number;
  /** 0: any faction. */
  requiredVariant: number;
  /** The player has a built ship of the required faction. */
  hasFactionShips: boolean;
  selectedCount: number;
}) {
  const adjutant = useCrewReporter("adjutant");
  const text = briefingText({
    step,
    minConstructed,
    minRosterCost: requirements.minRosterCost,
    costLimit,
    rosterCost,
    requiredVariant,
  });
  const rosterInRange = requirements.meetsMinRosterCost && rosterCost > 0 && (costLimit === 0 || rosterCost <= costLimit);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-start gap-4 border-2 border-solid bg-near-black p-4 sm:p-5"
        style={{ borderColor: adjutant.color, borderRadius: 0 }}
      >
        <DialogPortrait
          character={adjutant.character}
          name={adjutant.name}
          color={adjutant.color}
          sizeClass="h-16 w-16 sm:h-24 sm:w-24"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span
              className="text-base font-bold uppercase tracking-widest"
              style={{ ...STYLE_LABEL, color: adjutant.color }}
            >
              {adjutant.name}
            </span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-text-secondary" style={STYLE_MONO}>
              Fleet briefing
            </span>
          </div>
          <p className="m-0 text-sm leading-relaxed" style={{ ...STYLE_MONO, color: adjutant.color }}>
            {text}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 text-xs" style={STYLE_MONO}>
        {!!requiredVariant && (
          <StatusTag ok={hasFactionShips}>{getFactionName(requiredVariant)} hulls only</StatusTag>
        )}
        <StatusTag ok={requirements.hasEnoughConstructed}>
          Ships built: {requirements.constructedCount} / {minConstructed}
        </StatusTag>
        {costLimit > 0 && (
          <StatusTag ok={rosterInRange}>
            Roster value {requirements.minRosterCost} to {costLimit}: {rosterCost}
          </StatusTag>
        )}
        <span className="ml-auto text-text-muted">Selected: {selectedCount}</span>
      </div>
    </div>
  );
}

/** The ship list's place while the hangar is empty. */
export function EmptyHangar() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 border border-dashed p-10 text-center font-mono text-sm text-text-muted"
      style={{ borderColor: "var(--color-gunmetal)" }}
    >
      <span>Your hangar is empty.</span>
      <span className="text-xs">Ships you claim appear here.</span>
    </div>
  );
}

const HEADER_BUTTON =
  "shrink-0 border-2 px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40";
/** The header action's look (Start run, claim, construct). */
export const FLEET_HEADER_ACTION_CLASS = `${HEADER_BUTTON} border-phosphor-green text-phosphor-green hover:bg-phosphor-green/10`;

/** Opens the Store's ship packs, beside the claim action. */
export function BuyPremiumPacksButton() {
  return (
    <button
      type="button"
      className={`${HEADER_BUTTON} border-cyan text-cyan hover:bg-cyan/10`}
      style={{ borderRadius: 0 }}
      onClick={() =>
        navigateToClientTab("Store", "void-tactics-navigate-to-store", undefined, { section: "packs" })
      }
    >
      [BUY PREMIUM PACKS]
    </button>
  );
}
