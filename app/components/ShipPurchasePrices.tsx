"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useChainAccount } from "@/app/near/useChainAccount";
import { formatNear, formatUnits18, parseNear, parseUnits18 } from "@/app/near/codec";
import { TransactionButton } from "./TransactionButton";
import { PurchaseTierTable, type PurchaseTierRowData } from "./PurchaseTierTable";
import { ShipPurchasePricesHeaderCard } from "./ShipPurchasePricesHeaderCard";
import { ShipPurchaseTierSectionCard } from "./ShipPurchaseTierSectionCard";
import { useShipPurchasePricesAccess } from "../hooks/useShipPurchasePricesAccess";
import { usePriceTiers } from "../hooks/usePriceTiers";
import type { PriceTier } from "../near/generated/voidTactics";

interface TierRow {
  ships: number;
  /** NEAR price of the pack (purchase_ships_with_near). */
  nearShip: string;
  /** UTC price of the pack (purchase_ships_with_utc), and the UTC buy_utc_with_near mints. */
  utc: string;
  /** NEAR price of that UTC (buy_utc_with_near). */
  nearUtc: string;
}

function toRows(tiers: PriceTier[]): TierRow[] {
  return tiers.map((t) => ({
    ships: t.ships,
    nearShip: formatNear(t.near_ship_price, 24),
    utc: formatUnits18(t.utc_price, 18),
    nearUtc: formatNear(t.near_utc_price, 24),
  }));
}

function buildTiers(rows: TierRow[]): { ok: true; tiers: PriceTier[] } | { ok: false; error: string } {
  if (rows.length === 0) return { ok: false, error: "Add at least one tier" };
  const tiers: PriceTier[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const ships = Math.floor(Number(r.ships));
    if (!Number.isFinite(ships) || ships < 1 || ships > 255) return { ok: false, error: `Tier ${i}: ship count must be 1 to 255` };
    try {
      tiers.push({
        ships,
        near_ship_price: parseNear(r.nearShip || "0").toString(),
        utc_price: parseUnits18(r.utc || "0").toString(),
        near_utc_price: parseNear(r.nearUtc || "0").toString(),
      });
    } catch {
      return { ok: false, error: `Tier ${i}: invalid price` };
    }
  }
  return { ok: true, tiers };
}

/**
 * Ops Console › Purchase Prices (owner only). On NEAR every pack price is
 * one table (set_price_tiers): per tier, the ship count, its NEAR price,
 * its UTC price, and the NEAR price of buying that much UTC. A NEAR price
 * must cover the new ships' storage or the contract refuses
 * (PriceBelowStorageCost).
 */
const ShipPurchasePrices: React.FC = () => {
  const { address, isConnected } = useChainAccount();
  const { canAdminShipPurchasePrices } = useShipPurchasePricesAccess();
  const { data: tiers, isLoading, refetch } = usePriceTiers();
  const [rows, setRows] = useState<TierRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty && tiers) setRows(toRows(tiers));
  }, [tiers, dirty]);

  const built = useMemo(() => buildTiers(rows), [rows]);

  if (!isConnected) {
    return (
      <div className="text-center py-8">
        <p className="text-text-muted">Sign in to open this tab.</p>
      </div>
    );
  }

  if (!canAdminShipPurchasePrices) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-warning-red">Access denied. Only the game contract&apos;s owner can edit prices.</p>
        <p className="text-text-muted text-sm font-mono">You: {address}</p>
      </div>
    );
  }

  const setRow = (i: number, change: Partial<TierRow>) => {
    setDirty(true);
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...change } : r)));
  };

  const tableRows = rows.map(
    (r, i): PurchaseTierRowData => ({
      tierLabel: String(i),
      shipCount: r.ships,
      onShipCountChange: (value) => setRow(i, { ships: value }),
      prices: [
        { currencyLabel: "NEAR (pack)", value: r.nearShip, onChange: (v) => setRow(i, { nearShip: v }) },
        { currencyLabel: "UTC (pack)", value: r.utc, onChange: (v) => setRow(i, { utc: v }) },
        { currencyLabel: "NEAR (buy that UTC)", value: r.nearUtc, onChange: (v) => setRow(i, { nearUtc: v }) },
      ],
    }),
  );

  const btnClass =
    "px-4 py-2 rounded-none border-2 text-cyan font-mono font-bold text-sm tracking-wider transition-colors hover:bg-cyan/10 disabled:opacity-50";

  return (
    <div className="space-y-6">
      <ShipPurchasePricesHeaderCard
        title="Ship pack & UTC purchase prices"
        description={
          <>
            One table on the game contract drives every purchase: a pack bought with NEAR, the same pack bought with
            UTC, and buying that pack&apos;s UTC with NEAR (so buying UTC first, then ships, costs the same). NEAR
            prices must also cover the new ships&apos; storage.
          </>
        }
        hasUnsavedChanges={dirty}
        unsavedChangesLabel="Unsaved price changes."
        actions={
          <button
            type="button"
            onClick={() => {
              setDirty(false);
              if (tiers) setRows(toRows(tiers));
            }}
            disabled={!dirty}
            className="px-4 py-2 rounded-none border-2 text-warning-red font-mono text-xs font-bold uppercase tracking-wider transition-colors hover:bg-warning-red/10 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: "var(--color-warning-red)" }}
          >
            [DISCARD CHANGES]
          </button>
        }
      />

      <ShipPurchaseTierSectionCard
        title="Pack tiers"
        subtitle="set_price_tiers replaces the whole table."
        isLoading={isLoading}
        isEmpty={rows.length === 0}
        emptyMessage="No price tiers are set yet."
        footer={
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={btnClass}
              style={{ borderRadius: 0, borderColor: "var(--color-cyan)" }}
              onClick={() => {
                setDirty(true);
                setRows((prev) => [...prev, { ships: 1, nearShip: "0", utc: "0", nearUtc: "0" }]);
              }}
            >
              [ADD TIER]
            </button>
            <TransactionButton
              transactionId="set-price-tiers"
              call={built.ok ? { method: "set_price_tiers", args: { tiers: built.tiers } } : null}
              allowWhenOtherPending
              className={btnClass}
              style={{ borderRadius: 0, borderColor: "var(--color-cyan)" }}
              validateBeforeTransaction={() => (built.ok ? true : built.error)}
              onSuccess={async () => {
                toast.success("Prices updated");
                setDirty(false);
                await refetch();
              }}
              onError={(error) => toast.error(error?.message ? `Update failed: ${error.message}` : "Update failed")}
            >
              [SAVE PRICES]
            </TransactionButton>
          </div>
        }
      >
        <PurchaseTierTable editable rows={tableRows} />
      </ShipPurchaseTierSectionCard>
    </div>
  );
};

export default ShipPurchasePrices;
