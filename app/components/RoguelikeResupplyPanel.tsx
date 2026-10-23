"use client";

import React from "react";
import { useAccount, useReadContract } from "wagmi";
import { baseSepolia } from "viem/chains";
import type { Abi } from "viem";
import { formatEther } from "viem";
import { toast } from "react-hot-toast";
import { TransactionButton } from "./TransactionButton";
import { useOwnedShips } from "../hooks/useOwnedShips";
import { useFleetShipAttributes } from "../hooks/useFleetShipAttributes";
import { useFleetPlacement } from "../hooks/useFleetPlacement";
import { useNavyFilterState } from "../hooks/useNavyFilterState";
import { useRoguelikeRunView } from "../hooks/useGameLens";
import { useRepairCostPerHP, useRoguelikeResupply, ROGUELIKE_RESUPPLY_ADDRESS } from "../hooks/useRoguelikeResupply";
import { CONTRACT_ABIS, getContractAddresses } from "../config/contracts";
import { RoguelikeRun, RoguelikeNode } from "../types/roguelike";
import { DUPLICATE_SHIP_ID_TOAST, hasDuplicateShipIds } from "../utils/fleetShipIds";
import { buildFleetShipListItems } from "../utils/buildFleetShipListItems";
import {
  filterAndSortShips,
  navyFilterSecondaryOptions,
  type NavyFilterCategory,
} from "../utils/navyFilters";
import { currentHullFromOnchainRosterHp, overlayHullPoints } from "../utils/rosterHull";
import {
  isResupplyCandidate,
  markRosterAvailableForSelect,
  resupplyCostLimit,
  rosterModifyDiff,
} from "../utils/resupplyFleet";
import { FleetShipListPanel } from "./FleetShipListPanel";
import { NavyFilterToolbar } from "./NavyFilterToolbar";
import { ManageNavyShipsCountHeading } from "./ManageNavyShipsCountHeading";
import { NavyPagination } from "./NavyPagination";
import { EmptyHangar, FLEET_HEADER_ACTION_CLASS } from "./FleetBriefing";
import { useSeedCombatRoster } from "./operations/RoguelikeCombatFleetModal";
import { RoguelikeFleetSelectScreen } from "./operations/RoguelikeFleetSelectScreen";

const SHIPS_PER_PAGE = 100;

const UTC_APPROVE_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

interface RoguelikeResupplyPanelProps {
  run: RoguelikeRun;
  node: RoguelikeNode;
  onDone: () => void;
}

/**
 * Resupply uses the same hangar picker as run start (RoguelikeRunStart):
 * select ships, see used/max points, confirm. Cards show live roster hull
 * and the cost cap is the node's new maximum.
 */
export function RoguelikeResupplyPanel({ run, node, onDone }: RoguelikeResupplyPanelProps) {
  const { address } = useAccount();
  const { ships: ownedShips, isLoading: shipsLoading, refetch: refetchOwnedShips } = useOwnedShips(
    baseSepolia.id,
  );
  const { resupplyModifyRoster } = useRoguelikeResupply();
  const { data: repairCostPerHP } = useRepairCostPerHP();
  const [isSaving, setIsSaving] = React.useState(false);

  const rosterIdSet = React.useMemo(
    () => new Set(run.rosterShipIds.map((id) => id.toString())),
    [run.rosterShipIds],
  );
  const requiredVariant = Number(run.requiredVariantAtStart ?? 0);
  const costLimit = resupplyCostLimit(Number(run.currentCostCap), Number(node.costCapOverride));
  const rosterVariant = ownedShips.find((s) => rosterIdSet.has(s.id.toString()))?.traits.variant;
  const lockedVariant = requiredVariant > 0 ? requiredVariant : rosterVariant;

  const selectableShips = React.useMemo(() => {
    const candidates = ownedShips.filter((s) =>
      isResupplyCandidate(
        {
          id: s.id.toString(),
          constructed: s.shipData.constructed,
          destroyed: s.shipData.timestampDestroyed > 0n,
          inFleet: s.shipData.inFleet,
          variant: s.traits.variant,
        },
        rosterIdSet,
        requiredVariant,
      ),
    );
    return markRosterAvailableForSelect(candidates, rosterIdSet);
  }, [ownedShips, rosterIdSet, requiredVariant]);

  const fleet = useFleetPlacement({
    ships: selectableShips,
    costLimit,
    costsVersion: null,
    isCreatorSide: true,
    requiredVariant: lockedVariant,
  });

  const rosterShips = React.useMemo(
    () => selectableShips.filter((s) => rosterIdSet.has(s.id.toString())),
    [selectableShips, rosterIdSet],
  );
  useSeedCombatRoster(fleet, rosterShips);

  const variantScopedShips = React.useMemo(
    () =>
      fleet.lockedVariant != null
        ? fleet.ships.filter((s) => s.traits.variant === fleet.lockedVariant)
        : fleet.ships,
    [fleet.ships, fleet.lockedVariant],
  );

  const filterState = useNavyFilterState(SHIPS_PER_PAGE);
  const getNavyFilterSecondaryOptions = React.useCallback(
    (category: NavyFilterCategory) => navyFilterSecondaryOptions(category, variantScopedShips),
    [variantScopedShips],
  );
  const filteredAndSortedShips = React.useMemo(
    () =>
      filterAndSortShips(
        variantScopedShips,
        filterState.activeFilters,
        filterState.sortBy,
        filterState.sortOrder,
        new Set(),
      ),
    [variantScopedShips, filterState.activeFilters, filterState.sortBy, filterState.sortOrder],
  );
  const paginatedShips = React.useMemo(
    () => filterState.paginate(filteredAndSortedShips),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredAndSortedShips, filterState.page],
  );

  const shipIdsForAttributes = React.useMemo(() => fleet.ships.map((s) => s.id), [fleet.ships]);
  const { attributesMap, attributesLoading } = useFleetShipAttributes(
    shipIdsForAttributes,
    baseSepolia.id,
  );
  const { hpByShipId, refetch: refetchHP } = useRoguelikeRunView(address, run.rosterShipIds.length > 0);
  const attributesWithRosterHull = React.useMemo(
    () =>
      overlayHullPoints(attributesMap, (id) => {
        if (!rosterIdSet.has(id.toString())) return undefined;
        return currentHullFromOnchainRosterHp(
          hpByShipId.get(id.toString()) ?? 0,
          attributesMap.get(id)?.maxHullPoints ?? 0,
        );
      }),
    [attributesMap, hpByShipId, rosterIdSet],
  );

  const shipListItems = buildFleetShipListItems({
    ships: paginatedShips,
    selectedShips: fleet.selectedShips,
    addShip: fleet.addShip,
    removeShip: fleet.removeShip,
    setDraggedShipId: fleet.setDraggedShipId,
    setDragOverPosition: fleet.setDragOverPosition,
    attributesMap: attributesWithRosterHull,
    attributesLoading,
    showInGameProperties: true,
    flipShips: false,
  });

  const isOverCap = fleet.totalCost > costLimit && costLimit > 0;
  const rosterValid = fleet.selectedShips.length > 0 && !isOverCap;

  const selectedRosterKeys = React.useMemo(
    () => new Set(fleet.selectedShips.filter((id) => rosterIdSet.has(id.toString())).map((id) => id.toString())),
    [fleet.selectedShips, rosterIdSet],
  );
  const totalMissingHP = React.useMemo(() => {
    let missing = 0;
    attributesWithRosterHull.forEach((attrs, id) => {
      if (!selectedRosterKeys.has(id.toString())) return;
      missing += Math.max(0, attrs.maxHullPoints - attrs.hullPoints);
    });
    return missing;
  }, [attributesWithRosterHull, selectedRosterKeys]);

  const contractAddresses = getContractAddresses(baseSepolia.id);
  const { data: utcBalance } = useReadContract({
    address: contractAddresses.UNIVERSAL_CREDITS as `0x${string}`,
    abi: CONTRACT_ABIS.UNIVERSAL_CREDITS as Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: baseSepolia.id,
    query: { enabled: !!address && totalMissingHP > 0 },
  });
  const { data: utcAllowance, refetch: refetchAllowance } = useReadContract({
    address: contractAddresses.UNIVERSAL_CREDITS as `0x${string}`,
    abi: CONTRACT_ABIS.UNIVERSAL_CREDITS as Abi,
    functionName: "allowance",
    args: address ? [address, ROGUELIKE_RESUPPLY_ADDRESS] : undefined,
    chainId: baseSepolia.id,
    query: { enabled: !!address && totalMissingHP > 0 },
  });
  const repairCost = (repairCostPerHP ?? 0n) * BigInt(totalMissingHP);
  const utcApproved = (utcAllowance as bigint | undefined) != null && (utcAllowance as bigint) >= repairCost;
  const repairKeys = React.useMemo(
    () => Array.from(selectedRosterKeys).filter((key) => {
      const id = BigInt(key);
      const attrs = attributesWithRosterHull.get(id);
      return !!attrs && attrs.hullPoints < attrs.maxHullPoints;
    }),
    [selectedRosterKeys, attributesWithRosterHull],
  );

  const handleConfirm = async () => {
    if (fleet.selectedShips.length === 0) {
      toast.error("Select at least one ship for your roster");
      return;
    }
    if (hasDuplicateShipIds(fleet.selectedShips)) {
      toast.error(DUPLICATE_SHIP_ID_TOAST);
      return;
    }
    if (isOverCap) {
      toast.error(`Roster cost exceeds this run's ${costLimit} limit.`);
      return;
    }
    const { add, remove } = rosterModifyDiff(run.rosterShipIds, fleet.selectedShips);
    if (add.length === 0 && remove.length === 0) {
      onDone();
      return;
    }
    setIsSaving(true);
    try {
      await resupplyModifyRoster(add, remove);
      toast.success("Roster updated");
      await refetchOwnedShips();
      onDone();
    } catch (error) {
      console.error("Failed to update roster:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("InvalidFleetCost")) {
        toast.error(`This fleet exceeds the run's ${costLimit} cost cap.`);
      } else if (message.includes("WrongCampaignVariant")) {
        toast.error("That ship's faction doesn't match this run's roster.");
      } else if (message.includes("DuplicateShipId")) {
        toast.error(DUPLICATE_SHIP_ID_TOAST);
      } else if (message.includes("ActiveGameInProgress")) {
        toast.error(
          "A match is still in progress. Return to it or let it finish before changing your roster.",
        );
      } else if (message.includes("User rejected") || message.includes("User denied")) {
        toast.error("Transaction declined by user");
      } else {
        toast.error(`Failed to update roster: ${message}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RoguelikeFleetSelectScreen
      title="[SELECT YOUR FLEET]"
      headerAction={
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSaving || !rosterValid}
          className={FLEET_HEADER_ACTION_CLASS}
          style={{ borderRadius: 0 }}
        >
          {isSaving
            ? "[UPDATING...]"
            : `[CONFIRM FLEET (${costLimit > 0 ? `${fleet.totalCost}/${costLimit}` : fleet.totalCost})]`}
        </button>
      }
      extra={
        totalMissingHP > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border border-cyan/40 bg-cyan/10 p-3 text-xs">
            <span className="text-cyan">
              Repair cost: {formatEther(repairCost)} UTC ({totalMissingHP} HP)
            </span>
            {!utcApproved ? (
              <TransactionButton
                transactionId={`approve-utc-roguelike-repair-${address}`}
                contractAddress={contractAddresses.UNIVERSAL_CREDITS as `0x${string}`}
                abi={UTC_APPROVE_ABI as Abi}
                functionName="approve"
                args={[ROGUELIKE_RESUPPLY_ADDRESS, repairCost]}
                className="border-2 border-cyan px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan transition-colors hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={(utcBalance as bigint | undefined) == null || (utcBalance as bigint) < repairCost}
                loadingText="[APPROVING...]"
                errorText="[ERROR APPROVING]"
                onSuccess={async () => {
                  await refetchAllowance();
                  toast.success("UTC approved!");
                }}
                onError={(error) => {
                  console.error("Failed to approve UTC:", error);
                  toast.error("Failed to approve UTC transfer");
                }}
                validateBeforeTransaction={() => {
                  if (!address) return "Please connect your wallet";
                  if ((utcBalance as bigint | undefined) == null || (utcBalance as bigint) < repairCost) {
                    return "Insufficient UTC balance";
                  }
                  return true;
                }}
              >
                [APPROVE {formatEther(repairCost)} UTC]
              </TransactionButton>
            ) : (
              <TransactionButton
                transactionId={`repair-roguelike-roster-${address}`}
                contractAddress={ROGUELIKE_RESUPPLY_ADDRESS}
                abi={CONTRACT_ABIS.ROGUELIKE_RESUPPLY as Abi}
                functionName="resupplyRepair"
                args={[repairKeys.map((id) => BigInt(id))]}
                className="border-2 border-phosphor-green px-4 py-2 text-xs font-bold uppercase tracking-wider text-phosphor-green transition-colors hover:bg-phosphor-green/10 disabled:cursor-not-allowed disabled:opacity-50"
                loadingText="[REPAIRING...]"
                errorText="[ERROR REPAIRING]"
                onSuccess={async () => {
                  await refetchHP();
                  toast.success("Repair complete!");
                }}
                onError={(error) => {
                  console.error("Failed to repair roster:", error);
                  const message = error instanceof Error ? error.message : String(error);
                  if (message.includes("ActiveGameInProgress")) {
                    toast.error("A match is still in progress. Return to it or let it finish before repairing.");
                  } else {
                    toast.error("Failed to repair roster");
                  }
                }}
              >
                [REPAIR {totalMissingHP} HP]
              </TransactionButton>
            )}
          </div>
        ) : null
      }
      filterToolbar={
        <NavyFilterToolbar
          activeFilters={filterState.activeFilters}
          onRemoveFilter={filterState.removeFilterById}
          onClearFilters={filterState.clearFilters}
          sortBy={filterState.sortBy}
          onSortByChange={filterState.setSortBy}
          sortOrder={filterState.sortOrder}
          onToggleSortOrder={() =>
            filterState.setSortOrder(filterState.sortOrder === "asc" ? "desc" : "asc")
          }
          showFilterWindow={filterState.showFilterWindow}
          onOpenFilterWindow={(anchor) => {
            filterState.setFilterWindowAnchor(anchor);
            filterState.setShowFilterWindow(true);
          }}
          onCloseFilterWindow={() => filterState.setShowFilterWindow(false)}
          filterWindowAnchor={filterState.filterWindowAnchor}
          draftCategory={filterState.draftCategory}
          getSecondaryOptions={getNavyFilterSecondaryOptions}
          onSelectCategory={(category) =>
            filterState.selectDraftCategory(category, getNavyFilterSecondaryOptions)
          }
          onToggleFilterValue={filterState.toggleFilterValue}
          onSetThreatFilter={filterState.setThreatFilter}
          onSetDraftValue={filterState.setDraftValue}
        />
      }
      countHeading={
        <ManageNavyShipsCountHeading
          shownCount={filteredAndSortedShips.length}
          totalCount={fleet.ships.length}
          perPage={SHIPS_PER_PAGE}
          page={filterState.page}
        />
      }
      pagination={
        filteredAndSortedShips.length > SHIPS_PER_PAGE ? (
          <NavyPagination
            page={filterState.page}
            pageCount={filterState.pageCount(filteredAndSortedShips.length)}
            onPrev={filterState.prevPage}
            onNext={() => filterState.nextPage(filteredAndSortedShips.length)}
          />
        ) : null
      }
      list={
        shipsLoading ? (
          <p className="text-sm text-text-muted">Loading your ships…</p>
        ) : selectableShips.length === 0 ? (
          <EmptyHangar />
        ) : (
          <FleetShipListPanel
            widthClass="w-full"
            items={shipListItems}
            gridColsClassName="grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3"
          />
        )
      }
    />
  );
}
