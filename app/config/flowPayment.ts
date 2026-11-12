export interface FlowTier {
  displayPrice: string; // shown in UI
  actualAmount: string; // sent to Fireblocks Flow (1/100th of display)
}

// Five tiers matching the Ships contract tier structure (0–4). The display
// prices are the real price list, the same dollars the deploy converts into
// each tier's ETH price (TIER_USD_PRICES in the contracts repo's
// DeployAndConfig.ts) and the same numbers as the packs' UTC prices, so card,
// ETH, and UTC all cost the same.
export const FLOW_USD_TIERS: FlowTier[] = [
  { displayPrice: "4.99", actualAmount: "0.05" },
  { displayPrice: "9.99", actualAmount: "0.10" },
  { displayPrice: "19.99", actualAmount: "0.20" },
  { displayPrice: "34.99", actualAmount: "0.35" },
  { displayPrice: "49.99", actualAmount: "0.50" },
];

/**
 * Attached to the checkout transaction when it's created
 * (useFlowPaymentModal) and read back by /api/flow/fulfill, which mints to
 * `buyerAddress` and nowhere else. The request body carries only the
 * transaction id.
 */
export interface FlowPaymentMemo {
  buyerAddress: string;
  tier: number;
  gameChainId: number;
  variant?: number;
}
