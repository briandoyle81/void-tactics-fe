import { type NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  getAddress,
  http,
  isAddress,
  type Chain,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { flowTestnet, baseSepolia, saigon } from "viem/chains";
import { xaiTestnet } from "@/app/config/networks";
import { getContractAddresses } from "@/app/config/contracts";
import { getVariantForChainId } from "@/app/config/networks";
import { FLOW_USD_TIERS, type FlowPaymentMemo } from "@/app/config/flowPayment";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/app/generated/prisma";

// POST /api/flow/fulfill { transactionId } — mints the ships a Fireblocks
// Flow card payment bought. A backend wallet is allowed here (CLAUDE.md "No
// Backend Services in Place of Contract Functions"): createShips is
// access-controlled to SHIP_MINTER_PRIVATE_KEY's wallet.
//
// Everything about the purchase comes from the payment itself, never the
// request body: the checkout transaction is fetched from Dynamic, must belong
// to this game's checkout (so it paid our treasury), must have settled, and
// must have paid the tier's amount. The buyer, tier, chain and variant are
// read from the memo the client attached when it created the payment
// (useFlowPaymentModal), so a transaction id can only ever mint to the
// wallet it was created for.
//
// Once only, enforced by the database (the same approach as the gas faucet):
// a FlowFulfillment row (unique transactionId) is inserted before anything is
// sent, so concurrent or repeated requests, server restarts and other
// instances can't mint twice. The mint's hash is stored as soon as it's
// broadcast; a retry of a SENT row checks that hash's receipt instead of
// minting again. Only a FAILED row (nothing went out, or the mint reverted)
// can be claimed again.

const ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID!;
const CHECKOUT_ID = process.env.NEXT_PUBLIC_FLOW_CHECKOUT_ID;
const rawKey = process.env.SHIP_MINTER_PRIVATE_KEY ?? "";
const MINTER_KEY = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;

const CREATE_SHIPS_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_to", type: "address" },
      { internalType: "uint256", name: "_amount", type: "uint256" },
      { internalType: "uint16", name: "_variant", type: "uint16" },
      { internalType: "uint8", name: "_tier", type: "uint8" },
    ],
    name: "createShips",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const TIER_SHIPS_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "tierShips",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const CHAINS_BY_ID: Record<number, Chain> = {
  [flowTestnet.id]: flowTestnet,
  [baseSepolia.id]: baseSepolia,
  [saigon.id]: saigon,
  [xaiTestnet.id]: xaiTestnet as Chain,
};

/** The fields of Dynamic's checkout transaction this route relies on. */
interface CheckoutTransaction {
  checkoutId?: string;
  settlementState?: string;
  amount?: string;
  memo?: Partial<FlowPaymentMemo> | null;
}

/** The purchase, as recorded on the payment (its memo). */
interface Purchase {
  buyerAddress: `0x${string}`;
  tier: number;
  chainId: number;
  variant: number;
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

/** Reads and checks the purchase from the payment's memo; null if it isn't one of ours. */
function purchaseFromMemo(memo: CheckoutTransaction["memo"]): Purchase | null {
  if (!memo || typeof memo !== "object") return null;
  const { buyerAddress, tier, gameChainId, variant } = memo;
  if (typeof buyerAddress !== "string" || !isAddress(buyerAddress)) return null;
  if (typeof tier !== "number" || !FLOW_USD_TIERS[tier]) return null;
  if (typeof gameChainId !== "number" || !CHAINS_BY_ID[gameChainId]) return null;
  // Variant 2 is gated on the Shattered Hive medal: Ships._mintShip enforces
  // VariantPurchaseGate.checkGate against the recipient, so an ungated
  // variant reverts the mint rather than minting it.
  const mintVariant =
    typeof variant === "number" && Number.isInteger(variant) && variant >= 0 && variant <= 65535
      ? variant
      : getVariantForChainId(gameChainId);
  return { buyerAddress: getAddress(buyerAddress), tier, chainId: gameChainId, variant: mintVariant };
}

function clientsFor(chainId: number) {
  const chain = CHAINS_BY_ID[chainId];
  const publicClient = createPublicClient({ chain, transport: http() });
  const walletClient = createWalletClient({
    account: privateKeyToAccount(MINTER_KEY),
    chain,
    transport: http(),
  });
  return { publicClient, walletClient };
}

/**
 * A row whose mint was already broadcast: settles it from the stored hash's
 * receipt instead of minting again.
 */
async function resolveSentMint(transactionId: string, chainId: number, mintTxHash: Hash) {
  const { publicClient } = clientsFor(chainId);
  const receipt = await publicClient.getTransactionReceipt({ hash: mintTxHash }).catch(() => null);
  if (!receipt) return json({ error: "Minting is in progress. Check back in a minute." }, 409);
  if (receipt.status === "success") {
    await prisma.flowFulfillment.update({
      where: { transactionId },
      data: { status: "MINTED", error: null },
    });
    return json({ success: true, mintTxHash });
  }
  await prisma.flowFulfillment.update({
    where: { transactionId },
    data: { status: "FAILED", error: "Mint transaction reverted" },
  });
  return json({ error: "Minting failed: the mint transaction reverted. Try again." }, 500);
}

export async function POST(req: NextRequest) {
  if (!rawKey || !CHECKOUT_ID) {
    return json({ error: "Card payments are not configured" }, 503);
  }

  const body = (await req.json().catch(() => ({}))) as { transactionId?: unknown };
  const transactionId = typeof body.transactionId === "string" ? body.transactionId : "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId)) {
    return json({ error: "Invalid transaction id" }, 400);
  }

  // The payment, from Dynamic (not from the client).
  const txRes = await fetch(
    `https://app.dynamicauth.com/api/v0/sdk/${ENV_ID}/transactions/${encodeURIComponent(transactionId)}`,
  );
  if (!txRes.ok) return json({ error: "Payment not found" }, 404);
  const tx = (await txRes.json()) as CheckoutTransaction;

  if (tx.checkoutId !== CHECKOUT_ID) {
    return json({ error: "Payment is not for this game's checkout" }, 400);
  }
  const purchase = purchaseFromMemo(tx.memo);
  if (!purchase) {
    return json({ error: "Payment has no purchase details. Contact support to claim your ships." }, 400);
  }
  // The paid amount must match the tier the payment was created for.
  if (tx.amount !== FLOW_USD_TIERS[purchase.tier].actualAmount) {
    return json({ error: "Transaction amount does not match tier" }, 400);
  }
  if (tx.settlementState !== "completed") {
    return json({ error: `Settlement not complete: ${tx.settlementState ?? "unknown"}` }, 400);
  }

  // Claim the payment: insert a PENDING row, or take over a FAILED one.
  const rowData = {
    buyerAddress: purchase.buyerAddress.toLowerCase(),
    tier: purchase.tier,
    chainId: purchase.chainId,
    variant: purchase.variant,
  };
  try {
    await prisma.flowFulfillment.create({ data: { transactionId, ...rowData } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const existing = await prisma.flowFulfillment.findUnique({ where: { transactionId } });
    if (!existing) return json({ error: "Please retry" }, 409);
    if (existing.status === "MINTED") {
      return json({ error: "Already fulfilled", mintTxHash: existing.mintTxHash }, 409);
    }
    if (existing.status === "SENT" && existing.mintTxHash) {
      return resolveSentMint(transactionId, existing.chainId, existing.mintTxHash as Hash);
    }
    // Atomic: of two concurrent retries, only one moves FAILED → PENDING.
    const claimed = await prisma.flowFulfillment.updateMany({
      where: { transactionId, status: "FAILED" },
      data: { ...rowData, status: "PENDING", error: null, mintTxHash: null },
    });
    if (claimed.count === 0) return json({ error: "Minting is in progress" }, 409);
  }

  const { publicClient, walletClient } = clientsFor(purchase.chainId);
  const shipsAddress = getContractAddresses(purchase.chainId).SHIPS as `0x${string}`;
  let mintTxHash: Hash | null = null;
  try {
    const shipsCount = await publicClient.readContract({
      address: shipsAddress,
      abi: TIER_SHIPS_ABI,
      functionName: "tierShips",
      args: [BigInt(purchase.tier)],
    });

    mintTxHash = await walletClient.writeContract({
      address: shipsAddress,
      abi: CREATE_SHIPS_ABI,
      functionName: "createShips",
      args: [purchase.buyerAddress, BigInt(shipsCount), purchase.variant, purchase.tier],
    });
    // Broadcast: from here a retry resolves this hash, never mints again.
    await prisma.flowFulfillment.update({
      where: { transactionId },
      data: { status: "SENT", mintTxHash },
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: mintTxHash });
    if (receipt.status !== "success") throw new Error("Mint transaction reverted");

    await prisma.flowFulfillment.update({ where: { transactionId }, data: { status: "MINTED" } });
    return json({ success: true, mintTxHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fulfill] mint failed:", message);

    if (mintTxHash && message !== "Mint transaction reverted") {
      // Broadcast, but the receipt wait failed (timeout, RPC error): the
      // row stays SENT and the next request settles it from the hash.
      await prisma.flowFulfillment
        .update({ where: { transactionId }, data: { error: message } })
        .catch(() => {});
      return json({ error: "Minting was submitted and is still confirming. Check back in a minute." }, 202);
    }
    // Nothing went out, or the mint reverted: retryable.
    await prisma.flowFulfillment
      .update({ where: { transactionId }, data: { status: "FAILED", error: message } })
      .catch(() => {});

    const outOfFunds =
      message.includes("gas required exceeds allowance (0)") ||
      message.includes("insufficient funds");
    if (outOfFunds) {
      return json({ error: "Minter wallet is out of funds — contact support to claim your ships." }, 500);
    }
    return json({ error: `Minting failed: ${message}` }, 500);
  }
}
