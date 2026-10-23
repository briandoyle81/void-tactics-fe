"use client";

import React from "react";
import { toast } from "react-hot-toast";
import { useOwnedShipsWeb2 } from "../hooks/useOwnedShipsWeb2";
import { useShipAttributesByIdsWeb2 } from "../hooks/useShipAttributesByIdsWeb2";
import { useFleetPlacementWeb2 } from "../hooks/useFleetPlacement";
import { useRoguelikeCampaignWeb2, useRoguelikeMatchWeb2 } from "../hooks/useRoguelikeWeb2";
import { buildFleetShipListItemsWeb2 } from "../utils/buildFleetShipListItemsWeb2";
import {
  navyFilterSecondaryOptionsWeb2,
  filterAndSortShipsWeb2,
} from "../utils/navyFiltersWeb2";
import {
  BuyPremiumPacksButton,
  FLEET_HEADER_ACTION_CLASS,
  FleetBriefing,
  fleetBriefingStep,
} from "./FleetBriefing";
import { FreeShipsClaimAction, useFreeShipsClaim } from "./FreeShipsClaimAction";
import { DUPLICATE_SHIP_ID_TOAST, hasDuplicateShipIds } from "../utils/fleetShipIds";
import {
  MIN_CONSTRUCTED_SHIPS_FOR_RUN,
  getRoguelikeRunRequirements,
  isRunEligibleConstructedShip,
} from "../utils/roguelikeRunRequirements";
import { constructAllShipsWeb2 } from "../utils/constructShipsWeb2";
import { RoguelikeFleetPicker } from "./operations/RoguelikeFleetPicker";

const DEFAULT_ROGUELIKE_CAMPAIGN_ID = 1;

interface RoguelikeRunStartWeb2Props {
  onRunStarted: () => void;
}

// Web2 counterpart to RoguelikeRunStart.tsx — the literal same ship cards
// (buildFleetShipListItemsWeb2/ShipCard) and the same Manage Navy filter/
// sort toolbar (useNavyFilterState/NavyFilterToolbar/filterAndSortShipsWeb2),
// only the data source (useOwnedShipsWeb2/useRoguelikeCampaignWeb2) and
// write mutation (useRoguelikeMatchWeb2) differ.
export function RoguelikeRunStartWeb2({ onRunStarted }: RoguelikeRunStartWeb2Props) {
  const { startRun } = useRoguelikeMatchWeb2();
  const [isStarting, setIsStarting] = React.useState(false);

  const { ships, isLoading: shipsLoading, refetch: refetchShips } = useOwnedShipsWeb2();
  // One claim-status instance for the header's claim action.
  const claim = useFreeShipsClaim();
  const [isConstructing, setIsConstructing] = React.useState(false);
  const { campaign } = useRoguelikeCampaignWeb2(DEFAULT_ROGUELIKE_CAMPAIGN_ID);

  const requiredVariant = campaign?.requiredVariant ?? 0;
  const costLimit = campaign?.initialCostCap ?? 0;

  const fleet = useFleetPlacementWeb2({
    ships,
    costLimit,
    costsVersion: null,
    isCreatorSide: true,
    requiredVariant,
  });

  const shipIdsForAttributes = React.useMemo(() => fleet.ships.map((s) => s.id), [fleet.ships]);
  const { attributesByShipId, isLoading: attributesLoading } =
    useShipAttributesByIdsWeb2(shipIdsForAttributes);

  const buildItems = (pageShips: typeof fleet.ships) =>
    buildFleetShipListItemsWeb2({
      ships: pageShips,
      selectedShips: fleet.selectedShips,
      addShip: fleet.addShip,
      removeShip: fleet.removeShip,
      setDraggedShipId: fleet.setDraggedShipId,
      setDragOverPosition: fleet.setDragOverPosition,
      attributesMap: attributesByShipId,
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
            destroyed: s.shipData.timestampDestroyed > 0,
            variant: s.traits.variant,
          },
          requiredVariant,
        ),
      ).length,
    [ships, requiredVariant],
  );
  const requirements = getRoguelikeRunRequirements({
    constructedCount,
    rosterCost: fleet.totalCost,
    costLimit,
  });

  const handleConstructAll = async () => {
    setIsConstructing(true);
    try {
      const constructed = await constructAllShipsWeb2();
      toast.success(`Constructed ${constructed} ship(s)`);
      await refetchShips();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to construct ships");
    } finally {
      setIsConstructing(false);
    }
  };

  const handleStartRun = async () => {
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
      onRunStarted();
    } catch (error) {
      console.error("Failed to start run:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start run");
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
        unconstructedCount: ships.filter((s) => !s.shipData.constructed).length,
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
          <button
            type="button"
            onClick={() => void handleConstructAll()}
            disabled={isConstructing}
            className={FLEET_HEADER_ACTION_CLASS}
            style={{ borderRadius: 0 }}
          >
            {isConstructing ? "[CONSTRUCTING...]" : "[CONSTRUCT ALL SHIPS]"}
          </button>
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
      filterAndSort={filterAndSortShipsWeb2}
      secondaryOptions={navyFilterSecondaryOptionsWeb2}
      buildItems={buildItems}
    />
  );
}
