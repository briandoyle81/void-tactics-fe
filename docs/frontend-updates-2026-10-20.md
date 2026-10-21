# Frontend updates for the 2026-10-20 handoff

This covers what was done for `docs/frontend-handoff-2026-10-20.md`, web3 first, then web2 parity. Nothing here is committed. The web2 import hasn't been run against Neon yet.

## Checklist

| Handoff item | Status |
|---|---|
| §1 Treat the 10-19 changes as live | Nothing to change: the frontend already reads the live `AIEncounters` and `ShipGrantWinEffect` |
| §2 Hide map 67 | Not done, by decision: maps are never hidden in the admin tools. Map 67 is being built in the Maps editor. Map cards list problems instead (below) |
| §2 Map 68 is DS7; don't use seed order for ids | Done: the seed export and the web2 import read ids from the deployment record |
| §2 `d01` / `r01` titles and the new map's name | `nodeContent.ts` has 16 and 31, and `mapNames.ts` has 67 and 68 ("New Scapa Shipyard" is 68's name) |
| §2 Don't assume the mission → enemy-variant rule | Nothing to change: web3 and web2 both key DEC kill rewards on the destroyed ship's own variant, and nothing derives difficulty from mission order |
| §3 New `RenderMetadata` / `ImageRenderer` addresses | Updated in `app/contracts/base-sepolia/deployed_addresses.json`. The frontend doesn't call the renderers; it reads `Ships.tokenURI` |
| §3 Clear cached variant 1 images | Done: `SHIP_ART_VERSION` in `useShipImageCache.ts` drops every cached image once |
| §3 Client-side shiny preview | Done: `blendHSL` in `app/utils/shipRenderer/utils.ts` |
| §3 follow-up: lightness affects the hull (not deployed yet) | Done in the local renderer now. Cached images clear on their own when `Ships.config().metadataRenderer` changes (`useShipArtCacheGuard`), so the redeploy needs no frontend step |
| §4 `BatchMetadataUpdate` (optional) | Not done. The live `Ships` ABI doesn't have the event, and event ABIs come from the deployed artifacts. Add a watcher that calls `clearAllShipImageCache` after the next `Ships` deploy |

## Map ids
- `app/utils/seedDeploymentIds.ts` ports `syncStarterContent.ts`'s id lookup:
  - The deployment journal: each `Create<Key>Map` / `CreateRoguelike<Key>Node` call's nonce order gives its id.
  - `content-sync.json`: ids the sync created, plus ignored ids.
  - Checked against the live journal: PvP maps 61–66, `map67` is 68, 67 is ignored, and `m05` 5, `d01` 16, `s01` 22, `r01` 31.
- **Seed export (Admin › Export mission seed files):**
  - **[OPEN SEED FOLDER]** now takes the contracts repo's `ignition/` folder (or the repo itself). It reads `data/` and `deployments/chain-84532/`.
  - Baseline maps and nodes keep their place in the files, ignored ids are skipped, and new chain items go at the end.
  - Without a deployment record it falls back to seed order, with a warning.
  - In browsers that can't open folders, pick `journal.jsonl` and `content-sync.json` along with the seed files.
- **Web2 import (`prisma/importMissionSeeds.ts`):**
  - It uses the same ids by default (`--deployment <dir>` to choose the deployment, `--fresh` for seed order).
  - It deletes web2 maps no seed key maps to, rather than maps past the seed count.
  - The dry run on 2026-10-20 (read-only) reported no runs to clear, no lobbies to cancel and no maps to delete. It would add map 68.

## Map 67 and the map card problems
- On chain, map 67 has 68's blocked and impassable tiles, but no joiner zone and no enemy fleet, and no node uses it. Map 68 is r01's map. The seed and web2 hold no separate design for 67; it's being built in the Maps editor.
- Nothing is hidden. Each map card in the Maps tab (web3 and web2) lists its problems on the right, opposite the tile key, using `app/utils/mapProblems.ts`:
  - the same terrain as another map
  - a PvE map with no enemy fleet, or one no mission uses
  - missions fought on a map with no enemy fleet
- Web2's `GET /api/admin/ai-map-placements` returns every map's placements when `mapId` is left out.
- **Seed export:** a chain map with no seed key exports as a new seed map, with a warning to record its id in `content-sync.json`. Until then the sync script and the web2 import don't know its id. Map 67 is listed under `ignored` there now; move it to `maps` once it has a seed key.

## Shiny colors
- `blendHSL` follows the new variant 1 rule. `blendValues` is unchanged and still used by `blendHSLV2`.
- Checked against the live variant 1 `ImageRenderer` (`0x68E6…d409`). `renderShip` on the chain and locally gave byte-identical SVGs for shinies at hues 0, 359, 35 and 220. The live `Ships` has no minted ships yet, so `tokenURI` couldn't be compared.
- Web2 uses the same `renderShip` and only caches images in memory, so it needs nothing else.
- **Lightness follow-up:** `blendHSL`'s muted colors now move toward black or white with the ship's `l1` (squeezed above 50). Checked against the new `RenderSpecial1` already deployed by the in-progress redeploy (`0x82Ac…bBCa`): 30 of 30 cases matched, at lightness 0–100 and hues 0, 200 and 359.
  - Until `Ships.setConfig` points at the new renderers, web3's chain images (`tokenURI`) still use the earlier rule. Local previews (constructors, reward ship form) and web2 already use the new one.
  - `useShipArtCacheGuard` (mounted in `providers.tsx`) reads `Ships.config()` every 10 minutes and drops cached images when `metadataRenderer` changes.
- **Hull trait:** variant 1 and 2 art never draws it, on chain or locally (only the "perfect" fore piece checks `hull == 2`), so hull 0, 1 and 2 look the same. The contracts repo's `internal-todos.md` lists it as an open item.

## Tests
- New: `seedDeploymentIds.test.ts` and `mapProblems.test.ts`, plus export and import cases for deployment ids.
- 49 files, 414 tests passing. Type check and lint are clean.
