"use client";

import { useRoles } from "../near/useRoles";

/**
 * Pack prices (NEAR and UTC) are one owner-set table on the game contract
 * (set_price_tiers), so only the owner may edit them.
 */
export function useShipPurchasePricesAccess() {
  const { isOwner } = useRoles();
  return {
    isShipsOwner: isOwner,
    isPurchaserOwner: isOwner,
    canAdminShipPurchasePrices: isOwner,
    purchaserDeployed: true,
  };
}
