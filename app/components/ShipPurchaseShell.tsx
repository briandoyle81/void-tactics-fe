"use client";

import React from "react";

// Shared between ShipPurchaseInterface.tsx (web3) and
// ShipPurchaseInterfaceWeb2.tsx (web2) — the outer shell (header, store design
// L's layout, footer copy): the top pack as a featured card, and the others as
// a price ladder beside it whose rows stretch to the featured card's height.
// On phones the featured card stacks above the ladder. The cards stay
// caller-built (ShipPurchaseTierCard); each opens that mode's checkout
// (CheckoutSheet), where the payment method is chosen.
interface ShipPurchaseShellProps {
  /** The top pack, drawn with layout "featured". */
  featured: React.ReactNode;
  /** The other packs, highest first, drawn with layout "row". */
  rows: React.ReactNode[];
  footerPaymentNote: string;
  /** Controls at the right of the header — the web3 interface's faction
   * toggle (gated on the Shattered Hive medal). Web2 omits it. */
  topContent?: React.ReactNode;
  /** A small note under the description, e.g. web3's per-chain pricing caveat. */
  notice?: React.ReactNode;
}

export function ShipPurchaseShell({
  featured,
  rows,
  footerPaymentNote,
  topContent,
  notice,
}: ShipPurchaseShellProps) {
  return (
    <div className="w-full">
      <header className="mb-5 flex flex-col gap-4 border-b border-cyan/25 pb-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h3
            className="text-xl font-black uppercase tracking-[0.12em] text-cyan sm:text-2xl"
            style={{
              fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
            }}
          >
            Expand your fleet
          </h3>
          <p
            className="mt-1 max-w-xl text-sm leading-snug text-text-secondary"
            style={{
              fontFamily:
                "var(--font-jetbrains-mono), 'Courier New', monospace",
            }}
          >
            One mint, a full fleet. Bigger packs add guaranteed veterans.
          </p>
          {notice && (
            <p
              className="mt-1 text-[11px] text-amber/80"
              style={{
                fontFamily:
                  "var(--font-jetbrains-mono), 'Courier New', monospace",
              }}
            >
              {notice}
            </p>
          )}
        </div>
        {topContent && <div className="shrink-0">{topContent}</div>}
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="shrink-0 lg:w-[43%] lg:max-w-[40rem]">{featured}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {rows.map((row, i) => (
            <div key={i} className="lg:min-h-0 lg:flex-1">
              {row}
            </div>
          ))}
        </div>
      </div>
      <p
        className="mt-4 text-[11px] uppercase tracking-[0.08em] text-text-muted"
        style={{
          fontFamily: "var(--font-jetbrains-mono), 'Courier New', monospace",
        }}
      >
        {footerPaymentNote}
      </p>
      <p
        className="mt-1 text-[11px] uppercase tracking-[0.08em] text-text-muted"
        style={{
          fontFamily: "var(--font-jetbrains-mono), 'Courier New', monospace",
        }}
      >
        Preview ships are examples only. Final minted ships may differ in
        loadout and visuals.
      </p>
    </div>
  );
}
