"use client";

import React from "react";
import { getKillsForRank } from "../lib/purchaseTiers";
import { usePurchaseTiersWeb2 } from "../hooks/usePurchaseTiersWeb2";
import { useStaggeredPreviewSeeds } from "../hooks/useStaggeredPreviewSeeds";
import { Web2Ship } from "../types/web2Ship";
import { ShipImageWeb2 } from "./ShipImageWeb2";
import { ShipPurchaseTierCard, TIER_CARD_BUTTON_CLASS } from "./ShipPurchaseTierCard";
import { ShipPurchaseShell } from "./ShipPurchaseShell";
import {
  getTierCallout,
  getTierBadge,
  getGuaranteedVeteranRanks,
} from "../utils/shipPurchaseTierDisplay";
import { getPreviewShipSpecsForTier } from "../utils/shipPreviewSpec";
import { PREVIEW_REFRESH_INTERVAL_MS, toPreviewShipWeb2 } from "../utils/previewShips";

// Web2-mode counterpart to ShipPurchaseInterface.tsx — same tier-card
// layout/copy (via the shared ShipPurchaseTierCard/shipPurchaseTierDisplay
// pieces), minus the FLOW/Fireblocks-Flow payment tab, which is inherently
// wallet-only and has no web2 equivalent. Web2 has its own real "USD" route
// (`/api/ships/purchase/usd`, currently a placeholder with no payment gate
// — see ManageNavyWeb2.tsx's doc comment), so USD here is a REST purchase,
// not the cross-chain wallet flow web3's "USD" tab uses.
interface ShipPurchaseInterfaceWeb2Props {
  /** Opens checkout for a pack; the payment method is chosen there. */
  onSelectTier: (tier: number) => void;
  busy: boolean;
}

export function ShipPurchaseInterfaceWeb2({ onSelectTier, busy }: ShipPurchaseInterfaceWeb2Props) {
  const { tiers } = usePurchaseTiersWeb2();
  // One seed per pack, rerolled in turn so the cards don't all change at once
  // (each still changes every 10s, the cadence HeroShipShowcase uses).
  const previewSeeds = useStaggeredPreviewSeeds(tiers.length, PREVIEW_REFRESH_INTERVAL_MS);

  const getPreviewShipsForTier = (tier: number, shipCount: number, previewSeed: number): Web2Ship[] =>
    getPreviewShipSpecsForTier(previewSeed, tier, shipCount, getKillsForRank).map(toPreviewShipWeb2);

  const tierCards = tiers.map((t, index) => {
    const isFeatured = index === tiers.length - 1;
    const veteranRanks = getGuaranteedVeteranRanks(t.tier, t.shipCount);
    const tierCallout = getTierCallout(t.tier);
    const badge = getTierBadge(t.tier, tiers.length);
    const previewShips = getPreviewShipsForTier(t.tier, t.shipCount, previewSeeds[index] ?? 0);
    const priceLabel = `$${(t.priceUsdCents / 100).toFixed(2)}`;

    return (
      <button
        key={t.tier}
        type="button"
        onClick={() => onSelectTier(t.tier)}
        disabled={busy}
        className={TIER_CARD_BUTTON_CLASS}
      >
        <ShipPurchaseTierCard
          layout={isFeatured ? "featured" : "row"}
          tier={t.tier}
          tierCallout={tierCallout}
          badge={badge}
          priceLabel={priceLabel}
          shipsCount={t.shipCount}
          veteranRanks={veteranRanks}
          previewShipImages={previewShips.map((ship, idx) => (
            <ShipImageWeb2
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
      </button>
    );
  });

  return (
    <ShipPurchaseShell
      // The top pack is featured; the others form the ladder, highest first.
      featured={tierCards[tierCards.length - 1]}
      rows={tierCards.slice(0, -1).reverse()}
      footerPaymentNote="Pick a pack, then choose how to pay: USD or UTC."
    />
  );
}
