# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Next.js + Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint (v9 flat config)
npx vitest run   # Unit tests (Vitest): app/**/__tests__, mostly pure utils and hooks
npx tsc --noEmit -p .  # Type check
```

## Architecture

**Void Tactics** is a turn-based tactical blockchain fleet combat game. The frontend is a Next.js 16 App Router app (React 19, TypeScript strict mode) that interacts with smart contracts across multiple EVM chains.

### Stack

- **Next.js 16** with Turbopack, App Router
- **wagmi 2 + viem 2** — Ethereum hooks and client
- **RainbowKit 2** — wallet connection UI
- **TanStack React Query 5** — server/chain state management
- **Tailwind CSS 4**
- **PostHog** — analytics (proxied via `/ingest/*` rewrites in `next.config.ts`)

### Multi-Chain Support

Four testnets are configured: **Base Sepolia** (84532, the default), **Flow Testnet** (747), **Ronin Saigon** (2020), **Xai Testnet v2** (37714555429). Only Base Sepolia is enabled right now (`SUPPORTED_CHAINS` in `app/config/networks.ts`); the others are commented out and their deployments are stale. Chain selection is persisted to `localStorage` and triggers a custom event that invalidates React Query state. Chain config lives in `app/config/networks.ts`; deployed contract addresses per chain are in `app/contracts/<chain-name>/deployed_addresses.json`.

### Contract ABIs

`app/contracts/` contains ~88 JSON ABI files plus per-chain `deployed_addresses.json`. `app/config/contracts.ts` imports ABIs as `const` with `as const` assertions and exports typed address maps keyed by chain id. When referencing ABIs in hooks, always extract them as module-level `const` — never inline inside components.

### Key Directories

| Path | What's there |
|---|---|
| `app/components/` | UI components. `GameDisplay.tsx`, `GameGrid.tsx`, and `SimulatedGameDisplay.tsx` are the main game views (each 150–210 KB). `Lobbies.tsx` and `ManageNavy.tsx` handle pre-game flows. |
| `app/hooks/` | 34 custom hooks. `useContractEvents.ts` manages a global refetch registry for real-time blockchain events. `useShipImageCache.ts` pre-loads/caches canvas-rendered ship images. `useOnboardingTutorial.ts` is a step-driven state machine for the onboarding flow. |
| `app/config/` | `networks.ts` (chain definitions + selection logic), `contracts.ts` (ABI imports + address maps), `alpha.ts` (feature flags). |
| `app/utils/` | 23 utility modules. `shipRenderer/` handles canvas-based ship image generation. `shipAttributesCalculator.ts` computes derived ship stats. `tutorialStepScripts.ts` scripts the tutorial's simulated moves; the tutorial's text lives in `app/data/dialog/tutorial.ts`. |
| `app/types/` | `types.ts` (Ship, ShipEquipment, ShipTraits, etc.), `onboarding.ts`. |
| `app/providers/` | `TransactionContext` — wraps wagmi write calls with loading/error UI state. |
| `app/providers.tsx` | The game client's providers: wagmi, QueryClient, Dynamic, next-auth, TransactionProvider. Mounted once by `app/(client)/layout.tsx`, the shared layout of the client routes (a route group: `/play`, `/admin`, a game, tournaments). The website (`/`, `/privacy`, etc.) has no wallet providers, so don't use wagmi/React Query hooks there; it also must not import `app/config/contracts.ts` (every contract artifact), only `app/config/contractAddresses.ts`. |
| `app/page.tsx` | The website (marketing): `components/Website.tsx` with the hero and feature sections from `components/InfoSections.tsx`. |
| `app/(client)/play/` | The game client. Signed out: a new visitor gets the Operations map with the First Contact tutorial as the first mission (`components/operations/SignedOutOperations`); a returning player, a deep link or `?signin=1` gets `BootScreen` (the sign-in screen). See `signedOutLanding` in `utils/tutorialCompletion.ts`. Google (web2) sign-in is hidden behind `WEB2_SIGN_IN_ENABLED` in `app/config/alpha.ts`. Signed in: the HUD (`Header.tsx`: resource pills, your-turn bell, settings menu), `GameNav` (Play · Fleet · Store · Battles · Profile; Q/E on desktop, bottom bar on phones) and the Command Deck hub (`components/commandDeck/`, layout A or B via `useCommandDeckLayout` / PostHog flag `command-deck-layout`). Art slots are configured in `app/config/art.ts`. Store (`StoreScreen`: Ship packs · Credits · Drone Cores · Lottery; ship packs pay at `CheckoutSheet`) and Fleet (`components/fleet/FleetHangar`: Ships · Loadouts · Progression) have sub-tabs; the HUD's + buttons open Store sub-tabs via the `void-tactics-navigate-to-store` event's `section` detail. The Operations run map (`RoguelikeGraph` / `RoguelikeGraphWeb2`) is laid out by `components/operations/` (`OperationsMap`: star chart + right-side mission drawer + `RunActionBar` with the primary action from `utils/runMapAction.ts` at the bottom right). Battles is an inbox (`BattlesInbox`: your turn · waiting · finished with replay) fed by `Games` / `GamesWeb2`. Settings › Audio toggles background music (`useGameMusic`) and sound effects (`useSoundEffects`: every effect plays through `playSoundEffect`). |
| `app/(client)/admin/` | Ops Console: Maps, Admin, Reward Ships, Ship Attributes, Purchase Prices — gated by `useOpsConsoleAccess`, linked from the header [MENU]. Reward Ships (`components/rewardShips/`) sets each roguelike combat node's reward ship (`ShipGrantWinEffect.setGrant`; web2: `RoguelikeShipGrant`), sharing `ShipSpecControls` with the ship constructors. |
| `proxy.ts` | Host routing. With `NEXT_PUBLIC_PLAY_URL` set, the play host serves the client at `/` and the site host redirects client paths there (`app/utils/hostRouting.ts`). |
| `app/(client)/[gameId]/` | Dynamic route for an active game session. |

### Data Flow

1. Wallet connects via RainbowKit → wagmi stores connection; selected chain stored in localStorage
2. `useContractEvents` registers wagmi `useWatchContractEvent` watchers for transfer and game events, calling registered refetch callbacks on events
3. Ship data fetched via `useOwnedShips` (reads contract) → images pre-loaded by `useShipImageCache`
4. Game state polled by `usePlayerGames`; client-side turn simulation handled by `useSimulatedGameState`
5. Transactions flow through `TransactionProvider` which surfaces pending/success/error toasts

## Content and RPC (2026-10-08 redeploy)

- **Map names and node titles/descriptions are not on chain.** Node text ships as `app/data/dialog/nodeContent.ts` (next to the mission dialog) and map names as `app/data/content/mapNames.ts` (see `app/config/content.ts`). Both are edited by hand and deployed; the web3 editors show them read-only. Web2 keeps its own content in Postgres.
- **Reward ships have an app copy.** Players' screens (mission drawer, result screen) read each node's reward ship from `app/data/content/rewardShips.json`, not `ShipGrantWinEffect`. Only the per-player `hasClaimed` check reads the chain. Ops Console › Reward Ships flags nodes whose chain grant differs; Admin › [EXPORT MISSION SEED FILES] saves the new copy (into `app/data/content/`) together with the contracts repo's seed files, which carry each node's `shipGrant` so a redeploy sets it (and `prisma/importMissionSeeds.ts` imports it for web2). Commit and deploy both repos. A copy from another `ShipGrantWinEffect` address (a redeploy) is ignored and reads fall back to the chain. Web2 reads Postgres.
- **Map and roguelike node ids don't follow seed order.** Content synced after a deploy is appended (live Base Sepolia: seed `map67` is map 68). The seed export and the web2 import (`prisma/importMissionSeeds.ts`) read each key's id from the contracts repo's deployment record (`ignition/deployments/chain-84532/journal.jsonl` + `content-sync.json`, see `app/utils/seedDeploymentIds.ts`). A chain map with no seed key (e.g. one built in the editor) exports as a new seed map with a warning to record its id in `content-sync.json`. **Never hide maps in the admin tools:** each map card lists its problems (`app/utils/mapProblems.ts`: duplicate terrain, no enemy fleet, unused PvE map) opposite the tile key.
- **Map tile art:** `app/data/content/mapTileArt.ts` swaps whole-tile rectangles on specific maps for one image (e.g. map 68's space dock), keyed by map id, plus node id -> map id for nodes on those maps (web3 battles know their node, not their map, so this saves a chain read). Each piece states the terrain under it (blocked / impassable); if a map edit changes those tiles the art isn't drawn and the map card lists it. Drawn by `GameGridCell`, `MapDisplayView` and the map editor's game view via `app/utils/mapTileArt.ts`.
- **Map backgrounds:** each game-style board (`GameGrid`, `MapDisplayView`) draws one of `public/img/grid-backgrounds/` under its cells (`MapBackground`), picked by hashing the map's tiles (`app/utils/mapBackground.ts`), so it's the same everywhere with no map id. Cells have no solid fill; don't add one back. Terrain art is at full opacity, nebula (blocked LOS) from `public/img/nebula/` and asteroids (impassable) above it from `public/img/asteroids/`: `full.png` on the terrain's tiles, overlaid edge/corner pieces on the tiles around them (`app/utils/terrainEdges.ts`).
- **Shiny art:** the local renderer (`app/utils/shipRenderer/`) must match the contracts' `RenderUtils.sol` byte for byte. When on-chain art changes for existing ships, bump `SHIP_ART_VERSION` in `useShipImageCache.ts` so cached images are dropped.
- **Base Sepolia RPC** comes from `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL` (falls back to the public endpoint). Never hardcode keys.
- **Contract events:** watch with `useCombinedEventWatch` (one log poll for many events/contracts, handler via ref), gated on `usePageVisible()`. Don't add per-event `useWatchContractEvent` watchers. Event ABIs come from the deployed artifacts (`eventAbi`), not hand-copied.
- **Aggregate reads:** prefer `GameLens` views (`app/hooks/useGameLens.ts`) over chains of dependent reads. Admin-edited data uses `ADMIN_DATA_STALE_MS`.
- `window.__vtRpcUsage` (and the dev console's `[rpc]` summary) shows requests by method.

## Navigation state lives in the URL

Screens in `/play` and `/admin` keep their state in the URL (`app/utils/urlState.ts`): the tab is the path segment (`/play/operations`, `/admin/maps`; `/operations` on the play host; slugs in `app/config/clientTabs.ts`, pages in `app/(client)/play/[tab]` and `app/(client)/admin/[tab]`) and goes through the same `tab` key as the query params; old `?tab=` links redirect in `hostRouting.ts`. Plus each screen's query params (`section`, `game`/`replay`, `lobby`/`create`/`fleet`, `tournament`, `ship`, `node`, `/admin`'s `map`). Opening a screen pushes a history entry, so a refresh reopens it and Back/Forward work. Automatic changes (closing something that no longer exists, map selection) use `{ replace: true }`. In-app back/close buttons use `{ back: true }` (history.back() when the previous entry is the screen they return to, else replace), so they match the browser's Back. New navigable UI (a detail view, an editor, a sub-tab) goes in the URL the same way, never in React state or localStorage alone. Open games with `navigateToGame` / tabs with `openClientTab`.

## Critical: RPC Call Memoization

Excessive RPC calls will spam the node provider and cause rate limiting. Every wagmi hook config and every callback passed to wagmi hooks **must** be memoized:

```typescript
// ABIs at module level — never inline
const SHIP_ABI = ShipsABI as const;

// Config objects via useMemo
const watchConfig = useMemo(() => ({
  address: contractAddress,
  abi: SHIP_ABI,
  eventName: 'Transfer',
  chainId,
}), [contractAddress, chainId]);

// Handlers via useCallback
const handleTransfer = useCallback((logs) => {
  refetch();
}, [refetch]);

useWatchContractEvent({ ...watchConfig, onLogs: handleTransfer });
```

Only true dependencies belong in dependency arrays — don't include stable references like `refetch` from React Query unless they actually change. After any change to hooks, verify in DevTools Network that the number of RPC calls is not growing unboundedly on re-renders or user interactions.

## Path Aliases

`@/*` maps to the repo root (e.g., `@/app/config/contracts` resolves to `./app/config/contracts`).

## Game Display Parity Rule

`SimulatedGameDisplay.tsx` (tutorial game view) and `GameDisplay.tsx` (live game view) must always look and feel identical. Any visual or layout change to one must be applied to the other.

The only permitted differences are elements that exist solely in `SimulatedGameDisplay` to support the tutorial: overlay panels, task lists, step-driven highlights, and simulated action feedback. Everything else — colors, spacing, typography, component structure — must stay in sync.

## No Backend Services in Place of Contract Functions

Never build a backend service (API route, cron job, keeper) to work around something a smart contract function could do directly. If a flow needs new server-side logic, the default assumption is that the logic belongs on-chain, not in `app/api/`.

The only acceptable reason for a backend service to exist is to call a smart contract function on behalf of an authorized/privileged user — i.e. a call that requires a specific credential the player's own wallet doesn't have (e.g. `app/api/flow/fulfill/route.ts`'s `SHIP_MINTER_PRIVATE_KEY` calling the access-controlled `createShips` after verifying a Fireblocks Flow payment off-chain). If a contract function has no access control and any wallet can call it, the player's own wallet should call it — don't stand up a service wallet/keeper to do it "for smoother UX." Extra player-signed transactions are the correct tradeoff over new backend infrastructure.
