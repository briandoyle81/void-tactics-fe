"use client";

import React, { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { apiMutate } from "../lib/apiMutate";
import { useOwnedShipsWeb2 } from "../hooks/useOwnedShipsWeb2";
import { ShipPurchaseInterfaceWeb2 } from "./ShipPurchaseInterfaceWeb2";
import { CheckoutSheet, CheckoutDetail, CHECKOUT_CONFIRM_CLASS } from "./CheckoutSheet";
import { ShipPurchaseTierCard } from "./ShipPurchaseTierCard";
import {
  useInvalidateUserBalanceWeb2,
  useUserBalanceWeb2,
} from "../hooks/useUserBalanceWeb2";
import { usePurchaseTiersWeb2 } from "../hooks/usePurchaseTiersWeb2";
import { getGuaranteedVeteranRanks, getTierBadge, getTierCallout } from "../utils/shipPurchaseTierDisplay";
import { formatCreditsUtc } from "../lib/credits";

type Currency = "usd" | "utc";

// Store › Ship packs (web2). Picking a pack opens checkout, where the
// player pays in USD or UTC. Ship purchases have no real payment gate yet
// (see ManageNavyWeb2's doc comment); checkout is the confirmation step.
export default function StoreWeb2() {
  const { refetch } = useOwnedShipsWeb2();
  const invalidateBalance = useInvalidateUserBalanceWeb2();
  const { creditBalance } = useUserBalanceWeb2();
  const { tiers: purchaseTiers } = usePurchaseTiersWeb2();

  const [busy, setBusy] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency>("usd");

  const purchase = useCallback(
    async (tier: number, payWith: Currency) => {
      setBusy(true);
      try {
        const result = await apiMutate<{ ships: { id: number; name: string }[] }>(
          `/api/ships/purchase/${payWith}`,
          "POST",
          { tier },
        );
        toast.success(`Purchased ${result.ships.length} ship(s)`);
        if (payWith === "utc") invalidateBalance();
        await refetch();
        setCheckoutTier(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to purchase ships");
      } finally {
        setBusy(false);
      }
    },
    [invalidateBalance, refetch],
  );

  const tierConfig =
    checkoutTier !== null ? purchaseTiers.find((t) => t.tier === checkoutTier) : undefined;
  const usdLabel = tierConfig ? `$${(tierConfig.priceUsdCents / 100).toFixed(2)}` : "";
  const cannotAffordUtc = tierConfig ? creditBalance < tierConfig.priceUtc : false;

  return (
    <>
      <ShipPurchaseInterfaceWeb2 onSelectTier={setCheckoutTier} busy={busy} />

      {tierConfig && (
        <CheckoutSheet
          title="Checkout"
          summary={
            <ShipPurchaseTierCard
              layout="summary"
              tier={tierConfig.tier}
              tierCallout={getTierCallout(tierConfig.tier)}
              badge={getTierBadge(tierConfig.tier, purchaseTiers.length)}
              priceLabel={usdLabel}
              shipsCount={tierConfig.shipCount}
              veteranRanks={getGuaranteedVeteranRanks(tierConfig.tier, tierConfig.shipCount)}
              previewShipImages={[]}
            />
          }
          selectedId={currency}
          onSelect={(id) => setCurrency(id as Currency)}
          options={[
            { id: "usd", label: "USD", note: "Card", priceLabel: usdLabel },
            {
              id: "utc",
              label: "UTC",
              note: "From your balance",
              priceLabel: `${formatCreditsUtc(tierConfig.priceUtc)} UTC`,
              disabledReason: cannotAffordUtc ? `Balance ${formatCreditsUtc(creditBalance)} UTC` : undefined,
            },
          ]}
          details={
            currency === "utc" ? (
              <>
                <CheckoutDetail label="UTC balance" value={`${formatCreditsUtc(creditBalance)} UTC`} />
                <CheckoutDetail
                  label="After purchase"
                  value={`${formatCreditsUtc(creditBalance - tierConfig.priceUtc)} UTC`}
                  tone={cannotAffordUtc ? "warn" : undefined}
                />
              </>
            ) : (
              <CheckoutDetail label="Ships" value={String(tierConfig.shipCount)} />
            )
          }
          confirm={
            <button
              type="button"
              disabled={busy || (currency === "utc" && cannotAffordUtc)}
              onClick={() => void purchase(tierConfig.tier, currency)}
              className={CHECKOUT_CONFIRM_CLASS}
            >
              {busy ? "Purchasing…" : `Buy for ${currency === "utc" ? `${formatCreditsUtc(tierConfig.priceUtc)} UTC` : usdLabel}`}
            </button>
          }
          onCancel={() => setCheckoutTier(null)}
        />
      )}
    </>
  );
}
