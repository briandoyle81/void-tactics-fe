import { type NextRequest, NextResponse } from "next/server";
import { WORLD_RP_ID, WORLD_SELFIE_CHECK_ACTION } from "@/app/config/tournament";
import { serverAccount, serverCall, safeErrorMessage } from "@/app/near/server";

const isHex = (v: string) => /^0x[0-9a-fA-F]*$/.test(v);
/** A NEAR account id (implicit 64-hex or named). */
const isNearAccount = (v: string) => /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(v) && v.length >= 2 && v.length <= 64;

// Selfie Check has no onchain proof-verification path (unlike Orb-level World ID, which
// Tournament.sol verifies onchain directly) — verification is this one off-chain REST call
// against World's own API. See
// docs/eth-global-remote/uniswap-lottery-selfie-check-frontend-integration.md §3.
//
// Uses the v4 RP-based endpoint (POST /api/v4/verify/{rp_id}), not the legacy v2 one — confirmed
// 2026-09-19 the hard way: the "World ID 4.0" action created via the developer portal
// (create_world_id_action) is only visible to this endpoint, not to legacy v2's app_id-scoped
// action lookup, which rejected it with invalid_action/"Action not found." This matches how the
// rest of this project already does World ID (app/api/world-id/rp-context/route.ts's signed
// rp_context, same rp_id) — v2 was the wrong endpoint from the start, not a config gap.
const WORLD_VERIFY_URL = `https://developer.world.org/api/v4/verify/${WORLD_RP_ID}`;

// The Verifier role's account on the game contract (mark_verified is
// Verifier-gated). A backend is allowed here (CLAUDE.md): the player's own
// key can't call it.
//   NEAR_VERIFIER_ACCOUNT_ID, NEAR_VERIFIER_PRIVATE_KEY ("ed25519:...")
const VERIFIER_ACCOUNT = process.env.NEAR_VERIFIER_ACCOUNT_ID ?? "";
const VERIFIER_KEY = process.env.NEAR_VERIFIER_PRIVATE_KEY ?? "";

interface WorldVerifyResultItem {
  identifier: string;
  success: boolean;
  nullifier?: string;
  code?: string;
  detail?: string;
}

interface WorldVerifySuccess {
  success: true;
  results: WorldVerifyResultItem[];
  nullifier?: string;
}

interface WorldVerifyFailure {
  code: string;
  detail: string;
  attribute: string | null;
}

export async function POST(req: NextRequest) {
  const { player, nonce, merkle_root, nullifier_hash, proof } = (await req.json()) as {
    player?: string;
    nonce?: string;
    merkle_root?: string;
    nullifier_hash?: string;
    proof?: string;
  };

  if (!player || !isNearAccount(player)) {
    return NextResponse.json({ error: "Missing or invalid player account" }, { status: 400 });
  }
  if (!nonce || !merkle_root || !nullifier_hash || !proof) {
    return NextResponse.json({ error: "Missing proof fields" }, { status: 400 });
  }
  if (!isHex(nullifier_hash) || nullifier_hash.length !== 66) {
    // A 32-byte nullifier: reject anything that can't be one up front.
    return NextResponse.json({ error: "Malformed nullifier_hash" }, { status: 400 });
  }

  // Verify the Selfie Check proof off-chain against World's API — "Legacy Proofs (v3)" request
  // shape (protocol_version 3.0 + nonce + responses[]), matching what IDKit's
  // allow_legacy_proofs=true actually produces.
  let verifyRes: Response;
  try {
    verifyRes = await fetch(WORLD_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        protocol_version: "3.0",
        nonce,
        action: WORLD_SELFIE_CHECK_ACTION,
        environment: "staging",
        responses: [
          {
            identifier: "selfie",
            merkle_root,
            nullifier: nullifier_hash,
            proof,
          },
        ],
      }),
    });
  } catch (err) {
    console.error("[selfie-check/verify] World API request failed:", err);
    return NextResponse.json({ error: "Could not reach World ID verification service" }, { status: 502 });
  }

  const verifyBody = (await verifyRes.json()) as WorldVerifySuccess | WorldVerifyFailure;
  const resultItem =
    "results" in verifyBody ? verifyBody.results.find((r) => r.identifier === "selfie") : undefined;
  if (!verifyRes.ok || !("success" in verifyBody) || !verifyBody.success || !resultItem?.success) {
    const detail =
      resultItem?.detail ?? ("detail" in verifyBody ? verifyBody.detail : "Verification failed");
    console.error("[selfie-check/verify] World verification rejected:", verifyBody);
    return NextResponse.json({ error: detail }, { status: 400 });
  }

  const verifiedNullifier = resultItem.nullifier ?? verifyBody.nullifier;
  if (!verifiedNullifier) {
    console.error("[selfie-check/verify] World response missing nullifier:", verifyBody);
    return NextResponse.json({ error: "Verification succeeded but no nullifier returned" }, { status: 502 });
  }

  if (!VERIFIER_ACCOUNT || !VERIFIER_KEY) {
    console.error("[selfie-check/verify] NEAR_VERIFIER_ACCOUNT_ID / NEAR_VERIFIER_PRIVATE_KEY not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  try {
    const receipt = await serverCall(serverAccount(VERIFIER_ACCOUNT, VERIFIER_KEY), "mark_verified", {
      account_id: player,
      nullifier_hash: verifiedNullifier,
    });
    if (!receipt.success) throw new Error(receipt.failure ?? "mark_verified failed");
    return NextResponse.json({ success: true, txHash: receipt.hash });
  } catch (err) {
    const message = safeErrorMessage(err);
    console.error("[selfie-check/verify] mark_verified failed:", message);
    return NextResponse.json({ error: `Onchain verification failed: ${message}` }, { status: 500 });
  }
}
