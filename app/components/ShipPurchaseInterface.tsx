"use client";

import React, { useState } from "react";
import { useOwnedShips } from "../hooks/useOwnedShips";
import { useStaggeredPreviewSeeds } from "../hooks/useStaggeredPreviewSeeds";
import { VariantPicker } from "./VariantPicker";
import { useShipsPurchaseInfo } from "../hooks/useShipsPurchaseInfo";
import { useShipPurchaserPurchaseInfo } from "../hooks/useShipPurchaserPurchaseInfo";
import { ShipPurchaseButton } from "./ShipPurchaseButton";
import { FlowPaymentModal } from "./FlowPaymentModal";
import { useFlowPaymentModal } from "../hooks/useFlowPaymentModal";
import { CheckoutSheet, CheckoutDetail, CHECKOUT_CONFIRM_CLASS } from "./CheckoutSheet";
import { ShipImage } from "./ShipImage";
import {
  ShipPurchaseTierCard,
  TIER_CARD_BUTTON_CLASS,
  type ShipPurchaseTierCardLayout,
} from "./ShipPurchaseTierCard";
import { ShipPurchaseShell } from "./ShipPurchaseShell";
import {
  getTierCallout,
  getTierBadge,
  getGuaranteedVeteranRanks,
} from "../utils/shipPurchaseTierDisplay";
import { getPreviewShipSpecsForTier } from "../utils/shipPreviewSpec";
import {
  PREVIEW_REFRESH_INTERVAL_MS,
  previewShipsDestroyedForRank,
  toPreviewShip,
} from "../utils/previewShips";
import type { Ship } from "../types/types";
import { formatNear, formatUnits18 } from "@/app/near/codec";
import { CARD_CHECKOUT_ENABLED, FLOW_USD_TIERS, type FlowTier } from "../config/flowPayment";

type PaymentMethod = "USD" | "FLOW" | "UTC";

// Truncates (not rounds) a decimal string to at most 8 fractional digits,
// dropping any resulting trailing zeros so a whole-number price stays clean.
function truncateTo8Decimals(value: string): string {
  const [whole, frac] = value.split(".");
  if (!frac) return whole!;
  const truncated = frac.slice(0, 8).replace(/0+$/, "");
  return truncated ? `${whole}.${truncated}` : whole!;
}

/**
 * Web3 ship packs: tier cards priced in USD; picking one opens checkout,
 * where the player pays with NEAR or UTC (and by card or any token through
 * Fireblocks Flow, when CARD_CHECKOUT_ENABLED).
 */
const ShipPurchaseInterface: React.FC = () => {
  const shipsPack = useShipsPurchaseInfo();
  const utcPack = useShipPurchaserPurchaseInfo();
  const { refetch } = useOwnedShips();
  const nativeTokenSymbol = "NEAR";
  /** Card checkout's memo field (was the game's EVM chain id). */
  const activeGameChainId = 0;
  const flowModal = useFlowPaymentModal({
    onSuccess: async () => {
      await refetch();
    },
  });
  // Price ladder for the Fireblocks Flow modal of the pack last sent there.
  const [flowTier, setFlowTier] = useState<FlowTier>(FLOW_USD_TIERS[0]!);
  // One seed per pack, rerolled in turn so the cards don't all change at once.
  const previewSeeds = useStaggeredPreviewSeeds(shipsPack.tierCount, PREVIEW_REFRESH_INTERVAL_MS);

  // Faction/variant to mint. Variant 2 (Shattered Hive) is gated on the medal
  // NFT — VariantPicker shows it grayed out and blocks selecting it without
  // the NFT. Default to variant 1 (ungated).
  const [selectedVariant, setSelectedVariant] = useState(1);

  // Which pack's checkout is open (null = closed), and how it's being paid.
  const [checkoutIndex, setCheckoutIndex] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(CARD_CHECKOUT_ENABLED ? "USD" : "FLOW");

  // Packs (ship counts, ranks, previews) come from Ships; ShipPurchaser
  // prices the same tiers in UTC.
  const {
    tiers,
    shipsPerTier: maxPerTier,
    pricesWei: prices,
    isLoading,
    tierCount,
  } = shipsPack;

  const getPreviewShipsForTier = (tier: number, previewSeed: number): Ship[] =>
    getPreviewShipSpecsForTier(
      previewSeed,
      tier,
      maxPerTier[tier] ?? 1,
      previewShipsDestroyedForRank,
      selectedVariant,
    ).map(toPreviewShip);

  if (isLoading && tierCount === 0) {
    return (
      <div className="w-full py-8 text-center">
        <p className="text-text-muted font-mono">Loading pack configuration…</p>
      </div>
    );
  }

  if (tierCount === 0) {
    return (
      <div className="w-full py-8 text-center">
        <p className="text-warning-red font-mono">
          No purchase tiers returned from the contract.
        </p>
      </div>
    );
  }

  // Per-tier data computed once so the grid card and the confirm modal render
  // from the same source (the modal shows the exact card that was clicked).
  const tierData = tiers.map((tier: number, index: number) => {
    const price = prices[index];
    const shipsCount = maxPerTier[index];
    const priceFormatted = price ? formatNear(price, 4) : "0";
    const veteranRanks = getGuaranteedVeteranRanks(tier, shipsCount ?? 1);
    const tierCallout = getTierCallout(tier);
    const badge = getTierBadge(tier, tierCount);
    const previewShips = getPreviewShipsForTier(tier, previewSeeds[index] ?? 0);
    const flowTier = FLOW_USD_TIERS[index] ?? FLOW_USD_TIERS[0]!;
    const utcIndex = utcPack.purchaserDeployed ? utcPack.tiers.indexOf(tier) : -1;
    const utcPrice = utcIndex >= 0 ? utcPack.pricesWei[utcIndex] : undefined;
    return {
      tier,
      index,
      price,
      shipsCount,
      priceFormatted,
      veteranRanks,
      tierCallout,
      badge,
      previewShips,
      flowTier,
      utcPrice,
    };
  });

  type TierDatum = (typeof tierData)[number];

  const renderTierCard = (d: TierDatum, layout: ShipPurchaseTierCardLayout) => (
    <ShipPurchaseTierCard
      layout={layout}
      tier={d.tier}
      tierCallout={d.tierCallout}
      badge={d.badge}
      priceLabel={`$${d.flowTier.displayPrice}`}
      shipsCount={d.shipsCount ?? 0}
      veteranRanks={d.veteranRanks}
      previewShipImages={d.previewShips.map((ship, idx) => (
        <ShipImage
          // Keyed by slot so a reroll swaps the ship in place, holding the
          // previous image until the new one renders (no blank flash).
          key={idx}
          ship={ship}
          holdPreviousImage
          showLoadingState={false}
          // The card's rank chips show the ranks.
          hideRankStars
        />
      ))}
    />
  );

  const renderTierButton = (d: TierDatum, layout: ShipPurchaseTierCardLayout) => (
    <button
      key={d.index}
      type="button"
      onClick={() => setCheckoutIndex(d.index)}
      className={TIER_CARD_BUTTON_CLASS}
    >
      {renderTierCard(d, layout)}
    </button>
  );
  // The top pack is featured; the others form the ladder, highest first.
  const featuredTier = tierData[tierData.length - 1]!;
  const ladderTiers = tierData.slice(0, -1).reverse();

  const checkout = checkoutIndex !== null ? tierData[checkoutIndex] : null;
  const closeCheckout = () => setCheckoutIndex(null);

  const renderConfirm = (d: TierDatum) => {
    if (paymentMethod === "USD") {
      return (
        <button
          type="button"
          className={CHECKOUT_CONFIRM_CLASS}
          onClick={() => {
            setFlowTier(d.flowTier);
            closeCheckout();
            void flowModal.open(d.tier, activeGameChainId, selectedVariant);
          }}
        >
          Continue to payment
        </button>
      );
    }
    const price = paymentMethod === "UTC" ? d.utcPrice : d.price;
    return (
      <ShipPurchaseButton
        tier={d.tier}
        price={price ?? BigInt(0)}
        paymentMethod={paymentMethod}
        variant={selectedVariant}
        className={CHECKOUT_CONFIRM_CLASS}
        refetch={refetch}
        onSuccess={async () => {
          closeCheckout();
        }}
      >
        Confirm purchase
      </ShipPurchaseButton>
    );
  };

  return (
    <>
      <ShipPurchaseShell
        featured={renderTierButton(featuredTier, "featured")}
        rows={ladderTiers.map((d) => renderTierButton(d, "row"))}
        footerPaymentNote={
          CARD_CHECKOUT_ENABLED
            ? "Pick a pack, then choose how to pay: card or any token, NEAR, or UTC."
            : "Pick a pack, then choose how to pay: NEAR or UTC."
        }
        topContent={
          <VariantPicker compact selectedVariant={selectedVariant} onSelect={setSelectedVariant} />
        }
      />

      {checkout && (
        <CheckoutSheet
          title="Checkout"
          summary={renderTierCard(checkout, "summary")}
          selectedId={paymentMethod}
          onSelect={(id) => setPaymentMethod(id as PaymentMethod)}
          options={[
            ...(CARD_CHECKOUT_ENABLED
              ? [
            {
              id: "USD",
              label: "Card or any token",
              note: "Any chain, via Fireblocks Flow",
              priceLabel: `$${checkout.flowTier.displayPrice}`,
            },
                ]
              : []),
            {
              id: "FLOW",
              label: nativeTokenSymbol,
              note: "From your wallet",
              priceLabel: `${checkout.priceFormatted} ${nativeTokenSymbol}`,
            },
            {
              id: "UTC",
              label: "UTC",
              note: "From your UTC balance",
              priceLabel:
                checkout.utcPrice !== undefined
                  ? `${truncateTo8Decimals(formatUnits18(checkout.utcPrice, 8))} UTC`
                  : "—",
              disabledReason:
                checkout.utcPrice === undefined
                  ? "Not available on this network"
                  : undefined,
            },
          ]}
          details={
            <>
              <CheckoutDetail label="Ships" value={String(checkout.shipsCount ?? 0)} />
              <CheckoutDetail label="Approx. USD" value={`≈ $${checkout.flowTier.displayPrice}`} />
            </>
          }
          confirm={renderConfirm(checkout)}
          onCancel={closeCheckout}
        />
      )}

      <FlowPaymentModal modal={flowModal} flowTier={flowTier} />
    </>
  );
};

export default ShipPurchaseInterface;
