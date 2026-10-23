"use client";

import React from "react";
import { useNavyFilterState } from "../../hooks/useNavyFilterState";
import type {
  NavyFilterCategory,
  NavyFilterCriterion,
  NavySortField,
  NavySortOrder,
} from "../../utils/navyFilters";
import { FleetShipListPanel, type FleetShipListItemData } from "../FleetShipListPanel";
import { NavyFilterToolbar } from "../NavyFilterToolbar";
import { ManageNavyShipsCountHeading } from "../ManageNavyShipsCountHeading";
import { NavyPagination } from "../NavyPagination";
import { EmptyHangar } from "../FleetBriefing";
import { RoguelikeFleetSelectScreen } from "./RoguelikeFleetSelectScreen";

// The roguelike fleet picker, one component for picking a fleet at run start
// (RoguelikeRunStart / Web2) and changing it at a resupply node
// (RoguelikeResupplyPanel / Web2): the faction lock, Manage Navy's filter and
// sort toolbar, pagination and the ship cards. Callers bring the ships and
// fleet state (useFleetPlacement), their header action and extras, and the
// web3 or web2 filter and card builders; resupply's cards carry each roster
// ship's live run hull, so ShipCard shows its HP and HP bar.

const SHIPS_PER_PAGE = 100;

interface RoguelikeFleetPickerProps<S extends { traits: { variant: number } }> {
  title: string;
  headerAction: React.ReactNode;
  briefing?: React.ReactNode;
  extra?: React.ReactNode;
  /** Every pickable ship (useFleetPlacement's `ships`). */
  ships: S[];
  /** The faction the fleet is locked to, if any (useFleetPlacement's `lockedVariant`). */
  lockedVariant: number | null | undefined;
  isLoading: boolean;
  /** Nothing to pick from: shows the empty hangar. */
  isEmpty: boolean;
  filterAndSort: (
    ships: S[],
    filters: NavyFilterCriterion[],
    sortBy: NavySortField,
    sortOrder: NavySortOrder,
    starredShipIds: Set<string>,
  ) => S[];
  secondaryOptions: (category: NavyFilterCategory, ships: S[]) => { value: string; label: string }[];
  /** The cards for one page of ships (buildFleetShipListItems / Web2). */
  buildItems: (pageShips: S[]) => FleetShipListItemData[];
}

const NO_STARRED = new Set<string>();

export function RoguelikeFleetPicker<S extends { traits: { variant: number } }>({
  title,
  headerAction,
  briefing,
  extra,
  ships,
  lockedVariant,
  isLoading,
  isEmpty,
  filterAndSort,
  secondaryOptions,
  buildItems,
}: RoguelikeFleetPickerProps<S>) {
  // useFleetPlacement's own filteredShips applies fleetFilters.ts filtering
  // (the simpler set) and is deliberately unused: the faction lock comes
  // from the hook, the display filtering and sorting are Manage Navy's.
  const variantScopedShips = React.useMemo(
    () => (lockedVariant != null ? ships.filter((s) => s.traits.variant === lockedVariant) : ships),
    [ships, lockedVariant],
  );

  const filterState = useNavyFilterState(SHIPS_PER_PAGE);
  const getSecondaryOptions = React.useCallback(
    (category: NavyFilterCategory) => secondaryOptions(category, variantScopedShips),
    [secondaryOptions, variantScopedShips],
  );
  const filteredAndSortedShips = React.useMemo(
    () =>
      filterAndSort(
        variantScopedShips,
        filterState.activeFilters,
        filterState.sortBy,
        filterState.sortOrder,
        NO_STARRED,
      ),
    [filterAndSort, variantScopedShips, filterState.activeFilters, filterState.sortBy, filterState.sortOrder],
  );
  const paginatedShips = React.useMemo(
    () => filterState.paginate(filteredAndSortedShips),
    // filterState is a fresh object every render; depend on the specific
    // stable member actually used, not the whole object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredAndSortedShips, filterState.page],
  );

  return (
    <RoguelikeFleetSelectScreen
      title={title}
      headerAction={headerAction}
      briefing={briefing}
      extra={extra}
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
          getSecondaryOptions={getSecondaryOptions}
          onSelectCategory={(category) => filterState.selectDraftCategory(category, getSecondaryOptions)}
          onToggleFilterValue={filterState.toggleFilterValue}
          onSetThreatFilter={filterState.setThreatFilter}
          onSetDraftValue={filterState.setDraftValue}
        />
      }
      countHeading={
        <ManageNavyShipsCountHeading
          shownCount={filteredAndSortedShips.length}
          totalCount={ships.length}
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
        isLoading ? (
          <p className="text-sm text-text-muted">Loading your ships…</p>
        ) : isEmpty ? (
          <EmptyHangar />
        ) : (
          <FleetShipListPanel
            widthClass="w-full"
            items={buildItems(paginatedShips)}
            gridColsClassName="grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3"
          />
        )
      }
    />
  );
}
