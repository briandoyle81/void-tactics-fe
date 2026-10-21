# Reward ships and AI placement zones: status (2026-10-19)

This doc is for picking this work back up. It covers what was built from `docs/frontend-handoff-2026-10-19.md`, how the pieces fit, and what's still open. Nothing here is committed. The Neon migration has been run.

## What the handoff asked for, and where it is

| Handoff item | Status |
|---|---|
| §1 AI placements follow the map's joiner zone | Done, web3 and web2 |
| §1 Remove `JOINER_COL_MIN` / `JOINER_COL_MAX` | Nothing used them |
| §1 Re-save the AI fleet after editing a joiner zone | The editors remind you; doing the re-save is an ops task |
| §2 Admin form for `setGrant`, showing `hasGrant` / `getGrant` | Done: Ops Console › Reward Ships |
| §2 Player UI shows the node's reward and `hasClaimed` | Done: mission drawer |
| §2 Win screen shows the granted ship, no construct step | Done |
| §2 Remove `shipVariant` / `shipTier` / `setShipConfig` | Done, plus web2's global variant/tier setting |
| §3 Drop the construct prompt for reward ships | Done: `ConstructRewardShips` deleted. Lottery prizes are still built from the Fleet screen |

## How it works

### The shared model
- `app/utils/shipGrant.ts` holds `ShipGrantSpec`, the shared number-native reward ship. It also has:
  - `shipGrantError`, which mirrors the contract's checks: traits 0–2, variant 1 to `maxVariant`, and no armor and shields together
  - `parseShipGrant`, for untrusted JSON
  - `shipGrantToVisual`
- `app/utils/previewShips.ts` turns a grant into each mode's `Ship` (`shipGrantToPreviewShip` / `shipGrantToPreviewShipWeb2`). It shares one core with the ship-pack previews.
- `components/ship/ShipSpecControls.tsx` has the equipment, traits, colors and ship data sections. `ShipConstructor`, `ShipConstructorWeb2` and the reward ship form all use it.

### Web3
- **`app/hooks/useShipGrants.ts`:**
  - `useShipGrants`: `hasGrant` + `getGrant` in one multicall
  - `useNodeGrant` / `useNodeRewardShip`: what players see (see the app copy below)
  - `useRewardClaimedBeforeWin`
  - `useIsShipGrantOwner`, `useShipsMaxVariant`
  - `useShipGrantAdmin`: `setGrant` / `clearGrant` / `resetClaim`
- **Only the owner can write.** On Base Sepolia that's `MAP_ADMIN_ADDRESS`. Node editors can view the tab.

### The app copy (web3 only)
- `app/data/content/rewardShips.json` is a checked-in snapshot of every node's grant, tagged with the `ShipGrantWinEffect` address it came from. It's loaded in `app/config/rewardShips.ts`, and its logic lives in `app/utils/rewardShipSnapshot.ts`.
- The mission drawer and the win screen read the snapshot, so they make no `getGrant` reads and do no log search. The only chain read left is the per-player `hasClaimed` for once-only ships.
- If the address doesn't match (a redeploy), the copy is ignored and reads fall back to the chain.
- **Keeping it current:** the Reward Ships tab's App copy panel (`RewardShipSnapshotPanel`) marks nodes that differ from the chain and links to the Admin tab. The file is saved there, by **[EXPORT MISSION SEED FILES]** (`AdminSettingsExport`), with the seed files (see below). Since 2026-10-20 that panel opens the contracts repo's `ignition/` folder, not `ignition/data/` (see `docs/frontend-updates-2026-10-20.md`). **[OPEN APP CONTENT FOLDER]** refuses any folder not named `content` that doesn't already hold the file; browsers that can't write folders download it with the seed files. Commit and deploy afterwards.
- It currently holds no grants, which matches the chain: no node has a reward ship yet.

### Seeding a redeploy (added 2026-10-20)
- Each roguelike node in `roguelikeStarterContent.json` can carry `shipGrant` (a `ShipGrantSpec`). `buildMissionSeedFiles` writes it from the chain (`useMissionChainSnapshot` reads `useShipGrants`) and warns when a node runs Grant Ship without a ship, or has a ship without Grant Ship.
- The contracts deploy (`void-tactics-contracts-eth-online-2026` `ignition/modules/DeployAndConfig.ts`, "Roguelike reward ships") calls `setGrant` for each one after `setMaxVariant`, before ownership moves to `MAP_EDITOR`. Checked by encoding a grant through the ABI; not deployed yet.
- Web2: `buildMissionImportRows` returns `roguelikeShipGrants` (validated with `shipGrantError`), and `prisma/importMissionSeeds.ts` writes them. The import also clears `RoguelikeShipGrantAward` with the rest of the progress, the way a redeploy resets `hasClaimed`; minted ships stay.
- After a redeploy the app copy names the old contract, so players read the chain until it's saved again from the export.

### Web2
- **Tables:**
  - `RoguelikeShipGrant`: one row per node, holding the grant JSON
  - `RoguelikeShipGrantAward`: one row per minted ship. `countsAsClaim` is set for once-only grants, and a claim reset clears it.
  - Migration: `20261019120000_add_roguelike_ship_grants`, already applied to Neon.
- **`app/lib/shipGrantsWeb2.ts`:** reads, validation, set/clear/reset, and `grantRewardShip`, which mints the ship constructed. The once-only check is inside the mint's transaction.
- **Routes:**
  - `GET /api/roguelike/ship-grants?nodeIds=`: public; includes `claimedNodeIds` when signed in
  - `GET /api/roguelike/ship-grants/award?lobbyId=`: the win screen's lookup
  - `/api/admin/roguelike/ship-grants`: GET, PUT and DELETE
  - `/api/admin/roguelike/ship-grants/reset-claim`: takes an email or a user id
- **On a win:** `applyWinEffects(effects, winnerId, { nodeId, lobbyId })` mints the ship. A failed grant is logged and the win still counts, like `WinEffectFailed` on chain.
- **No double resolution:** `resolveRoguelikeRunIfApplicable` first claims the game by clearing `run.activeLobbyId` only where it still points at this lobby. Concurrent finish requests therefore can't heal, pay DEC or mint twice.
- Web2 has no app copy. Like node text, it reads Postgres.

### Shared UI (`components/rewardShips/`, web3 and web2 adapters)
- **The tab:** `RewardShipsAdminView` has the node list and the editor, with the selected node in the URL as `?node=`. It's wrapped by `RewardShipsAdmin` (web3) and `RewardShipsAdminWeb2`. You can add the Grant Ship effect to a node from here.
- **The form:** `ShipGrantForm` has a live preview and R1–R6 quick picks that set kills from the live rank thresholds.
- **Node editor:** `NodeRewardShipSummary` shows the reward with an [EDIT] link. `rewardShipsAdminHref` lives in `config/routes.ts`.
- **Mission drawer:** `MissionDrawerContent` has a `rewardShip` section. It shows only when the node runs Grant Ship.
- **Win screen:**
  - Web3 (`RewardShipReceived`) shows the snapshot grant when the node runs Grant Ship. For a once-only ship it also needs `hasClaimed` to have been false while the battle was live.
  - Web2 (`RewardShipReceivedWeb2`) asks the award route only when the node has a grant, and stops after 5 tries.

### AI placement zones (§1)
- `MapPlacementsEditorCore` takes `joinerZone`. It counts placements outside the zone, shows a warning and blocks Save until they're moved or removed.
- Web3 reads `getJoinerZonePositions`; web2 uses `useMapWeb2`.
- Web2's `/api/admin/ai-map-placements` rejects tiles outside the zone (`getMapZone` + `isDeploymentTile`).
- Both map editors show `JOINER_ZONE_CHANGED_NOTE` when a save changes the joiner zone. Web2 also clears its cached map then.

## Known limits (by design)
- **Out-of-date app copy:** players see the old ship until a new copy is saved and deployed. The tab flags the nodes that differ.
- **Refresh after a win:** a once-only reward doesn't appear on a finished game opened after a refresh, because the "claimed before" read only runs while the battle is live.
- **Failed mint on web3:** if the mint fails (`WinEffectFailed`, for example while Ships is paused), the web3 win screen still shows the ship. Catching that would need the log search the app copy replaced.
- **Win effects are still read live:** the drawer and win screen read `getNodeWinEffects` from the chain each time; only the grants are snapshotted.

## Not tested in a browser
- The Reward Ships tab, the drawer section and the win screens need a signed-in wallet or a web2 admin.
- Localhost wallet sign-in is blocked until `http://localhost:3000` is added to the Dynamic environment's allowed origins (Developers › Security).
- What is covered:
  - unit tests: `shipGrant.test.ts`, `rewardShipSnapshot.test.ts`, and a render test of the admin view (`components/rewardShips/__tests__`)
  - type check and lint
  - live read-only checks against Base Sepolia, which confirmed the contract, owner, `maxVariant` 2 and that no grants exist
- `ShipConstructor` and `ShipConstructorWeb2` now use `ShipSpecControls`, but neither has been clicked through since.

## Possible next steps
- Check the Reward Ships tab end to end once localhost sign-in works: set a grant, save the app copy, win the node, and see the ship on the result screen and in the Fleet.
- Re-save the enemy fleet for any map whose joiner zone was edited after its fleet was placed (the editor shows a warning on those).
- Merge the node editor's win-effect checkboxes: web3 renders them inline in `RoguelikeNodeEditPanel`, web2 uses `WinEffectsPickerWeb2`.

## Constraints
- **Git:** read-only. The user commits.
- **Dev server:** don't start, stop or restart it.
- **Data:** live Neon writes need the user's yes. Never use a live database URL as a Prisma shadow database, because it gets wiped.
- **Content:** nodes and their content are the user's; web3 is the source of truth.
