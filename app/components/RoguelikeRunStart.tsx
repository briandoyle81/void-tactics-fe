"use client";

import React from "react";
import { useAccount } from "wagmi";
import { baseSepolia } from "viem/chains";
import { toast } from "react-hot-toast";
import { useOwnedShips } from "../hooks/useOwnedShips";
import { useFleetShipAttributes } from "../hooks/useFleetShipAttributes";
import { useFleetPlacement } from "../hooks/useFleetPlacement";
import { useRoguelikeMatch } from "../hooks/useRoguelikeMatch";
import {
  useRoguelikeCampaignInitialCostCap,
  useRoguelikeCampaignRequiredVariant,
} from "../hooks/useRoguelikeNodeMap";
import { buildFleetShipListItems } from "../utils/buildFleetShipListItems";
import { filterAndSortShips, navyFilterSecondaryOptions } from "../utils/navyFilters";
import { DUPLICATE_SHIP_ID_TOAST, hasDuplicateShipIds } from "../utils/fleetShipIds";
import {
  MIN_CONSTRUCTED_SHIPS_FOR_RUN,
  getRoguelikeRunRequirements,
  isRunEligibleConstructedShip,
} from "../utils/roguelikeRunRequirements";
import { ConstructShipsButton } from "./ConstructShipsButton";
import {
  BuyPremiumPacksButton,
  FLEET_HEADER_ACTION_CLASS,
  FleetBriefing,
  fleetBriefingStep,
} from "./FleetBriefing";
import { FreeShipsClaimAction, useFreeShipsClaim } from "./FreeShipsClaimAction";
import { RoguelikeFleetPicker } from "./operations/RoguelikeFleetPicker";

// Only campaign 1 exists today — same "default to 1, no real picker until a
// second campaign exists" approach as NodeMapAdminPanel.tsx takes for the
// original campaign system.
const DEFAULT_ROGUELIKE_CAMPAIGN_ID = 1n;

interface RoguelikeRunStartProps {
  /** Awaited so the button keeps showing "starting" until the run is readable. */
  onRunStarted: () => void | Promise<void>;
}

// "No active run" landing state: pick a roster (single variant, no per-
// mission reselection — the whole roster fights every combat node in the
// run), then RoguelikeMatch.startRun. The picker is RoguelikeFleetPicker,
// shared with the resupply node's fleet change (RoguelikeResupplyPanel).
export function RoguelikeRunStart({ onRunStarted }: RoguelikeRunStartProps) {
  const { address } = useAccount();
  const { startRun } = useRoguelikeMatch();
  const [isStarting, setIsStarting] = React.useState(false);

  const { ships, isLoading: shipsLoading, refetch: refetchShips } = useOwnedShips(baseSepolia.id);
  // One claim-status instance for the header's claim action.
  const claim = useFreeShipsClaim();

  const { data: requiredVariant } = useRoguelikeCampaignRequiredVariant(
    DEFAULT_ROGUELIKE_CAMPAIGN_ID,
  );
  const { data: initialCostCap } = useRoguelikeCampaignInitialCostCap(
    DEFAULT_ROGUELIKE_CAMPAIGN_ID,
  );
  const costLimit = initialCostCap != null ? Number(initialCostCap) : 0;

  // costsVersion staleness isn't checked here (no cost-limit action changes
  // based on it at this step) — costsVersion: null skips that check, same
  // opt-out useFleetPlacement already supports.
  const fleet = useFleetPlacement({
    ships,
    costLimit,
    costsVersion: null,
    isCreatorSide: true,
    requiredVariant,
  });

  const shipIdsForAttributes = React.useMemo(() => fleet.ships.map((s) => s.id), [fleet.ships]);
  const { attributesMap, attributesLoading } = useFleetShipAttributes(
    shipIdsForAttributes,
    baseSepolia.id,
  );

  const buildItems = (pageShips: typeof fleet.ships) =>
    buildFleetShipListItems({
      ships: pageShips,
      selectedShips: fleet.selectedShips,
      addShip: fleet.addShip,
      removeShip: fleet.removeShip,
      setDraggedShipId: fleet.setDraggedShipId,
      setDragOverPosition: fleet.setDragOverPosition,
      attributesMap,
      attributesLoading,
      showInGameProperties: true,
      flipShips: false,
    });

  const isOverCap = fleet.totalCost > costLimit && costLimit > 0;

  const constructedCount = React.useMemo(
    () =>
      ships.filter((s) =>
        isRunEligibleConstructedShip(
          {
            constructed: s.shipData.constructed,
            destroyed: s.shipData.timestampDestroyed > 0n,
            variant: s.traits.variant,
          },
          requiredVariant ?? 0,
        ),
      ).length,
    [ships, requiredVariant],
  );
  const unconstructedShips = React.useMemo(
    () => ships.filter((s) => !s.shipData.constructed),
    [ships],
  );
  const requirements = getRoguelikeRunRequirements({
    constructedCount,
    rosterCost: fleet.totalCost,
    costLimit,
  });

  const handleStartRun = async () => {
    if (!address) {
      toast.error("Please connect your wallet");
      return;
    }
    if (fleet.selectedShips.length === 0) {
      toast.error("Select at least one ship for your roster");
      return;
    }
    if (hasDuplicateShipIds(fleet.selectedShips)) {
      toast.error(DUPLICATE_SHIP_ID_TOAST);
      return;
    }
    if (isOverCap) {
      toast.error(`Roster cost exceeds this campaign's ${costLimit} limit.`);
      return;
    }
    if (!requirements.hasEnoughConstructed) {
      toast.error(`You need at least ${MIN_CONSTRUCTED_SHIPS_FOR_RUN} constructed ships to start a run.`);
      return;
    }
    if (!requirements.meetsMinRosterCost) {
      toast.error(`Roster cost must be at least ${requirements.minRosterCost}.`);
      return;
    }
    setIsStarting(true);
    try {
      await startRun(DEFAULT_ROGUELIKE_CAMPAIGN_ID, fleet.selectedShips);
      toast.success("Run started!");
      await onRunStarted();
    } catch (error) {
      console.error("Failed to start run:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("EmptyRoster")) {
        toast.error("Select at least one ship for your roster");
      } else if (message.includes("WrongCampaignVariant")) {
        toast.error("This campaign requires a different faction's fleet.");
      } else if (message.includes("DuplicateShipId")) {
        toast.error(DUPLICATE_SHIP_ID_TOAST);
      } else if (message.includes("RunAlreadyActive")) {
        toast.error("You already have a run in progress.");
      } else if (message.includes("CampaignNotFound") || message.includes("CampaignHasNoRoot")) {
        toast.error("This campaign isn't set up yet.");
      } else if (message.includes("User rejected") || message.includes("User denied")) {
        toast.error("Transaction declined by user");
      } else {
        toast.error(`Failed to start run: ${message}`);
      }
    } finally {
      setIsStarting(false);
    }
  };

  const rosterValid =
    fleet.selectedShips.length > 0 &&
    !isOverCap &&
    requirements.hasEnoughConstructed &&
    requirements.meetsMinRosterCost;
  const step = shipsLoading
    ? null
    : fleetBriefingStep({
        shipCount: ships.length,
        unconstructedCount: unconstructedShips.length,
        requirements,
        rosterValid,
      });

  return (
    <RoguelikeFleetPicker
      title="[SELECT YOUR FLEET]"
      headerAction={
        step === "claim" ? (
          <>
            <BuyPremiumPacksButton />
            <FreeShipsClaimAction
              status={claim.status}
              refetch={claim.refetch}
              className={FLEET_HEADER_ACTION_CLASS}
              showCountdown
              analyticsSurface="fleet_select"
              onClaimed={refetchShips}
            />
          </>
        ) : step === "construct" ? (
          <ConstructShipsButton
            unconstructedShips={unconstructedShips}
            className={FLEET_HEADER_ACTION_CLASS}
            onConstructed={refetchShips}
          />
        ) : (
          <button
            type="button"
            onClick={() => void handleStartRun()}
            disabled={isStarting || !rosterValid}
            className={FLEET_HEADER_ACTION_CLASS}
            style={{ borderRadius: 0 }}
          >
            {isStarting ? "[STARTING RUN...]" : `[START RUN (${costLimit > 0 ? `${fleet.totalCost}/${costLimit}` : fleet.totalCost})]`}
          </button>
        )
      }
      briefing={
        step != null ? (
          <FleetBriefing
            step={step}
            requirements={requirements}
            minConstructed={MIN_CONSTRUCTED_SHIPS_FOR_RUN}
            rosterCost={fleet.totalCost}
            costLimit={costLimit}
            requiredVariant={requiredVariant ?? 0}
            hasFactionShips={constructedCount > 0}
            selectedCount={fleet.selectedShips.length}
          />
        ) : null
      }
      ships={fleet.ships}
      lockedVariant={fleet.lockedVariant}
      isLoading={shipsLoading}
      isEmpty={ships.length === 0}
      filterAndSort={filterAndSortShips}
      secondaryOptions={navyFilterSecondaryOptions}
      buildItems={buildItems}
    />
  );
}
