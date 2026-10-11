"use client";

import React from "react";
import { STYLE_LABEL, STYLE_MONO } from "../styles/fontStyles";
import { DialogPortrait } from "./DialogPortrait";
import { FreeShipsCard } from "./FreeShipsCard";
import { useCrewReporter } from "./CrewReport";
import { playSoundEffect } from "../hooks/useSoundEffects";
import { HighlightedText } from "./HighlightedText";

// The adjutant walks a new player through getting a fleet ready on the
// roguelike "Select your fleet" screen (RoguelikeRunStart /
// RoguelikeRunStartWeb2): first claim the free ships, then construct them.
// A dialog window with the real button inside it, so the button the
// adjutant points at is the one the player presses. Each step shows until
// it's done or the player closes it (closing lasts for this visit; it comes
// back next time if the step still needs doing).

export type FleetGuideStep = "claim" | "construct";

const LINES: Record<FleetGuideStep, (minConstructed: number) => string> = {
  claim: () =>
    "Admiral, our hangar is empty. Our membership in the Consortium allows us to claim ships from the drone shipyards. Once the claim is complete, the drones will construct them. In case you forgot, the drones are a bit weird. They construct the ships amazingly quickly, but generally ignore specific instructions on what to fit them with.",
  construct: (minConstructed) =>
    `The new ships are still in the shipyard. Construct them so they're ready to fly. You'll need at least ${minConstructed} built before we can launch.`,
};

const BUTTON_HINT: Record<FleetGuideStep, string> = {
  claim: "Press the claim button:",
  construct: "Press construct:",
};

export function AdjutantFleetGuide({
  step,
  minConstructed,
  constructButton,
}: {
  /** The step still to do, or null when the fleet is ready. */
  step: FleetGuideStep | null;
  minConstructed: number;
  /** The mode's own construct button (web3 / web2). */
  constructButton?: React.ReactNode;
}) {
  const adjutant = useCrewReporter("adjutant");
  const [dismissedStep, setDismissedStep] =
    React.useState<FleetGuideStep | null>(null);
  const isOpen = step != null && dismissedStep !== step;

  // The comms blip once per step as it opens.
  React.useEffect(() => {
    if (isOpen) playSoundEffect("/sound/comms.mp3");
  }, [isOpen, step]);

  if (!isOpen || step == null) return null;
  const close = () => setDismissedStep(step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${adjutant.name}: ${step === "claim" ? "claim your ships" : "construct your ships"}`}
    >
      <div
        className="dialog-arrive-spotlight w-full max-w-lg border-2 border-solid bg-near-black p-4 sm:p-5"
        style={{
          borderColor: adjutant.color,
          borderRadius: 0,
          ["--dialog-color" as string]: adjutant.color,
        }}
      >
        <div className="flex items-start gap-3">
          <DialogPortrait
            character={adjutant.character}
            name={adjutant.name}
            color={adjutant.color}
            sizeClass="h-16 w-16 sm:h-20 sm:w-20"
          />
          <div className="min-w-0 flex-1">
            <div
              className="mb-1 text-[10px] uppercase tracking-[0.3em] text-text-muted"
              style={STYLE_MONO}
            >
              Incoming transmission · Step {step === "claim" ? 1 : 2} of 2
            </div>
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-sm font-bold uppercase tracking-widest"
                style={{ ...STYLE_LABEL, color: adjutant.color }}
              >
                {adjutant.name}
              </span>
              <button
                type="button"
                aria-label="Close"
                className="px-1 text-lg leading-none text-text-muted hover:text-text-primary"
                onClick={close}
              >
                ×
              </button>
            </div>
            <p
              className="mt-1 text-sm leading-snug"
              style={{ ...STYLE_MONO, color: adjutant.color }}
            >
              <HighlightedText text={LINES[step](minConstructed)} />
            </p>
          </div>
        </div>

        <div
          className="mt-4 border-t border-solid pt-3"
          style={{ borderColor: "var(--color-gunmetal)" }}
        >
          <div
            className="mb-2 text-[10px] uppercase tracking-widest text-text-muted"
            style={STYLE_MONO}
          >
            {BUTTON_HINT[step]}
          </div>
          {step === "claim" ? (
            <FreeShipsCard />
          ) : (
            <div className="flex justify-center">{constructButton}</div>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="border border-solid px-3 py-1 text-xs font-bold uppercase tracking-widest text-text-secondary transition-colors hover:bg-white/5"
            style={{
              ...STYLE_LABEL,
              borderColor: "var(--color-gunmetal)",
              borderRadius: 0,
            }}
            onClick={close}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

/** Which guide step applies, from the run-start screen's own ship state. */
export function fleetGuideStep(params: {
  shipsLoading: boolean;
  shipCount: number;
  hasEnoughConstructed: boolean;
  unconstructedCount: number;
}): FleetGuideStep | null {
  if (params.shipsLoading) return null;
  if (params.shipCount === 0) return "claim";
  if (!params.hasEnoughConstructed && params.unconstructedCount > 0)
    return "construct";
  return null;
}
