# Void Tactics — Frontend (NEAR port)

> **For NEAR hackathon judges: please read this first.** We found out about this hackathon at the last minute. Void Tactics was a large, working EVM game (about 99 Solidity contracts on Base Sepolia and a Next.js client built around wagmi and viem), and this submission is a hail mary: can we move the whole thing to native NEAR in about 36 hours? This branch is the result. The core game works end to end on NEAR testnet, and we say below exactly what was cut and what's still missing.

**Live NEAR build:** https://warpflow-git-near-migration-experiment-briandoyle81s-projects.vercel.app/
**Branch:** `near-migration-experiment` (this repo) and `near-migration-experiment` in [briandoyle81/void-tactics-contracts](https://github.com/briandoyle81/void-tactics-contracts) (the Rust contracts are in its `near/` folder, with their own README).
**What was built during the hackathon:** everything after commit `551228e` (2026-11-13 08:55 ET), the last EVM commit. `git diff --stat 551228e` shows it: about 465 files changed, 22,000 lines added, and 71,000 removed (most of the removals are the EVM chain layer, contract ABIs, and features we cut).
**Network:** NEAR testnet, game contract `game.void-tactics.testnet`, renderer `art.void-tactics.testnet`.

Void Tactics is a turn-based tactical space combat game. Players build fleets of NFT ships and fight on a 17×11 grid against other players or a campaign AI, and every move is resolved onchain.

---

## The NEAR Hackathon Attempt

### What we tried to do

Port the whole game, not a demo slice: ships, free claims, the store, the drone core economy, single-player missions, PvP lobbies, the roguelike campaign, and the Ops Console admin tools. We cut three features to fit the time: tournaments, the UTC lottery, and the Uniswap v4 sell hook.

The rule we set ourselves was to swap the chain layer underneath the existing screens instead of building new NEAR screens. The game board, fleet builder, run map, store, and admin screens are the same components as the EVM version. What changed is how they read, write, sign, and stay fresh.

### What changed in the frontend

- **A new chain layer, `app/near/`.** Views, transactions, error decoding, account identity, and adapters that turn the contract's JSON into the app's existing types. The contract's ABI (`cargo near abi`) is turned into TypeScript by `near-scripts/gen-near-types.ts`, so every call's arguments are type-checked against the contract. That check caught two calls that would have failed onchain.
- **Sign-in stays on Dynamic, with no wallet popups during play.** A Dynamic Solana embedded wallet is an Ed25519 key, which is exactly what a NEAR implicit account is, so the player's NEAR account is derived from the wallet they already sign in with. On first sign-in the app funds the account from a testnet faucet route, adds a browser session key (a function-call key limited to the game contract), and pays the storage deposit. After that, moves, claims, and matches sign with the session key and never prompt. Calls that attach NEAR, such as buying ships, are signed by the Dynamic wallet.
- **No event logs, so polling by change counters.** NEAR RPC can't search logs the way the EVM client did. The contract keeps two counters, one per game and one per player, and the client polls those small numbers. It only re-reads a board, a ship list, or a balance when its counter moves. AI moves are animated from the `ai_turns` event and the board before and after.
- **Removed:** wagmi, viem (except in the card checkout), gas sponsorship, the EVM gas faucet, and per-chain configuration. Lint now blocks EVM imports.

### What's verified

- `npx tsc --noEmit -p .` is clean, `npm run lint` has no errors, and `npx vitest run` passes (631 tests, including tests for account derivation, Dynamic signature checking, event parsing, and the NEAR adapters).
- Read-only checks against the live testnet contract: all 72 maps decode, the 35-node roguelike campaign loads, 64 AI ship configs, settings, price tiers, ship stats from the live attribute tables, the renderer's art, and the change counters.
- On the contracts side, the Rust rules engine replays 16 full campaign matches (743 steps) from the Solidity contracts and must match the board after every step, AI decisions included. That's documented in the contracts repo's `near/README.md`.

### Tested end to end in the browser

On the live build, against NEAR testnet:

1. Sign in with a Dynamic embedded wallet (email code).
2. Account activation: the faucet funds the new implicit account, the session key is added, and the storage deposit is paid.
3. Claim free ships; they construct themselves a block or two later.
4. Build a fleet and play a mission against the onchain AI, with no wallet prompts for moves.
5. Buy ships in the store with NEAR, signed by the Dynamic wallet. That's the step we were least sure of going in: the wallet signs the transaction's sha256 hash through Solana message signing, and the client verifies the signature before sending it.

### Known gaps

- **Replay of past games.** The contract now writes the whole board into every event that changes a game, so an indexer could serve full replays, but we haven't built that indexer. Replay covers only moves the player's own device saw.
- **Card checkout is off.** `/api/flow/fulfill` mints through the contract's Minter role, but no server account has that role on testnet yet.
- **Tournaments, the lottery, and the Uniswap sell hook** are not ported.

### How the pieces fit

| Piece                                                              | Where                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Chain layer (views, sends, sync, onboarding)                       | `app/near/`                                                                     |
| Session key and Dynamic signer                                     | `app/near/session.tsx`, `app/near/dynamicSigner.ts`, `app/near/sessionKey.ts`   |
| Polling by change counters                                         | `app/near/sync/NearSyncHost.tsx`                                                |
| Generated contract types                                           | `app/near/generated/`, from `app/near/abi/*.json`                               |
| Privileged server calls (faucet, Selfie Check verifier, card mint) | `app/api/faucet/near/`, `app/api/selfie-check/verify/`, `app/api/flow/fulfill/` |
| Contract-side ids for seed content                                 | `app/near/deployments/testnet.json` (a copy of the contracts repo's record)     |

---

## The Game Itself

### Fleet Building

Players assemble fleets from their owned NFT ships, staying within a cost budget. Ships have procedurally generated stats (accuracy, hull, speed) and equipment (weapon, armor or shields, special). Expensive ships are more capable but allow fewer slots; cheaper ships give more numbers at the cost of individual power. Fleets are committed before the game starts.

### Combat

Turns alternate between players. Each turn, a player selects a ship, moves it within range, and chooses an action: shoot, use a special ability, ram, retreat, or hold. Ships and terrain block movement and line of sight. A ship knocked to 0 HP is disabled: it stays on the board, can be repaired or finished off, and takes reactor damage each round until it's destroyed.

Destruction is permanent. The NFT still exists, but the destroyed flag is set in the contract and the ship can't join future fleets. Players decide in real time whether to spend a ship to win a round or pull it back and fight another day.

### Scoring

Resource tiles award points to the side holding them at the end of each round (some pay out only once). Reaching the point threshold wins the game, and so does destroying or driving off the enemy fleet. Maps define their own terrain, scoring tiles and deployment zones.

### Onboarding

First Contact, a fully scripted battle (simulated locally, no gas), teaches movement, inspecting ships, nebulae, scoring, shooting, EMPs, reactor damage and the choice between saving a ship and winning the round. Completing it unlocks a claimable ship reward onchain.

---

## Before NEAR: the EVM Game (Colosseum, 9/14–10/12)

Everything in this section was built for an earlier hackathon, on the EVM version of the game, and isn't part of the NEAR submission. It's here because it's what we ported.

> **Note for Colosseum judges:** This is the original Void Tactics frontend repository, submitted with its full commit history. The contracts are submitted the same way ([briandoyle81/void-tactics-contracts](https://github.com/briandoyle81/void-tactics-contracts)). Everything described under "What's New" below was committed on or after **2026-09-14**, the hackathon start date. The first commit in the hackathon window is `a62c052` (2026-09-18); everything up to and including `719cd33` (2026-09-08) predates it. Run `git log --since=2026-09-14` to see exactly what was built during the event. Work from a short-lived intermediate copy of this repo (`void-tactics-fe-eth-ny-26`) was fast-forwarded back into this one, so every commit keeps its original hash and date.

Between 2026-09-14 and 2026-10-12 the frontend received about 50 commits. The contracts side (rules overhaul, per-variant AI, roguelike progression, upgradeable-by-design infrastructure) is described in the contracts repo README. This section covers the frontend: a full redesign of the game client, a playable roguelike campaign with a story told through in-mission dialog, a play-first onboarding path, and the UI for the new combat rules.

### Redesigned Game Client

- **Website and game split.** [voidtactics.xyz](https://www.voidtactics.xyz) is now a marketing site (hero, live gameplay demo built from the real game board, ship showcase), and the game itself lives at `/play` (or its own host, via `proxy.ts` host routing).
- **New client shell.** A HUD with resource pills and a your-turn bell, a Command Deck hub, and a game nav (Play · Fleet · Store · Battles · Profile). The Store has ship packs, credits, Drone Cores and a UTC lottery. Fleet has ships, loadouts and progression. Battles is an inbox: your turn, waiting, and finished matches with replay.
- **Navigation state lives in the URL.** Every screen, sub-tab, open match, lobby, ship and selected map node is in the query string, so refresh, deep links and Back/Forward all work.
- **Board polish.** Weapon and special animations for both factions, a ram animation, optimistic "pending move" prediction (the board shows a submitted move's result, locked as `[...]`, until the chain confirms it), in-game styled tooltips for ships and terrain tiles, and round-start / end-of-game reports filed by the crew.

### Roguelike Campaign #1 ("Operations")

- **Run map.** The campaign is drawn as a star chart, with a mission drawer (briefing, enemy fleet, mission dossier) and an action bar showing the run's fleet, hull and cost cap. Players warp to missions, enter resupply nodes, and choose branching routes that close behind them.
- **Fleet selection with a briefing.** The player's adjutant explains each step of building a run fleet (claim free ships, construct them, pick a roster within the cost range), with live status tags for each requirement.
- **Edit Mode for content editors.** Nodes, edges, maps and AI fleets can be edited in place on the same screen, and an Ops Console handles maps, ship attributes, purchase prices and seed-file export.

### Story and Dialog System

- **Characters and comms.** Missions now have a cast of characters with portraits. Lines arrive as comms messages during battle, are kept in a comms log, and play as a debrief on the result screen. Mission briefings appear as incoming transmissions.
- **Trigger engine.** A pure trigger engine (`app/utils/missionDialog.ts`) fires lines on mission start, round start and end, ships disabled, destroyed or retreated, reactor damage, resource tiles taken, points scored, and victory or defeat. It's shared by every game view and backed by tests.
- **Mission and generic lines.** Writers can script lines for a specific mission or write generic chatter for any mission, with multiple variants per line and replies from other characters. Explanatory lines can be hidden with "Don't show again."

### First Contact: Play First, Sign In Later

- **No account needed to start.** A new visitor lands on the Operations map with **First Contact** as their first mission. It's a scripted battle on the real game board, voiced by Adjutant Bosch, and needs no account or wallet. Finishing or skipping it leads into fleet selection and the real campaign, and First Contact stays on the map as cleared.
- **Real-game feel.** Moves show the same `[...]` pending state as a live match instead of a fake wallet prompt, and between rounds the tutorial shows the game's own round report.
- **Separate path for returning players.** Players who have played before, or who follow the site's Sign Up/Login link, get the sign-in screen instead.
- **All tutorial text in one data file.** Briefings, orders and the completion card live in `app/data/dialog/tutorial.ts` with a small emphasis markup, so they can be edited without touching components.

### Low-Friction Wallets

- **Dynamic embedded wallets** with passkeys that work across multiple devices, plus recovery codes.
- **Gas grants.** A new embedded wallet receives a one-time 0.001 ETH grant (`/api/faucet/gas`), so a player's first moves don't require them to source gas themselves. This is the one backend service that sends funds, and it only exists because sending them needs a privileged key.
- **Free starter ships** from the drone shipyards, address copying, and live balance refresh.

### UI for the New Combat Rules

- **Movement and line of sight.** Ships now block movement and line of sight, terrain can be impassable, and maps have custom deployment-zone shapes. Range previews, threat ranges and placement all reflect these rules.
- **Variant 2.** Its animations and the remapped specials are supported, and the client follows the per-variant attribute versions.

### Performance

- **Fewer RPC calls.** Aggregate reads go through the `GameLens` contract, and a single combined event poll replaces per-event watchers, both gated on page visibility.
- **Faster AI turns.** AI turns run through the batched `takeAITurns` call, with a refetch-until-changed loop so the board updates promptly after AI moves despite RPC lag.

### Web2 Mode (hidden for this submission)

- **Built, then switched off.** A hosted mode with Google sign-in and a Postgres backend was brought to parity with the onchain game (shared components, the same campaign and tutorial flows). Its sign-in is switched off for this submission (`WEB2_SIGN_IN_ENABLED` in `app/config/alpha.ts`), so the live game is wallet-only.

---

## Network

This branch runs on **NEAR testnet** only: `game.void-tactics.testnet` (ships, tokens, all game modes) and `art.void-tactics.testnet` (view-only ship art). The EVM version on Base Sepolia lives on `master` and is what [voidtactics.xyz](https://www.voidtactics.xyz) serves.

---

## Stack

- **Next.js 16** (App Router, Turbopack)
- **near-api-js 7** — RPC, transactions, and signing (only inside `app/near/` and `app/api/`)
- **Dynamic** — sign-in and the Solana embedded wallet that backs the player's NEAR account
- **TanStack React Query 5** — server and chain state
- **Tailwind CSS 4**
- **Prisma + Postgres (Neon)** — web2 mode data and the faucet's once-only records
- **PostHog** — analytics
- **Vitest** — unit tests (`npx vitest run`)

## Running Locally

```bash
npm install
npm run dev
```

Set these in `.env.local`:

- `NEXT_PUBLIC_NEAR_DYNAMIC_ENVIRONMENT_ID` — a Dynamic project with Solana embedded wallets turned on
- `NEXT_PUBLIC_NEAR_RPC_URL` — optional, defaults to `https://test.rpc.fastnear.com`
- `NEAR_FAUCET_ACCOUNT_ID`, `NEAR_FAUCET_PRIVATE_KEY` — funds new accounts on testnet
- `NEAR_VERIFIER_ACCOUNT_ID`, `NEAR_VERIFIER_PRIVATE_KEY` — Selfie Check verification
- `DATABASE_URL` — for the faucet's records and web2 mode

`CLAUDE.md` lists every variable, including the optional card checkout ones.

After a contract change, copy the ABI from the contracts repo into `app/near/abi/` and run `npx tsx near-scripts/gen-near-types.ts`.
