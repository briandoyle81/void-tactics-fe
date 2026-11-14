import { type NextRequest, NextResponse } from "next/server";
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, actions, baseEncode, type KeyPairString } from "near-api-js";
import { FLOW_USD_TIERS, type FlowPaymentMemo } from "@/app/config/flowPayment";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/app/generated/prisma";
import { GAME_CONTRACT, GAS_HEAVY, NEAR_DYNAMIC_ENVIRONMENT_ID } from "@/app/near/config";
import { toReceipt, type NearOutcomeLike } from "@/app/near/codec";
import { safeErrorMessage } from "@/app/near/server";

// POST /api/flow/fulfill { transactionId } — mints the ships a Fireblocks
// Flow card payment bought, with the game contract's create_ships_for. A
// backend wallet is allowed here (CLAUDE.md "No Backend Services in Place of
// Contract Functions"): create_ships_for needs the MINTER role, which only
// the server account (NEAR_MINTER_ACCOUNT_ID) holds.
//
// Everything about the purchase comes from the payment itself, never the
// request body: the checkout transaction is fetched from Dynamic, must belong
// to this game's checkout (so it paid our treasury), must have settled, and
// must have paid the tier's amount. The buyer, tier and variant are read
// from the memo the client attached when it created the payment
// (useFlowPaymentModal), so a transaction id can only ever mint to the
// account it was created for.
//
// The mint attaches NEAR for the buyer's storage (STORAGE_PER_SHIP per
// ship); the contract registers the buyer if needed and credits it as
// sponsored storage (spendable, not withdrawable).
//
// Once only, enforced by the database: a FlowFulfillment row (unique
// transactionId) is inserted before anything is sent. The mint is signed
// first and its hash stored before broadcasting; a retry of a SENT row
// settles it from that hash instead of minting again. Only a FAILED row
// (nothing went out, or the mint failed onchain) can be claimed again.
// Mints are serialized with a Postgres advisory lock so concurrent ones
// don't race the minter key's nonce.
//
// Env:
//   NEAR_MINTER_ACCOUNT_ID    account with the MINTER role (required)
//   NEAR_MINTER_PRIVATE_KEY   its full-access key, "ed25519:..." (the call carries a deposit)
//   NEAR_MINTER_RPC_URL       server-side RPC, default NEXT_PUBLIC_NEAR_RPC_URL / FastNEAR testnet
//   NEXT_PUBLIC_FLOW_CHECKOUT_ID  the Dynamic checkout (in the NEAR Dynamic project)

const CHECKOUT_ID = process.env.NEXT_PUBLIC_FLOW_CHECKOUT_ID;
const MINTER_ACCOUNT = process.env.NEAR_MINTER_ACCOUNT_ID ?? "";
const MINTER_KEY = process.env.NEAR_MINTER_PRIVATE_KEY ?? "";
const RPC_URL =
  process.env.NEAR_MINTER_RPC_URL || process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://test.rpc.fastnear.com";
/** FlowFulfillment.chainId for NEAR testnet mints (the same tag the faucet uses). */
const NEAR_TESTNET_CHAIN = 398;
/** pg_advisory_xact_lock key for minter sends (arbitrary, app-unique). */
const MINT_LOCK_KEY = 398002;
/** Storage NEAR attached per minted ship (the contract's guidance: ~0.003 NEAR is safe). */
const STORAGE_PER_SHIP = BigInt("3000000000000000000000");
/** NEAR account ids: implicit (64 hex) or named (2–64 chars of a-z, 0-9, _-. separators). */
const ACCOUNT_ID_RE = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

/** The fields of Dynamic's checkout transaction this route relies on. */
interface CheckoutTransaction {
  checkoutId?: string;
  settlementState?: string;
  amount?: string;
  memo?: Partial<FlowPaymentMemo> | null;
}

interface Purchase {
  buyer: string;
  tier: number;
  variant: number;
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

function purchaseFromMemo(memo: CheckoutTransaction["memo"]): Purchase | null {
  if (!memo || typeof memo !== "object") return null;
  const { buyerAddress, tier, variant } = memo;
  if (typeof buyerAddress !== "string" || !ACCOUNT_ID_RE.test(buyerAddress)) return null;
  if (typeof tier !== "number" || !FLOW_USD_TIERS[tier]) return null;
  // A gated variant (the Drone faction needs the Shattered Hive medal) is
  // checked by the contract against the buyer; the mint fails rather than
  // minting it.
  const mintVariant =
    typeof variant === "number" && Number.isInteger(variant) && variant >= 1 && variant <= 65535 ? variant : 1;
  return { buyer: buyerAddress, tier, variant: mintVariant };
}

function provider() {
  return new JsonRpcProvider({ url: RPC_URL });
}

function minterAccount(): Account {
  return new Account(MINTER_ACCOUNT, provider(), new KeyPairSigner(KeyPair.fromString(MINTER_KEY as KeyPairString)));
}

/** The executed outcome of a stored mint hash, or null if the network hasn't seen it (yet). */
async function mintOutcome(hash: string) {
  try {
    const outcome = (await provider().viewTransactionStatus({
      txHash: hash,
      accountId: MINTER_ACCOUNT,
      waitUntil: "EXECUTED_OPTIMISTIC",
    })) as unknown as NearOutcomeLike;
    return toReceipt(outcome);
  } catch {
    return null;
  }
}

/** A row whose mint was already broadcast: settles it from the stored hash. */
async function resolveSentMint(transactionId: string, mintTxHash: string) {
  const receipt = await mintOutcome(mintTxHash);
  if (!receipt) return json({ error: "Minting is in progress. Check back in a minute." }, 409);
  if (receipt.success) {
    await prisma.flowFulfillment.update({ where: { transactionId }, data: { status: "MINTED", error: null } });
    return json({ success: true, mintTxHash });
  }
  await prisma.flowFulfillment.update({
    where: { transactionId },
    data: { status: "FAILED", error: (receipt.failure ?? "Mint failed").slice(0, 300) },
  });
  return json({ error: "Minting failed onchain. Try again." }, 500);
}

/** sha256 of the signed transaction's inner transaction: the NEAR tx hash. */
async function signedHash(signed: { transaction: { encode(): Uint8Array } }): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", signed.transaction.encode() as BufferSource);
  return baseEncode(new Uint8Array(digest));
}

export async function POST(req: NextRequest) {
  if (!MINTER_ACCOUNT || !MINTER_KEY || !CHECKOUT_ID || !NEAR_DYNAMIC_ENVIRONMENT_ID) {
    return json({ error: "Card payments are not configured" }, 503);
  }

  const body = (await req.json().catch(() => ({}))) as { transactionId?: unknown };
  const transactionId = typeof body.transactionId === "string" ? body.transactionId : "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId)) {
    return json({ error: "Invalid transaction id" }, 400);
  }

  // The payment, from Dynamic (not from the client).
  const txRes = await fetch(
    `https://app.dynamicauth.com/api/v0/sdk/${NEAR_DYNAMIC_ENVIRONMENT_ID}/transactions/${encodeURIComponent(transactionId)}`,
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
  // Compared as numbers, so "0.1" and "0.10" match.
  if (Number(tx.amount) !== Number(FLOW_USD_TIERS[purchase.tier].actualAmount)) {
    return json({ error: "Transaction amount does not match tier" }, 400);
  }
  if (tx.settlementState !== "completed") {
    return json({ error: `Settlement not complete: ${tx.settlementState ?? "unknown"}` }, 400);
  }

  // Claim the payment: insert a PENDING row, or take over a FAILED one.
  const rowData = {
    buyerAddress: purchase.buyer,
    tier: purchase.tier,
    chainId: NEAR_TESTNET_CHAIN,
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
      return resolveSentMint(transactionId, existing.mintTxHash);
    }
    // A FAILED row whose stored hash did go out: settle it, never mint twice.
    if (existing.status === "FAILED" && existing.mintTxHash && (await mintOutcome(existing.mintTxHash))) {
      return resolveSentMint(transactionId, existing.mintTxHash);
    }
    // Atomic: of two concurrent retries, only one moves FAILED → PENDING.
    const claimed = await prisma.flowFulfillment.updateMany({
      where: { transactionId, status: "FAILED" },
      data: { ...rowData, status: "PENDING", error: null, mintTxHash: null },
    });
    if (claimed.count === 0) return json({ error: "Minting is in progress" }, 409);
  }

  let mintTxHash: string | null = null;
  try {
    const tiers = (await provider().callFunction({
      contractId: GAME_CONTRACT,
      method: "get_price_tiers",
      args: {},
    })) as Array<{ ships: number }>;
    const ships = tiers?.[purchase.tier]?.ships;
    if (!ships) throw new Error(`No price tier ${purchase.tier}`);

    const minter = minterAccount();
    let outcome: NearOutcomeLike | null = null;
    await prisma.$transaction(
      async (dbTx) => {
        await dbTx.$executeRaw`SELECT pg_advisory_xact_lock(${MINT_LOCK_KEY})`;
        const signed = await minter.createSignedTransaction({
          receiverId: GAME_CONTRACT,
          actions: [
            actions.functionCall(
              "create_ships_for",
              { to: purchase.buyer, amount: ships, variant: purchase.variant, tier: purchase.tier, is_free: false },
              GAS_HEAVY,
              STORAGE_PER_SHIP * BigInt(ships),
            ),
          ],
        });
        mintTxHash = await signedHash(signed);
        // Recorded before broadcasting: from here a retry resolves this hash.
        await dbTx.flowFulfillment.update({ where: { transactionId }, data: { status: "SENT", mintTxHash } });
        outcome = (await minter.provider.sendTransactionUntil(signed, "EXECUTED_OPTIMISTIC")) as unknown as NearOutcomeLike;
      },
      { timeout: 60_000, maxWait: 30_000 },
    );

    const receipt = toReceipt(outcome as unknown as NearOutcomeLike);
    if (!receipt.success) {
      await prisma.flowFulfillment.update({
        where: { transactionId },
        data: { status: "FAILED", error: (receipt.failure ?? "Mint failed").slice(0, 300) },
      });
      return json({ error: "Minting failed onchain. Try again, or contact support to claim your ships." }, 500);
    }
    await prisma.flowFulfillment.update({ where: { transactionId }, data: { status: "MINTED" } });
    return json({ success: true, mintTxHash });
  } catch (err) {
    const message = safeErrorMessage(err);
    console.error("[fulfill] mint failed:", message);
    if (mintTxHash && (await mintOutcome(mintTxHash))) {
      // It went out; the response was lost. Settle from the hash.
      return resolveSentMint(transactionId, mintTxHash);
    }
    if (mintTxHash) {
      // Signed and maybe broadcast, not seen yet: leave it SENT so the next request settles it.
      // (The SENT write rolled back with the failed database transaction, so write it again.)
      await prisma.flowFulfillment
        .update({ where: { transactionId }, data: { status: "SENT", mintTxHash, error: message } })
        .catch(() => {});
      return json({ error: "Minting was submitted and is still confirming. Check back in a minute." }, 202);
    }
    await prisma.flowFulfillment
      .update({ where: { transactionId }, data: { status: "FAILED", error: message } })
      .catch(() => {});
    if (/not enough balance|NotEnoughBalance|LackBalance/i.test(message)) {
      return json({ error: "Minter account is out of funds — contact support to claim your ships." }, 500);
    }
    return json({ error: `Minting failed: ${message}` }, 500);
  }
}
