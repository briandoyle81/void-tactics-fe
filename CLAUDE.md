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

**Void Tactics** is a turn-based tactical blockchain fleet combat game. The frontend is a Next.js 16 App Router app (React 19, TypeScript strict mode) that interacts with the Void Tactics contracts on native NEAR (this branch, `near-migration-experiment`; master is still EVM).

### Stack

- **Next.js 16** with Turbopack, App Router
- **near-api-js 7** — RPC, transactions and signing, used only inside `app/near/` and `app/api/` (lint enforces it; wagmi, viem and `@dynamic-labs/ethereum` are banned, except viem in the card checkout's `useFlowPaymentModal`)
- **Dynamic** (`@dynamic-labs/solana`) — sign-in; the Solana embedded wallet's Ed25519 key is the player's NEAR account
- **TanStack React Query 5** — server/chain state management
- **Tailwind CSS 4**
- **PostHog** — analytics (proxied via `/ingest/*` rewrites in `next.config.ts`)

### NEAR

One game contract (`game.void-tactics.testnet`: ships as NEP-171, `utc`/`dec`/`hive_medal` as NEP-245, a NEP-145 storage ledger, NEP-297 events) plus a view-only renderer (`art.void-tactics.testnet`). The contracts live in `~/void-tactics-contracts-eth-online-2026/near/`; the handoffs are `docs/near-frontend-handoff-2026-11-13.md` and `-11-14.md` (testnet was redeployed fresh on 2026-11-14, so earlier test accounts, ships and games are gone).

- **Env:** `NEXT_PUBLIC_NEAR_NETWORK` (testnet), `NEXT_PUBLIC_NEAR_RPC_URLS` (comma-separated) or `NEXT_PUBLIC_NEAR_RPC_URL` (default: the free public FastNEAR, dRPC and rpc.testnet.near.org endpoints, rotated with failover in `app/near/rpc.ts`), `NEXT_PUBLIC_NEAR_GAME_CONTRACT`, `NEXT_PUBLIC_NEAR_RENDERER_CONTRACT`, `NEXT_PUBLIC_NEAR_DYNAMIC_ENVIRONMENT_ID` (a Dynamic project with Solana embedded wallets on), `NEXT_PUBLIC_NEAR_ROGUELIKE_CAMPAIGN_ID`. Server: `NEAR_FAUCET_ACCOUNT_ID`/`NEAR_FAUCET_PRIVATE_KEY`/`NEAR_FAUCET_AMOUNT`, `NEAR_VERIFIER_ACCOUNT_ID`/`NEAR_VERIFIER_PRIVATE_KEY`, and for card checkout `NEAR_MINTER_ACCOUNT_ID`/`NEAR_MINTER_PRIVATE_KEY` (MINTER role) plus `NEXT_PUBLIC_FLOW_CHECKOUT_ID` and `NEXT_PUBLIC_CARD_CHECKOUT_ENABLED=1`. Never hardcode keys. All config is in `app/near/config.ts`.
- **ABI and types:** `app/near/abi/*.json` are copied from the contracts repo (`cargo near abi`); `npx tsx near-scripts/gen-near-types.ts` regenerates `app/near/generated/` (typed `Views`/`Calls`). `NearCallSpec` checks each call's args against `Calls`, so a string where the contract wants a number is a type error. Regenerate on every handoff and let `tsc` show what broke.
- **Settings:** rules, economy and lobby settings come from one read each, `useGameSettings` / `useLobbyConfig` (`app/near/useGameSettings.ts`, get_settings / get_lobby_config); the player's account from `usePlayerSummary`. Admin writes (`set_*`, `update_*`) invalidate them.
- **Encoding:** u64 inside structs is a JSON number, U64/U128 args and returns are strings; `viewRaw` keeps unsafe integers as strings (`parseJsonKeepingBigInts`). Adapters in `app/near/adapters/` turn NEAR JSON into the app's types (bigint ids, `Address` = account id string, `""` for none). Map bitmaps are 3 u64 words, bit = row * 17 + col. AI ships are ids `2^40 + k + 1`, reused across matches; the AI "player" is the game contract (`AI_PLAYER`).
- **Roles:** `get_roles` bitmask (`ROLE` in config; the owner passes every check), read by `useRoles`; the Ops Console and editors gate on it.

### Contract ABIs

Never inline args objects or method lists in components: build call specs and view args with `useMemo`, and add views to `app/near/` hooks or adapters rather than calling `viewGame` from components.

### Key Directories

| Path | What's there |
|---|---|
| `app/components/` | UI components. `GameDisplay.tsx`, `GameGrid.tsx`, and `SimulatedGameDisplay.tsx` are the main game views (each 150–210 KB). `Lobbies.tsx` and `ManageNavy.tsx` handle pre-game flows. |
| `app/near/` | The chain layer: `rpc.ts` (views, counted in `__vtRpcUsage`), `codec.ts` (events, receipts, amounts), `errors.ts`, `identity.ts`, `session.tsx` (`NearSessionProvider`, the `send` write funnel), `useNearView`/`useNearViews`, `useNearCall`, `useChainAccount` (wagmi `useAccount` shape), balances, roles, `sync/` and `onboarding/`. |
| `app/hooks/` | Custom hooks; the contract hooks keep their old names and shapes and read/write through `app/near/`. `useOnboardingTutorial.ts` is a step-driven state machine for the onboarding flow. |
| `app/config/` | `alpha.ts` (feature flags), `art.ts`, `clientTabs.ts`, `faucets.ts` (the NEAR faucet link). |
| `app/utils/` | 23 utility modules. `shipRenderer/` handles canvas-based ship image generation. `shipAttributesCalculator.ts` computes derived ship stats. `tutorialStepScripts.ts` scripts the tutorial's simulated moves; the tutorial's text lives in `app/data/dialog/tutorial.ts`. |
| `app/types/` | `types.ts` (Ship, ShipEquipment, ShipTraits, etc.), `onboarding.ts`. |
| `app/providers/` | `TransactionContext` — loading/error UI state around writes (`TransactionButton` takes a `call: NearCallSpec`). |
| `app/providers.tsx` | The game client's providers: next-auth, Dynamic (Solana connectors, the NEAR environment), QueryClient, `NearSessionProvider`, `NearSyncHost`, TransactionProvider with `NearOnboardingHost`. Mounted once by `app/(client)/layout.tsx`, the shared layout of the client routes (a route group: `/play`, `/admin`, a game, tournaments). The website (`/`, `/privacy`, etc.) has no wallet providers, so don't use `app/near` hooks or React Query hooks there; it must not import the NEAR ABI JSON. |
| `app/page.tsx` | The website (marketing): `components/Website.tsx` with the hero and feature sections from `components/InfoSections.tsx`. |
| `app/(client)/play/` | The game client. Signed out: a new visitor gets the Operations map with the First Contact tutorial as the first mission (`components/operations/SignedOutOperations`); a returning player, a deep link or `?signin=1` gets `BootScreen` (the sign-in screen). Tournaments, the UTC lottery and the Uniswap sell swap are not on NEAR and are removed in web3 mode (web2 tournaments stay). Sign-in is our own UI over Dynamic (`components/signIn/SignInPanel`): the embedded wallet by email code or Google first; a browser wallet behind a notice (approve every move). Every other sign-in button (HUD, tutorial reward claim) opens the same panel as a modal (`SignInModal`, via `openSignIn()` / `useOpenWalletSignIn`); only the panel's "More wallets" opens Dynamic's own modal. See `signedOutLanding` in `utils/tutorialCompletion.ts`. Google (web2) sign-in is hidden behind `WEB2_SIGN_IN_ENABLED` in `app/config/alpha.ts`. Signed in: the HUD (`Header.tsx`: resource pills, your-turn bell, settings menu), `GameNav` (Play · Fleet · Store · Battles · Profile; Q/E on desktop, bottom bar on phones) and the Command Deck hub (`components/commandDeck/`, layout A or B via `useCommandDeckLayout` / PostHog flag `command-deck-layout`). Art slots are configured in `app/config/art.ts`. Store (`StoreScreen`: Ship packs · Credits · Drone Cores; ship packs pay at `CheckoutSheet`) and Fleet (`components/fleet/FleetHangar`: Ships · Loadouts · Progression) have sub-tabs; the HUD's + buttons open Store sub-tabs via the `void-tactics-navigate-to-store` event's `section` detail. The Operations run map (`RoguelikeGraph` / `RoguelikeGraphWeb2`) is laid out by `components/operations/` (`OperationsMap`: star chart + right-side mission drawer + `RunActionBar` with the primary action from `utils/runMapAction.ts` at the bottom right). In play the star chart is a charted route (`utils/routeChart.ts`): only cleared missions, where the run is and what's next are drawn (a branch not taken shows as skipped, the rest is hidden behind a fading trail), laid out along a winding route sized for ~15 steps; Edit Mode keeps the full depth-column chart. The run map also preloads the maps of the current and next missions (`utils/missionMaps.ts`; web3 `usePresetMapState`, web2 `usePrefetchMapsWeb2`), and a web3 battle draws its mission's preset map until `getGameMapState` arrives; while no map is in, the battle shows `MapLoadingOverlay` (dimmed, Loading…, controls locked). Any UI drawn over the board (a modal, the round report, that overlay) makes it inert until it's gone (`useBoardCovered` in `GameGrid`: hit-tests points over the board; click-through layers, tooltips and a corner toast don't count), and Escape is left to the overlay. Battles is an inbox (`BattlesInbox`: your turn · waiting · finished with replay) fed by `Games` / `GamesWeb2`. Settings › Audio toggles background music (`useGameMusic`) and sound effects (`useSoundEffects`: every effect plays through `playSoundEffect`). Settings › Combat (and the battle Menu) also has the Hold fire warning (`useHoldFireWarning`): submitting a move that holds fire while a target is in range of where the ship ends asks first (`HoldFireConfirm`, via `TransactionButton`'s `confirmBeforeSend` in web3), with "Don't ask again". |
| `app/(client)/admin/` | Ops Console: Maps, Admin, Reward Ships, Ship Attributes, Purchase Prices, AI Fleet (`components/aiFleet/`: every AI ship config as a card, built in the shared `ShipSpecControls` plus name, archetype, shiny and kill count (rank, capped at `AIEncounters.MAX_AI_KILLS`; every ship minted from the config starts with them, so AI ships can be shiny and ranked); a working copy saved/loaded as JSON (`utils/aiFleet.ts`) and written with createAIShipConfig/updateAIShipConfig, web2 the admin API; configs can't be deleted, the X only leaves one out), Ship Constructor (`ShipConstructor` opened in EXPLORE, for anyone with another tab; also on each ship in Fleet) — gated by `useOpsConsoleAccess`, linked from the header [MENU]. Reward Ships (`components/rewardShips/`) sets each roguelike combat node's reward ship (the node's `ship_grant` win effect via `set_rl_campaign`; web2: `RoguelikeShipGrant`), sharing `ShipSpecControls` with the ship constructors. |
| `proxy.ts` | Host routing. With `NEXT_PUBLIC_PLAY_URL` set, the play host serves the client at `/` and the site host redirects client paths there (`app/utils/hostRouting.ts`). |
| `app/(client)/[gameId]/` | Dynamic route for an active game session. |

### Data Flow

1. Sign-in through Dynamic gives a Solana embedded wallet; its public key's hex is the player's NEAR implicit account (`app/near/identity.ts`).
2. `NearOnboardingHost` activates a new account once: `/api/faucet/near` funds it (creating it), then two Dynamic-signed transactions add a browser function-call session key (allowance `SESSION_KEY_ALLOWANCE`, stored in localStorage per network/account/contract) and make the `storage_deposit`. Later storage top-ups go through `openStorageTopUp()`.
3. Every write goes through `useNearSession().send(spec)` (via `useNearCall` or `TransactionButton`'s `call`): zero-deposit calls to the game contract sign with the session key, no prompt; a call with a deposit (including 1 yocto), or with no usable session key, signs through Dynamic (`DynamicNearSigner`: sha256 of the borsh transaction, signature verified before use). Gas is a fixed budget (`GAS_DEFAULT` / `GAS_HEAVY`); NEAR refunds what's unused. A settled transaction returns a `NearReceipt` (events from every receipt, return value) and fires `NEAR_TX_SETTLED_EVENT`.
4. There are no event logs to watch. `NearSyncHost` polls two change counters (gated on page visibility and focus): each open game's `get_game_version` (every 4 s; the board refetches only when it moved) and the player's `get_player_nonce` (every 8 s; ships, games, lobbies, run and balances refetch only when it moved, including when another player's call changed them). The open lobby list (other players' lobbies) refetches slowly, and the player's own transactions invalidate what their events changed. The board refetch also writes the game's map (`useGetGameMapState`), so live map edits show. AI moves are rebuilt from the `ai_turns` event plus the board before and after (`aiMovesFromTurns` in `utils/gameMoveLogs.ts`).
5. Ships auto-construct (self-callback randomness): `useOwnedShips` polls every 2 s while any owned ship is unconstructed; `ConstructShipsButton` offers `construct_ships` after a grace period. A ship priced under an older cost table can't join a fleet until `sync_ship_costs` re-prices it (Fleet's "Update ship version" buttons).
6. Transactions surface pending/success/error toasts through `TransactionProvider`.

## Content and RPC (2026-10-08 redeploy)

- **Map names and node titles/descriptions are not on chain.** Node text ships as `app/data/dialog/nodeContent.ts` (next to the mission dialog) and map names as `app/data/content/mapNames.ts` (see `app/config/content.ts`). Both are edited by hand and deployed; the web3 editors show them read-only. Web2 keeps its own content in Postgres.
- **Reward ships have an app copy.** Players' screens (mission drawer, result screen) read each node's reward ship from `app/data/content/rewardShips.json`, not the chain's `ship_grant` win effect. Only the per-player claimed check (`is_rl_grant_claimed`) reads the chain. Ops Console › Reward Ships flags nodes whose chain grant differs; Admin › [EXPORT MISSION SEED FILES] saves the new copy (into `app/data/content/`) together with the contracts repo's seed files, which carry each node's `shipGrant` so a redeploy sets it (and `prisma/importMissionSeeds.ts` imports it for web2). Commit and deploy both repos. A copy made for another game contract (a redeploy) is ignored and reads fall back to the chain. Web2 reads Postgres.
- **Map and roguelike node ids come from the deployment record.** The seed export and the web2 import (`prisma/importMissionSeeds.ts`) read each seed key's id from the contracts repo's `near/deployments/testnet.json` (written by its deploy tool after reading every id back; rerun it with `--record-only` after a deploy or sync), see `app/utils/seedDeploymentIds.ts`. This repo keeps a copy at `app/near/deployments/testnet.json` (used when the export can't read the repo's); copy it over after every redeploy. A chain map with no seed key (e.g. one built in the editor) exports as a new seed map with a warning to record its id. **Never hide maps in the admin tools:** each map card lists its problems (`app/utils/mapProblems.ts`: duplicate terrain, no enemy fleet, unused PvE map) opposite the tile key.
- **Map tile art:** `app/data/content/mapTileArt.ts` swaps whole-tile rectangles on specific maps for one image (e.g. map 61's space dock), keyed by map id, plus node id -> map id for nodes on those maps (web3 battles know their node, not their map, so this saves a chain read). Each piece states the terrain under it (blocked / impassable); if a map edit changes those tiles the art isn't drawn and the map card lists it. Drawn by `GameGridCell`, `MapDisplayView` and the map editor's game view via `app/utils/mapTileArt.ts`.
- **Map backgrounds:** each game-style board (`GameGrid`, `MapDisplayView`) draws one of `public/img/grid-backgrounds/` under its cells (`MapBackground`), picked by hashing the map's tiles (`app/utils/mapBackground.ts`), so it's the same everywhere with no map id. Cells have no solid fill; don't add one back. Terrain art is at full opacity, nebula (blocked LOS) from `public/img/nebula/` and asteroids (impassable) above it from `public/img/asteroids/`: `full.png` on the terrain's tiles, overlaid edge/corner pieces on the tiles around them (`app/utils/terrainEdges.ts`).
- **Shiny art:** the local renderer (`app/utils/shipRenderer/`) must match the contracts' `RenderUtils.sol` byte for byte. On NEAR the onchain art is the renderer contract's `token_uri`.
- **NEAR RPC** comes from `NEXT_PUBLIC_NEAR_RPC_URLS` / `NEXT_PUBLIC_NEAR_RPC_URL` (falls back to the free public endpoints). Views rotate across them, at most 6 in flight, and a 429/5xx/dropped request moves to the next endpoint; sends use near-api-js's `FailoverRpcProvider`. Never hardcode keys.
- **Freshness:** no event watchers; add new refresh needs to `NearSyncHost` (one poll per family, gated on visibility) or invalidate from the player's `NearReceipt`, never a per-component interval.
- **Aggregate reads:** prefer the run/campaign views behind `app/hooks/useGameLens.ts` and the batched `useNearViews` over chains of dependent reads. Admin-edited data uses `ADMIN_DATA_STALE_MS`.
- **Game-rule reads** a battle aims with (special range/strength at a pinned version, Ram/Repair resolver range/strength) go through `useGameRuleRead` (`app/hooks/useGameRuleRead.ts`): read once, saved in localStorage across sessions, and dropped and read again by `refreshGameRuleReads` when a move transaction fails (not on a wallet decline). The tutorial reads the fixed tables in `specialConfigWeb2.ts` instead.
- `window.__vtRpcUsage` (and the dev console's `[rpc]` summary) shows requests by method.
- **Moves play back on the board; there is no last-move UI** (`docs/last-move-ui.md` records the old one). Every move (yours from SUBMIT, each enemy move from the AI turn's `ai_turns` event or the game's `last_move`, and each replay step) goes through `useMovePlayback` / `useLiveMovePlayback` / `useReplayPlayback` (`app/hooks/useMovePlayback.ts`): the ship slides along `findMovePath` (`app/utils/movePath.ts`, around asteroids and enemy ships), its weapon fires once (`MovePlaybackLayer`, lengths in `app/utils/weaponPlayback.ts`), and the board is held at its pre-move state (`useHeldBoard`) until the queue drains. Aiming previews are silent; a move's sounds play once during playback. The "your turn" sound (`useTurnChangeAlertSound`, also in the tutorial) goes by the chain/server turn once nothing is playing back and no move is pending, so it plays at the start of each of the player's turns, never while their own move plays back. Settings › Combat › Combat view (`useCombatView`, also in the landscape battle Menu) picks how an attack on an enemy ship (or a repair on another friendly ship) plays: Cinematic (default) plays it in two overlapping comic panels over the board (`weapon-animations/CombatCinematic.tsx`: the attacker's panel top left when the creator attacks, top right when the joiner does; the same weapon components run in both panels, and only the attacker's panel plays sound), with the board's weapon left unmounted for that move; On-board plays it on the board. The website hero demo plays the cinematic on md and up, on the board on phones (`CombatViewOverride`), drawn over its visible crop window (`CinematicHostContext`).

## Navigation state lives in the URL

Screens in `/play` and `/admin` keep their state in the URL (`app/utils/urlState.ts`): the tab is the path segment (`/play/operations`, `/admin/maps`; `/operations` on the play host; slugs in `app/config/clientTabs.ts`, pages in `app/(client)/play/[tab]` and `app/(client)/admin/[tab]`) and goes through the same `tab` key as the query params; old `?tab=` links redirect in `hostRouting.ts`. Plus each screen's query params (`section`, `game`/`replay`, `lobby`/`create`/`fleet`, `tournament`, `ship`, `node`, `/admin`'s `map`). Opening a screen pushes a history entry, so a refresh reopens it and Back/Forward work. Automatic changes (closing something that no longer exists, map selection) use `{ replace: true }`. In-app back/close buttons use `{ back: true }` (history.back() when the previous entry is the screen they return to, else replace), so they match the browser's Back. New navigable UI (a detail view, an editor, a sub-tab) goes in the URL the same way, never in React state or localStorage alone. Open games with `navigateToGame` / tabs with `openClientTab`.

## Critical: RPC Call Memoization

Excessive RPC calls will spam the node provider and cause rate limiting. Every view's args and every call spec **must** be memoized, and views go through `useNearView`/`useNearViews` (React Query keys from `nearViewKey`, args by `stableKey`):

```typescript
// Args via useMemo, so the query key and the request stay stable
const args = useMemo(() => ({ account_id: address }), [address]);
const { data } = useNearView("get_player_stats", args, { enabled: !!address });

// Call specs via useMemo; handlers via useCallback
const call = useMemo<NearCallSpec | null>(
  () => (lobbyId ? { method: "leave_lobby", args: { lobby_id: lobbyId.toString() } } : null),
  [lobbyId],
);
const handleReceipt = useCallback((r: NearReceipt) => refetch(), [refetch]);
```

Only true dependencies belong in dependency arrays — don't include stable references like `refetch` from React Query unless they actually change. After any change to hooks, verify in DevTools Network that the number of RPC calls is not growing unboundedly on re-renders or user interactions.

## Path Aliases

`@/*` maps to the repo root (e.g., `@/app/config/contracts` resolves to `./app/config/contracts`).

## Game Display Parity Rule

`SimulatedGameDisplay.tsx` (tutorial game view) and `GameDisplay.tsx` (live game view) must always look and feel identical. Any visual or layout change to one must be applied to the other.

The only permitted differences are elements that exist solely in `SimulatedGameDisplay` to support the tutorial: overlay panels, task lists, step-driven highlights, and simulated action feedback. Everything else — colors, spacing, typography, component structure — must stay in sync.

## No Backend Services in Place of Contract Functions

Never build a backend service (API route, cron job, keeper) to work around something a smart contract function could do directly. If a flow needs new server-side logic, the default assumption is that the logic belongs onchain, not in `app/api/`.

The only acceptable reason for a backend service to exist is to call a smart contract function on behalf of an authorized/privileged user — i.e. a call that requires a specific credential the player's own wallet doesn't have (e.g. `app/api/selfie-check/verify/route.ts` calling the Verifier-role `mark_verified`, `app/api/flow/fulfill/route.ts` calling the Minter-role `create_ships_for` after verifying a card payment, or the NEAR faucet funding a new account). `storage_deposit` is permissionless, so the player signs it. If a contract function has no access control and any wallet can call it, the player's own wallet should call it — don't stand up a service wallet/keeper to do it "for smoother UX." Extra player-signed transactions are the correct tradeoff over new backend infrastructure.
