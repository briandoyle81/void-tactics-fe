import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, getAddress, http, isAddress, keccak256, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/app/generated/prisma";
import { DynamicAuthError, verifyDynamicJwt } from "@/app/lib/dynamicJwt";

// POST /api/faucet/gas — one-time test ETH for a new player's Dynamic
// embedded wallet on Base Sepolia, so they can pay for their first
// transactions (claim, build, lobby, fleet, moves ≈ 0.0001 ETH). Testnet
// only, to be replaced by an onramp.
//
// A backend wallet is allowed here (see CLAUDE.md "No Backend Services in
// Place of Contract Functions"): sending ETH needs the faucet wallet's key,
// which the player doesn't have.
//
// Once only, enforced by the database: the GasGrant row (unique address,
// unique Dynamic user) is inserted before anything is sent, so concurrent or
// repeated requests can't both get through. A row only becomes claimable
// again when it's FAILED (nothing went out). Sends are serialized with a
// Postgres advisory lock so concurrent grants don't reuse the faucet
// wallet's nonce. The transaction is signed first and its hash stored
// before broadcasting, so an error after the RPC accepted it (a lost reply)
// is caught: a FAILED grant whose stored hash turns up on chain is SENT,
// never resent.
//
// Env:
//   GAS_FAUCET_PRIVATE_KEY   faucet wallet (required; unset = disabled)
//   GAS_FAUCET_AMOUNT_ETH    per grant, default 0.001
//   GAS_FAUCET_DAILY_LIMIT   max grants per rolling 24h, default 500
//   GAS_FAUCET_RPC_URL       server-side Base Sepolia RPC (the app's
//                            NEXT_PUBLIC_ key is origin-restricted), default
//                            the public endpoint

const rawKey = process.env.GAS_FAUCET_PRIVATE_KEY ?? "";
const FAUCET_KEY = rawKey ? ((rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`) : null;
const AMOUNT_WEI = parseEther(process.env.GAS_FAUCET_AMOUNT_ETH || "0.001");
const DAILY_LIMIT = Number(process.env.GAS_FAUCET_DAILY_LIMIT || 500);
const RPC_URL = process.env.GAS_FAUCET_RPC_URL || undefined;
/** pg_advisory_xact_lock key for faucet sends (arbitrary, app-unique). */
const SEND_LOCK_KEY = 84532001;

const transport = http(RPC_URL);
const publicClient = createPublicClient({ chain: baseSepolia, transport });
const walletClient = createWalletClient({ chain: baseSepolia, transport });

type GrantResponse =
  | { status: "sent"; txHash: string; amountWei: string }
  | { status: "already-claimed" }
  | { status: "ineligible"; reason: string };

const json = (body: GrantResponse | { error: string }, status = 200) => NextResponse.json(body, { status });

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function POST(req: NextRequest) {
  if (!FAUCET_KEY) return json({ status: "ineligible", reason: "faucet-disabled" });

  let claims;
  try {
    claims = await verifyDynamicJwt(req.headers.get("authorization"));
  } catch (e) {
    const message = e instanceof DynamicAuthError ? e.message : "Unauthorized";
    return json({ error: message }, 401);
  }

  const body = (await req.json().catch(() => ({}))) as { address?: string };
  if (!body.address || !isAddress(body.address)) return json({ error: "Invalid address" }, 400);
  const address = getAddress(body.address).toLowerCase();

  // Only wallets the game created for the player: a Dynamic embedded wallet
  // on this signed-in account.
  const isEmbeddedWallet = (claims.verified_credentials ?? []).some(
    (vc) =>
      vc.format === "blockchain" &&
      vc.wallet_provider === "embeddedWallet" &&
      vc.address?.toLowerCase() === address,
  );
  if (!isEmbeddedWallet) return json({ status: "ineligible", reason: "not-embedded-wallet" });

  const dynamicUserId = claims.sub;

  // Claim the grant (or re-claim one that failed before sending).
  let grantId: number;
  try {
    const recent = await prisma.gasGrant.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    if (recent >= DAILY_LIMIT) return json({ status: "ineligible", reason: "daily-limit" });
    grantId = (
      await prisma.gasGrant.create({
        data: {
          address,
          dynamicUserId,
          chainId: baseSepolia.id,
          amountWei: AMOUNT_WEI.toString(),
        },
        select: { id: true },
      })
    ).id;
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const existing = await prisma.gasGrant.findFirst({
      where: { OR: [{ address }, { dynamicUserId }] },
    });
    const canRetry =
      existing?.status === "FAILED" && existing.address === address && existing.dynamicUserId === dynamicUserId;
    if (!existing || !canRetry) return json({ status: "already-claimed" });
    if (existing.txHash && (await wasBroadcast(existing.txHash as `0x${string}`))) {
      await prisma.gasGrant.update({ where: { id: existing.id }, data: { status: "SENT" } });
      return json({ status: "already-claimed" });
    }
    // Only one retry wins the FAILED -> PENDING flip.
    const flipped = await prisma.gasGrant.updateMany({
      where: { id: existing.id, status: "FAILED" },
      data: { status: "PENDING", error: null },
    });
    if (flipped.count !== 1) return json({ status: "already-claimed" });
    grantId = existing.id;
  }

  const account = privateKeyToAccount(FAUCET_KEY!);
  let txHash: `0x${string}` | null = null;
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEND_LOCK_KEY})`;
        const balance = await publicClient.getBalance({ address: account.address });
        if (balance < AMOUNT_WEI * 2n) throw new Error(`Faucet wallet low: ${balance} wei`);
        const request = await walletClient.prepareTransactionRequest({
          account,
          to: getAddress(address),
          value: AMOUNT_WEI,
        });
        const signed = await walletClient.signTransaction(request);
        txHash = keccak256(signed);
        // Recorded before broadcasting; see the header comment.
        await tx.gasGrant.update({ where: { id: grantId }, data: { txHash } });
        await publicClient.sendRawTransaction({ serializedTransaction: signed });
      },
      { timeout: 30_000, maxWait: 30_000 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 500) : String(e);
    console.error("[gas-faucet] send failed:", message);
    // The transaction above rolled back, so re-record the hash (if one was
    // signed) with the failure; a retry checks it before resending.
    if (txHash && (await wasBroadcast(txHash))) {
      await prisma.gasGrant.update({ where: { id: grantId }, data: { status: "SENT", txHash } });
      return json({ status: "sent", txHash, amountWei: AMOUNT_WEI.toString() });
    }
    await prisma.gasGrant.update({ where: { id: grantId }, data: { status: "FAILED", txHash, error: message } });
    return json({ error: "Couldn't send test ETH right now. Try again later." }, 503);
  }

  await prisma.gasGrant.update({ where: { id: grantId }, data: { status: "SENT", txHash } });
  return json({ status: "sent", txHash: txHash!, amountWei: AMOUNT_WEI.toString() });
}

/** Whether the network has seen this transaction (pending or mined). */
async function wasBroadcast(hash: `0x${string}`): Promise<boolean> {
  try {
    await publicClient.getTransaction({ hash });
    return true;
  } catch {
    return false;
  }
}
