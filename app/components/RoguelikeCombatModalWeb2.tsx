"use client";

import React from "react";
import { toast } from "react-hot-toast";
import {
  RoguelikeCombatFleetModal,
  positionsInRosterOrder,
  useSeedCombatRoster,
} from "./operations/RoguelikeCombatFleetModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { waitForPlayerGameWeb2 } from "../utils/waitForPlayerGame";
import { navigateToGameWeb2 } from "../utils/navigateToGame";
import { MapDisplayWeb2 } from "./MapDisplayWeb2";
import { useFleetPlacementWeb2 } from "../hooks/useFleetPlacement";
import { useShipAttributesByIdsWeb2 } from "../hooks/useShipAttributesByIdsWeb2";
import { buildFleetShipListItemsWeb2 } from "../utils/buildFleetShipListItemsWeb2";
import { useRoguelikeMatchWeb2, type RoguelikeRunWeb2, type RoguelikeNodeWeb2 } from "../hooks/useRoguelikeWeb2";
import { aiConfigToPreviewShipWeb2, type AIShipConfigWeb2 } from "../utils/aiShipConfigWeb2";
import type { Web2Ship } from "../types/web2Ship";
import { useMapWeb2 } from "../hooks/useMapWeb2";
import { GRID_DIMENSIONS } from "../types/types";

interface AIMapPlacementWeb2 {
  id: number;
  row: number;
  col: number;
  configId: number;
  config: AIShipConfigWeb2;
}

const ENEMY_PREVIEW_ID_OFFSET = 100_000_000;

interface RoguelikeCombatModalWeb2Props {
  run: RoguelikeRunWeb2;
  targetNode: RoguelikeNodeWeb2;
  onClose: () => void;
  onLaunched: () => void;
}

// Web2 counterpart to RoguelikeCombatModal.tsx — same FleetSelectionModal
// chrome and drag-and-drop MapDisplay*, roster fixed to the run's
// already-committed roster (no per-mission squad selection — see
// RoguelikeCombatModal.tsx's own doc-comment), only positioning is left to
// the player.
export function RoguelikeCombatModalWeb2({
  run,
  targetNode,
  onClose,
  onLaunched,
}: RoguelikeCombatModalWeb2Props) {
  const { enterCombatNode } = useRoguelikeMatchWeb2();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isWarping, setIsWarping] = React.useState(false);
  const { userId } = useCurrentUser();
  const [showInGameProperties, setShowInGameProperties] = React.useState(true);

  const rosterShips: Web2Ship[] = React.useMemo(() => run.roster.map((r) => r.ship), [run.roster]);

  // The player is the creator side in single-player.
  const { creatorZone } = useMapWeb2(targetNode.mapId ?? 0, GRID_DIMENSIONS.WIDTH, GRID_DIMENSIONS.HEIGHT);
  // A run's roster is a single faction; lock placement to it (the hook
  // otherwise defaults to faction 1 and would skip a faction-2 roster).
  const rosterVariant = rosterShips[0]?.traits.variant;
  const fleet = useFleetPlacementWeb2({
    ships: rosterShips,
    requiredVariant: rosterVariant,
    costLimit: Number.MAX_SAFE_INTEGER,
    costsVersion: null,
    isCreatorSide: true,
    zoneTiles: creatorZone,
  });

  useSeedCombatRoster(fleet, rosterShips);

  const { data: placements } = useQuery({
    queryKey: ["ai-map-placements", targetNode.mapId],
    queryFn: () => apiFetch<AIMapPlacementWeb2[]>(`/api/ai-map-placements?mapId=${targetNode.mapId}`),
    enabled: targetNode.mapId != null,
  });
  const enemyShips = React.useMemo(() => {
    if (!placements) return [];
    return placements.map((p, i) => ({
      ship: aiConfigToPreviewShipWeb2(p.config, ENEMY_PREVIEW_ID_OFFSET + i),
      row: p.row,
      col: p.col,
    }));
  }, [placements]);

  const shipIdsForAttributes = React.useMemo(() => fleet.ships.map((s) => s.id), [fleet.ships]);
  const {
    attributesByShipId,
    isLoading: attributesLoading,
    isFromCache: isAttributesFromCache,
  } = useShipAttributesByIdsWeb2(shipIdsForAttributes);

  const handleLaunch = async () => {
    if (fleet.selectedShips.length === 0 || !fleet.hasMovedShip) return;
    setIsSubmitting(true);
    try {
      // The enter-combat route pairs startingPositions[i] with run.roster[i],
      // so send them in roster order, not the order ships were placed.
      const startingPositions = positionsInRosterOrder(
        run.roster.map((r) => r.shipId),
        fleet.shipPositions,
      );
      if (!startingPositions) {
        toast.error("Every roster ship needs a starting position.");
        return;
      }
      const { gameId } = await enterCombatNode(targetNode.id, startingPositions);
      // Open the new game directly, once the Games tab's cached list has it
      // (mirrors the web3 launch modals' waitForPlayerGame).
      setIsWarping(true);
      const found = await waitForPlayerGameWeb2({ queryClient, gameId });
      if (!found) toast("Mission started. Still syncing your games list…");
      navigateToGameWeb2(userId, gameId);
      toast.success("Mission launched!");
      onLaunched();
    } catch (error) {
      console.error("Failed to enter combat node:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("already in progress")) {
        toast.error("A match is already in progress.");
      } else if (message.includes("reachable")) {
        toast.error("This node isn't reachable from your current position.");
      } else if (message.includes("already been cleared")) {
        toast.error("This node has already been cleared and can't be re-fought.");
      } else if (message.includes("no AI content")) {
        toast.error("This mission has no enemy fleet configured yet.");
      } else {
        toast.error(`Failed to launch mission: ${message}`);
      }
    } finally {
      setIsSubmitting(false);
      setIsWarping(false);
    }
  };

  const shipListItems = buildFleetShipListItemsWeb2({
    ships: fleet.filteredShips,
    selectedShips: fleet.selectedShips,
    addShip: fleet.addShip,
    removeShip: fleet.removeShip,
    setDraggedShipId: fleet.setDraggedShipId,
    setDragOverPosition: fleet.setDragOverPosition,
    attributesMap: attributesByShipId,
    attributesLoading,
    showInGameProperties,
    flipShips: true,
  });

  const mapShips: Web2Ship[] = React.useMemo(
    () => [...fleet.ships, ...enemyShips.map((e) => e.ship)],
    [fleet.ships, enemyShips],
  );
  const mapShipPositions = React.useMemo(
    () => [
      ...fleet.shipPositions,
      ...enemyShips.map((e) => ({ shipId: e.ship.id, row: e.row, col: e.col })),
    ],
    [fleet.shipPositions, enemyShips],
  );

  const mapDisplay = (
    <MapDisplayWeb2
      mapId={targetNode.mapId ?? 0}
      className="w-full h-full"
      showPlayerOverlay={true}
      isCreator={true}
      isCreatorViewer={true}
      shipPositions={mapShipPositions}
      ships={mapShips}
      selectedShipId={fleet.selectedShipId}
      onShipSelect={fleet.setSelectedShipId}
      onShipMove={fleet.moveShip}
      allowSelection={true}
      selectableShipIds={fleet.selectedShips}
      flippedShipIds={fleet.shipPositions.map((p) => p.shipId)}
      onDragOver={(row, col, e) => {
        e.preventDefault();
        fleet.setDragOverPosition({ row, col });
      }}
      onDrop={(row, col, e) => {
        let shipIdToMove = fleet.draggedShipId;
        if (shipIdToMove == null && e) {
          const data = e.dataTransfer.getData("text/plain");
          if (data) {
            const parsed = Number(data);
            if (!Number.isNaN(parsed)) shipIdToMove = parsed;
          }
        }
        if (shipIdToMove != null) {
          fleet.moveShip(shipIdToMove, row, col);
        }
        fleet.setDraggedShipId(null);
        fleet.setDragOverPosition(null);
      }}
      dragOverPosition={fleet.dragOverPosition}
      showDeployZoneLabel={true}
    />
  );

  return (
    <RoguelikeCombatFleetModal
      fleet={fleet}
      rosterSize={rosterShips.length}
      isSubmitting={isSubmitting}
      isWarping={isWarping}
      shipsLoading={false}
      isAttributesFromCache={isAttributesFromCache}
      showInGameProperties={showInGameProperties}
      onToggleInGameProperties={setShowInGameProperties}
      shipListItems={shipListItems}
      mapDisplay={mapDisplay}
      onLaunch={() => void handleLaunch()}
      onClose={onClose}
      onLaunched={onLaunched}
    />
  );
}
