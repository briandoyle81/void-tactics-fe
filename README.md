# Void Tactics — Frontend

> **Note for judges:** This is the original Void Tactics frontend repository, submitted with its full commit history. The contracts are submitted the same way ([briandoyle81/void-tactics-contracts](https://github.com/briandoyle81/void-tactics-contracts)). Everything described under "What's New" below was committed on or after **2026-09-14**, the hackathon start date. The first commit in the hackathon window is `a62c052` (2026-09-18); everything up to and including `719cd33` (2026-09-08) predates it. Run `git log --since=2026-09-14` to see exactly what was built during the event. Work from a short-lived intermediate copy of this repo (`void-tactics-fe-eth-ny-26`) was fast-forwarded back into this one, so every commit keeps its original hash and date.

**Live Deployment:** https://www.voidtactics.xyz
**Frontend Repo:** https://github.com/briandoyle81/void-tactics-fe
**Contracts Repo:** https://github.com/briandoyle81/void-tactics-contracts

Void Tactics is a turn-based tactical space combat game where players build fleets of NFT ships and fight on a 17×11 grid. Every move and every outcome is resolved on-chain. The frontend is a Next.js 16 App Router application (wagmi, viem, TanStack Query and Tailwind) talking directly to EVM contracts on Base Sepolia.

---

## What's New (Colosseum 9/14-10/12)

Between 2026-09-14 and 2026-10-12 the frontend received about 50 commits. The contracts side (rules overhaul, per-variant AI, roguelike progression, upgradeable-by-design infrastructure) is described in the contracts repo README. This section covers the frontend: a full redesign of the game client, a playable roguelike campaign with a story told through in-mission dialog, a play-first onboarding path, and the UI for the new combat rules.

### Redesigned Game Client

- **Website and game split.** [voidtactics.xyz](https://www.voidtactics.xyz) is now a marketing site (hero, live gameplay demo built from the real game board, ship showcase), and the game itself lives at `/play` (or its own host, via `proxy.ts` host routing).
- **New client shell.** A HUD with resource pills and a your-turn bell, a Command Deck hub, and a game nav (Play · Fleet · Store · Battles · Profile). The Store has ship packs, credits, Drone Cores and a UTC lottery. Fleet has ships, loadouts and progression. Battles is an inbox: your turn, waiting, and finished matches with replay.
- **Navigation state lives in the URL.** Every screen, sub-tab, open match, lobby, ship and selected map node is in the query string, so refresh, deep links and Back/Forward all work.
- **Board polish.** Weapon and special animations for both factions, a ram animation, optimistic "pending move" prediction (the board shows a submitted move's result, locked as `[...]`, until the chain confirms it), in-game styled tooltips for ships and terrain tiles, and round-start / end-of-game reports filed by the crew.

### Roguelike Campaign ("Operations")

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

## The Game Itself

### Fleet Building

Players assemble fleets from their owned NFT ships, staying within a cost budget. Ships have procedurally generated stats (accuracy, hull, speed) and equipment (weapon, armor or shields, special). Expensive ships are more capable but allow fewer slots; cheaper ships give more numbers at the cost of individual power. Fleets are committed before the game starts.

### Combat

Turns alternate between players. Each turn, a player selects a ship, moves it within range, and chooses an action: shoot, use a special ability, ram, retreat, or hold. Ships and terrain block movement and line of sight. A ship knocked to 0 HP is disabled: it stays on the board, can be repaired or finished off, and takes reactor damage each round until it's destroyed.

Destruction is permanent. The NFT still exists, but the destroyed flag is set in the contract and the ship can't join future fleets. Players decide in real time whether to spend a ship to win a round or pull it back and fight another day.

### Scoring

Resource tiles award points to the side holding them at the end of each round (some pay out only once). Reaching the point threshold wins the game, and so does destroying or driving off the enemy fleet. Maps define their own terrain, scoring tiles and deployment zones.

### Onboarding

First Contact, a fully scripted battle (simulated locally, no gas), teaches movement, inspecting ships, nebulae, scoring, shooting, EMPs, reactor damage and the choice between saving a ship and winning the round. Completing it unlocks a claimable ship reward on Base Sepolia.

---

## Network

The live game runs on **Base Sepolia** (chain id 84532). Contract addresses are in `app/contracts/base-sepolia/deployed_addresses.json`. The client also has configuration for Flow Testnet, Ronin Saigon and Xai Testnet v2 (`app/config/networks.ts`), but those chains are disabled for now and their deployments predate this hackathon.

---

## Stack

- **Next.js 16** (App Router, Turbopack)
- **wagmi 2 + viem 2** — chain interaction and contract reads/writes
- **Dynamic** — embedded wallets, passkeys, authentication and Flow payments
- **TanStack React Query 5** — server and chain state
- **Tailwind CSS 4**
- **Prisma + Postgres (Neon)** — web2 mode data
- **PostHog** — analytics
- **Vitest** — unit tests (`npx vitest run`)

## Running Locally

```bash
npm install
npm run dev
```

Requires `.env` with RPC URLs, Dynamic API keys, the ship minter private key and `DATABASE_URL`. See `.env.example` if present, or the CLAUDE.md in the root for variable names.
