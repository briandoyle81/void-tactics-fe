/**
 * NEAR network and contract config. Replaces the EVM chain config
 * (config/networks.ts, contractAddresses.ts, contracts.ts): on NEAR the
 * whole game is two accounts, the game contract and the view-only renderer.
 *
 * Contracts: ~/void-tactics-contracts-eth-online-2026/near, handoff
 * docs/near-frontend-handoff-2026-11-13.md.
 */

export type NearNetwork = "testnet" | "mainnet" | "sandbox";

export const NEAR_NETWORK: NearNetwork =
  (process.env.NEXT_PUBLIC_NEAR_NETWORK as NearNetwork | undefined) ?? "testnet";

const DEFAULT_RPC: Record<NearNetwork, string> = {
  testnet: "https://test.rpc.fastnear.com",
  mainnet: "https://rpc.mainnet.fastnear.com",
  sandbox: "http://127.0.0.1:3030",
};

/** Never hardcode a keyed URL: a keyed provider goes in NEXT_PUBLIC_NEAR_RPC_URL. */
export const NEAR_RPC_URL = process.env.NEXT_PUBLIC_NEAR_RPC_URL || DEFAULT_RPC[NEAR_NETWORK];

export const GAME_CONTRACT = process.env.NEXT_PUBLIC_NEAR_GAME_CONTRACT || "game.void-tactics.testnet";
export const RENDERER_CONTRACT =
  process.env.NEXT_PUBLIC_NEAR_RENDERER_CONTRACT || "art.void-tactics.testnet";

/** Dynamic environment for the NEAR build (its own Dynamic project, Solana embedded wallets on). */
export const NEAR_DYNAMIC_ENVIRONMENT_ID =
  process.env.NEXT_PUBLIC_NEAR_DYNAMIC_ENVIRONMENT_ID || process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || "";

export const EXPLORER_TX_URL =
  NEAR_NETWORK === "mainnet" ? "https://nearblocks.io/txns/" : "https://testnet.nearblocks.io/txns/";

/** 1 Tgas in gas units. */
export const TGAS = BigInt(10) ** BigInt(12);
/** Gameplay calls (moves, lobbies, fleets): the handoff measured move_ship at 4 Tgas. */
export const GAS_DEFAULT = BigInt(50) * TGAS;
/** Claims, purchases, AI turns and other heavy calls. */
export const GAS_HEAVY = BigInt(300) * TGAS;

/**
 * Gas for a call that mints `ships` ships: the call itself plus the
 * randomness callback it schedules (10 Tgas + 3 per ship, the contract's
 * randomness.rs), with room to spare. NEAR makes the signer hold the full
 * attached gas's cost up front (about 0.001 NEAR per Tgas on testnet,
 * refunded after), so a new player with a small balance can't attach 300
 * Tgas: player calls attach what they need. GAS_HEAVY is for admin tools.
 */
export function gasForShips(ships: number): bigint {
  const tgas = 40 + 3 * Math.max(1, Math.ceil(ships));
  return BigInt(Math.min(300, tgas)) * TGAS;
}

export const YOCTO_PER_NEAR = BigInt(10) ** BigInt(24);
export const ONE_YOCTO = BigInt(1);

/** Session (function-call) key gas allowance. Small on purpose: a stolen key can only spend this. */
export const SESSION_KEY_ALLOWANCE = BigInt(1) * YOCTO_PER_NEAR; // 1 NEAR of gas

/** First storage deposit for a new player: ~30 ships (handoff §3). */
export const INITIAL_STORAGE_DEPOSIT = YOCTO_PER_NEAR / BigInt(10); // 0.1 NEAR
/** Suggested top-up when the storage balance runs low. */
export const STORAGE_TOP_UP = YOCTO_PER_NEAR / BigInt(10);
/** Below this much available storage the UI asks for a top-up before writes. */
export const LOW_STORAGE_YOCTO = YOCTO_PER_NEAR / BigInt(200); // 0.005 NEAR ≈ 1–2 ships

/** NEP-245 token ids on the game contract. */
export const TOKEN_UTC = "utc";
export const TOKEN_DEC = "dec";
export const TOKEN_HIVE_MEDAL = "hive_medal";

/** The roguelike campaign the Play tab runs (seeded as id 1 on testnet). */
export const ROGUELIKE_CAMPAIGN_ID = BigInt(process.env.NEXT_PUBLIC_NEAR_ROGUELIKE_CAMPAIGN_ID || "1");

/**
 * Role bits from the contract's `get_roles` (contracts/void-tactics/src/lib.rs,
 * `roles`). The owner (`owner_id()`) is separate and passes every role check.
 */
export const ROLE = {
  MAP_EDITOR: 1 << 0,
  NODE_EDITOR: 1 << 1,
  MINTER: 1 << 2,
  VERIFIER: 1 << 3,
  PAUSER: 1 << 4,
  SPONSOR: 1 << 5,
  BLOB_WRITER: 1 << 6,
} as const;
