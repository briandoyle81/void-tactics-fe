"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { MAP_ADMIN_ADDRESS } from "../config/alpha";
import { useShipAttributesOwner } from "./useShipAttributesContract";
import { useIsEncounterEditor } from "./useIsEncounterEditor";
import { useIsNodeMapEditor } from "./useIsNodeMapEditor";
import { useShipPurchasePricesAccess } from "./useShipPurchasePricesAccess";
import { useWeb2Admin } from "./useWeb2Admin";
import { useIsShipGrantOwner } from "./useShipGrants";

export type OpsConsoleTab = "Maps" | "Admin" | "Reward Ships" | "Ship Attributes" | "Purchase Prices";

export const OPS_CONSOLE_TABS: readonly OpsConsoleTab[] = [
  "Maps",
  "Admin",
  "Reward Ships",
  "Ship Attributes",
  "Purchase Prices",
];

/**
 * Which Ops Console (/admin) tabs the signed-in player may open. The panels
 * inside still gate their own writes; this decides tab visibility and
 * whether the header menu links to the console at all.
 */
export function useOpsConsoleAccess() {
  const { address } = useAccount();
  const { isOwner } = useShipAttributesOwner();
  // AI fleet and mission editors get the Admin tab without owning contracts.
  const { isEditor: isEncounterEditor, isLoading: isEncounterEditorLoading } =
    useIsEncounterEditor();
  const { isEditor: isNodeMapEditor, isLoading: isNodeMapEditorLoading } =
    useIsNodeMapEditor();
  const { canAdminShipPurchasePrices } = useShipPurchasePricesAccess();
  const { isOwner: isShipGrantOwner } = useIsShipGrantOwner();
  const isWeb2Admin = useWeb2Admin();
  const isMapAdmin = address?.toLowerCase() === MAP_ADMIN_ADDRESS.toLowerCase();

  const tabs = useMemo(
    () =>
      OPS_CONSOLE_TABS.filter((tab) => {
        if (isWeb2Admin) return true;
        switch (tab) {
          case "Maps":
            return isMapAdmin;
          case "Admin":
            return isMapAdmin || isOwner || isEncounterEditor || isNodeMapEditor;
          case "Reward Ships":
            // Anyone who edits nodes can view; only the owner can write.
            return isMapAdmin || isShipGrantOwner || isNodeMapEditor;
          case "Ship Attributes":
            return isOwner;
          case "Purchase Prices":
            return canAdminShipPurchasePrices;
        }
      }),
    [isWeb2Admin, isMapAdmin, isOwner, isEncounterEditor, isNodeMapEditor, isShipGrantOwner, canAdminShipPurchasePrices],
  );

  return {
    tabs,
    hasAccess: tabs.length > 0,
    isLoading: isEncounterEditorLoading || isNodeMapEditorLoading,
  };
}
