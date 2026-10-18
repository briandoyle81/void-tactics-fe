

// World ID — on-chain verification via Base Sepolia WorldIDRouter (Orb, groupId=1)
export const WORLD_APP_ID = "app_b2739b54eb71ceb8c76380c60c20ce22" as const;
export const WORLD_RP_ID = "rp_7a7c4c4d289540ed" as const;
export const WORLD_ACTION = "join-tournament" as const;

// Selfie Check — off-chain-only REST verification (no on-chain WorldIDRouter path, unlike Orb
// above). Same WORLD_APP_ID/WORLD_RP_ID, separate action so its nullifier scope never overlaps
// with tournament registration. See
// docs/eth-global-remote/uniswap-lottery-selfie-check-frontend-integration.md §3. This action
// must exist in the World Developer Portal for this app before verification will succeed.
export const WORLD_SELFIE_CHECK_ACTION = "selfie-check-verify" as const; // 1%
export const CHAMPION_SHARE_PCT = 60;
export const RUNNER_UP_SHARE_PCT = 40;
