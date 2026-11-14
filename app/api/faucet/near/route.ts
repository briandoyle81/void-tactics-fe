import { NextRequest, NextResponse } from "next/server";
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, actions, baseEncode, type KeyPairString } from "near-api-js";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/app/generated/prisma";
import { DynamicAuthError, verifyDynamicJwt } from "@/app/lib/dynamicJwt";
import { GAS_FAUCET_ENABLED } from "@/app/config/alpha";
import { implicitAccountFromSolanaAddress } from "@/app/near/identity";
import { parseNear } from "@/app/near/codec";

// POST /api/faucet/near — one-time test NEAR for a new player's Dynamic
// embedded (Solana / Ed25519) wallet. Sending NEAR to the wallet's implicit
// account creates the account on chain; the amount also covers the first
// storage deposit and gas (app/near/session.tsx onboarding). Testnet only.
//
// A backend wallet is allowed here (see CLAUDE.md "No Backend Services in
// Place of Contract Functions"): sending NEAR needs the faucet account's
// key, which the player doesn't have. storage_deposit itself stays
// player-signed.
//
// Once only, enforced by the database (the GasGrant table, shared with the
// old EVM faucet: unique account, unique Dynamic user). The row is inserted
// before anything is sent; a FAILED row whose stored hash turns up on chain
// is SENT, never resent. Sends are serialized with a Postgres advisory lock
// so concurrent grants don't race the faucet key's nonce. The transaction
// is signed first and its hash stored before broadcasting.
//
// Env:
//   NEAR_FAUCET_ACCOUNT_ID    faucet account (required; unset = disabled)
//   NEAR_FAUCET_PRIVATE_KEY   its full-access key, "ed25519:..." (required)
//   NEAR_FAUCET_AMOUNT        per grant in NEAR, default 0.25
//   NEAR_FAUCET_DAILY_LIMIT   max grants per rolling 24h, default 500
//   NEAR_FAUCET_RPC_URL       server-side RPC, default NEXT_PUBLIC_NEAR_RPC_URL / FastNEAR testnet

const FAUCET_ACCOUNT = process.env.NEAR_FAUCET_ACCOUNT_ID ?? "";
const FAUCET_KEY = process.env.NEAR_FAUCET_PRIVATE_KEY ?? "";
const AMOUNT_YOCTO = parseNear(process.env.NEAR_FAUCET_AMOUNT || "0.25");
const DAILY_LIMIT = Number(process.env.NEAR_FAUCET_DAILY_LIMIT || 500);
const RPC_URL =
  process.env.NEAR_FAUCET_RPC_URL || process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://test.rpc.fastnear.com";
/** GasGrant.chainId for NEAR testnet grants (chainlist's NEAR testnet id). */
const NEAR_TESTNET_GRANT_CHAIN = 398;
/** pg_advisory_xact_lock key for faucet sends (arbitrary, app-unique). */
const SEND_LOCK_KEY = 398001;

type GrantResponse =
  | { status: "sent"; txHash: string; amountYocto: string }
  | { status: "already-claimed" }
  | { status: "ineligible"; reason: string };

const json = (body: GrantResponse | { error: string }, status = 200) => NextResponse.json(body, { status });

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

function faucetAccount(): Account {
  const provider = new JsonRpcProvider({ url: RPC_URL });
  return new Account(FAUCET_ACCOUNT, provider, new KeyPairSigner(KeyPair.fromString(FAUCET_KEY as KeyPairString)));
}

export async function POST(req: NextRequest) {
  if (!GAS_FAUCET_ENABLED || !FAUCET_ACCOUNT || !FAUCET_KEY) {
    return json({ status: "ineligible", reason: "faucet-disabled" });
  }

  let claims;
  try {
    claims = await verifyDynamicJwt(req.headers.get("authorization"));
  } catch (e) {
    const message = e instanceof DynamicAuthError ? e.message : "Unauthorized";
    return json({ error: message }, 401);
  }

  const body = (await req.json().catch(() => ({}))) as { address?: string };
  const solanaAddress = body.address ?? "";
  let accountId: string;
  try {
    accountId = implicitAccountFromSolanaAddress(solanaAddress);
  } catch {
    return json({ error: "Invalid address" }, 400);
  }

  // Only the wallet the game created for the player: a Dynamic embedded
  // wallet on this signed-in account.
  const isEmbeddedWallet = (claims.verified_credentials ?? []).some(
    (vc) => vc.format === "blockchain" && vc.wallet_provider === "embeddedWallet" && vc.address === solanaAddress,
  );
  if (!isEmbeddedWallet) return json({ status: "ineligible", reason: "not-embedded-wallet" });

  const dynamicUserId = claims.sub;

  let grantId: number;
  try {
    const recent = await prisma.gasGrant.count({
      where: {
        chainId: NEAR_TESTNET_GRANT_CHAIN,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recent >= DAILY_LIMIT) return json({ status: "ineligible", reason: "daily-limit" });
    grantId = (
      await prisma.gasGrant.create({
        data: {
          address: accountId,
          dynamicUserId,
          chainId: NEAR_TESTNET_GRANT_CHAIN,
          amountWei: AMOUNT_YOCTO.toString(),
        },
        select: { id: true },
      })
    ).id;
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const existing = await prisma.gasGrant.findFirst({
      where: { OR: [{ address: accountId }, { dynamicUserId }] },
    });
    const canRetry =
      existing?.status === "FAILED" && existing.address === accountId && existing.dynamicUserId === dynamicUserId;
    if (!existing || !canRetry) return json({ status: "already-claimed" });
    if (existing.txHash && (await wasBroadcast(existing.txHash))) {
      await prisma.gasGrant.update({ where: { id: existing.id }, data: { status: "SENT" } });
      return json({ status: "already-claimed" });
    }
    const flipped = await prisma.gasGrant.updateMany({
      where: { id: existing.id, status: "FAILED" },
      data: { status: "PENDING", error: null },
    });
    if (flipped.count !== 1) return json({ status: "already-claimed" });
    grantId = existing.id;
  }

  let txHash: string | null = null;
  try {
    const faucet = faucetAccount();
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEND_LOCK_KEY})`;
        const state = await faucet.getState();
        if (BigInt(state.balance.available) < AMOUNT_YOCTO * BigInt(2)) {
          throw new Error(`Faucet account low: ${state.balance.available} yocto`);
        }
        const signed = await faucet.createSignedTransaction({
          receiverId: accountId,
          actions: [actions.transfer(AMOUNT_YOCTO)],
        });
        const { txHash: hashBytes } = await signedHash(signed);
        txHash = baseEncode(hashBytes);
        // Recorded before broadcasting; see the header comment.
        await tx.gasGrant.update({ where: { id: grantId }, data: { txHash } });
        await faucet.provider.sendTransactionUntil(signed, "EXECUTED_OPTIMISTIC");
      },
      { timeout: 45_000, maxWait: 30_000 },
    );
  } catch (e) {
    // Never the raw error: it can include the RPC URL (and a key in it).
    const message = String((e as Error)?.message ?? "Send failed").replace(/https?:\/\/\S+/g, "<rpc>").slice(0, 300);
    console.error("[near-faucet] send failed:", message);
    if (txHash && (await wasBroadcast(txHash))) {
      await prisma.gasGrant.update({ where: { id: grantId }, data: { status: "SENT", txHash } });
      return json({ status: "sent", txHash, amountYocto: AMOUNT_YOCTO.toString() });
    }
    await prisma.gasGrant.update({ where: { id: grantId }, data: { status: "FAILED", txHash, error: message } });
    return json({ error: "Couldn't send test NEAR right now. Try again later." }, 503);
  }

  await prisma.gasGrant.update({ where: { id: grantId }, data: { status: "SENT", txHash } });
  return json({ status: "sent", txHash: txHash!, amountYocto: AMOUNT_YOCTO.toString() });
}

/** sha256 of the signed transaction's inner transaction: the NEAR tx hash. */
async function signedHash(signed: { transaction: { encode(): Uint8Array } }): Promise<{ txHash: Uint8Array }> {
  const digest = await crypto.subtle.digest("SHA-256", signed.transaction.encode() as BufferSource);
  return { txHash: new Uint8Array(digest) };
}

/** Whether the network has seen this transaction. */
async function wasBroadcast(hash: string): Promise<boolean> {
  try {
    const provider = new JsonRpcProvider({ url: RPC_URL });
    await provider.viewTransactionStatus({ txHash: hash, accountId: FAUCET_ACCOUNT, waitUntil: "NONE" });
    return true;
  } catch {
    return false;
  }
}
