# Web2/web3 parity merge: status (2026-10-18)

This doc is for picking the merge back up. It covers what has been merged, the pattern to follow, what's left, and the open items from the 2026-10-18 code review.

## The rule

- **Web3 is the source of truth.** The job is to make web2 match web3, not to judge whether web3's behaviour is right. If they differ, web3 wins on layout and on behaviour.
- **Don't evaluate nodes or content.** Campaign nodes, node titles and descriptions, briefings, and which missions exist or unlock are the user's to keep correct. Don't audit them, flag them or treat them as a testing gap. Don't touch `app/data/dialog/nodeContent.ts` or `app/data/content/mapNames.ts`.
- **One real shared component, not two copies kept in sync by hand.** Don't build a "smaller" web2 version of something that already exists. Extract the shared part and use it from both sides, even when that goes into a large file.

## The pattern

Each merged pair follows the CommandDeck pattern:

1. **A shared view** that works only in plain numbers. These usually go in `app/components/operations/` or next to the original.
2. **Two thin adapters**, the existing `Foo.tsx` and `FooWeb2.tsx`. Each one:
   - reads its own data (contract reads and transactions for web3, `apiFetch` and React Query for web2)
   - converts bigint to number (web3 only; this is the only place that conversion happens)
   - passes the mode-specific parts to the view as render slots
3. **Render slots** for the parts that really are different: `MapDisplay` vs `MapDisplayWeb2`, `ShipImage` vs `ShipImageWeb2`, the mission drawer, and transaction buttons vs API calls.
4. **Shared hooks** use a generic core with a per-mode accessor when the ids differ. For example, `useFleetPlacementCore<Id, S>` takes a `shipNumbers` accessor, and `useFleetPlacement` / `useFleetPlacementWeb2` wrap it.
5. **Shared pure logic** goes in utils and has tests:
   - `app/utils/gameplayDerived.ts`: `computeIsShowingProposedMove`, `computeActionType`, `computeConfirmWidgetLabel`, `buildDisplayGrid`
   - `gameGridRangesWeb2.ts`: movement, shooting, valid-target, label-target and hover ranges. Despite the name, web3, web2 and the tutorial all use it.

Optional behaviour is turned on by passing a prop, not by checking the mode. For example, `RunMap` offers Resume only when `onResume` is passed.

## Merged so far

**Run-map family** (Operations). The shared views are in `app/components/operations/`:

| Shared view | Adapters |
|---|---|
| `RunMap.tsx`: the star chart, the edit mode and the action bar wiring | `RoguelikeGraph.tsx` (with `Web3MissionDrawer`), `RoguelikeGraphWeb2.tsx` (with `Web2MissionDrawer`) |
| `RoguelikeNodeEditForm.tsx` | `RoguelikeNodeEditPanel.tsx`, `RoguelikeNodeEditPanelWeb2.tsx` |
| `RoguelikeCombatFleetModal.tsx` (with `useSeedCombatRoster` and `positionsInRosterOrder`) | `RoguelikeCombatModal.tsx`, `RoguelikeCombatModalWeb2.tsx` |
| `RoguelikeResupplyView.tsx` | `RoguelikeResupplyPanel.tsx`, `RoguelikeResupplyPanelWeb2.tsx` |
| `RoguelikeSettingsForm.tsx` | `RoguelikeSettingsModal.tsx`, `RoguelikeSettingsModalWeb2.tsx` |

Resupply and Settings were committed in `9e5fdc5`. RunMap, the node edit form and the combat fleet modal are still uncommitted.

**Hooks and utils** (one implementation each, using number ids):
- `useRetreatModeCancellation`
- `calculateDamage` and `useDamageCalculation`
- `toShipCardData`: one module that exports both `toShipCardData` and `toShipCardDataWeb2`
- `MapPlacementsEditorCore`, with a wrapper for each mode
- `useGamePolling`: web2 uses it with `isSinglePlayerGame: isVsAIGame`
- `useFleetPlacement`: the generic core described above

**Added 2026-10-19:**
- `components/ship/ShipSpecControls.tsx`: the equipment, traits, colors and ship data sections, shared by `ShipConstructor`, `ShipConstructorWeb2` and the reward ship form. The rest of the constructor pair (loading, cost and the customize flow) is still separate.
- Reward ships (`components/rewardShips/`): one shared admin view, form, drawer section and result-screen card, with web3 and web2 adapters.
- The enemy placement editor checks the map's joiner zone in both modes.

**Tutorial:** `SimulatedGameDisplay` now uses the shared range functions (plus its step filters) and `gameplayDerived`. The old copies in `gameGridRanges.ts` were removed and their tests point at the shared versions.

## What's left

These are the remaining pairs, by lines that are shared nearly word for word. The counts are from the last measurement, before the run-map work.

| Pair | Shared lines |
|---|---|
| `GameDisplay` / `GameDisplayWeb2` | about 500 |
| `Lobbies` | about 428 |
| `ShipConstructor` | about 269 |
| `RoguelikeRunStart` | about 238 |
| `ManageNavy` | about 231 |
| `Tournaments` | about 200 |
| `useShipDataCache` | about 143 |
| `navyFilters` | about 127 |

There were 63 pairs in all, about 5,450 shared lines, before the run-map work. Remeasure before choosing the next one.

Also still separate: the node editor's win-effect checkboxes. Web3 renders them inline in `RoguelikeNodeEditPanel`; web2 uses `WinEffectsPickerWeb2`.

**Suggested order:** `RoguelikeRunStart` comes next, since it finishes Operations. Then `ManageNavy` and `navyFilters` together, then `Lobbies`, then `GameDisplay`. `GameDisplay` is the biggest and also falls under the parity rule with `SimulatedGameDisplay`, so any change to how it looks has to be applied to all three views.

## Open review items (2026-10-18 review)

The high items are all fixed:
- **High 1:** Flow fulfill idempotency, with the `FlowFulfillment` table (migration applied to Neon)
- **High 2:** the tutorial uses the shared ranges
- **High 3:** `npm run lint` runs `eslint .`

Dead code is deleted. Medium 4 is the merge above and is ongoing.

Still open:
- **Medium 6:** there are three ship renderer caches; make them one.
- **Medium 7:** small helpers are copied around: `hullColor` (3 copies), `debugLog` (7), address shortening (22), and font constants.
- **Medium 8:** grid cell memoization.
- **Medium 9:** queries with `staleTime: 0`.
- **Medium 10:** `/api/games` uses the local part of the email as a player label.
- **Medium 11:** hover styles are done in JS instead of CSS.
- **Medium 12:** an event is dispatched twice.
- **Medium 13:** 58 lint warnings.
- The low items from the review.

## Testing limits

- On localhost, only the signed-out web3 paths can be clicked through: the tutorial and the signed-out Operations preview. Wallet sign-in doesn't work locally.
- Web2, admin Edit Mode and signed-in mission flows can only be checked from the code. Check them by comparing them to the web3 code they now share, and with `npx tsc --noEmit -p .`, `npx vitest run` and `npm run lint`.
- After route deletions, `tsc` errors in `.next/types/validator.ts` are stale. The dev server regenerates that file.
- Browser cleanup after a tutorial run:
  - set `vt-known-player-v1` to `"1"`
  - remove `void-tactics-tutorial-step-index` and the `vt-round-start-dismissed-tutorial*` keys
  - close any tabs you opened

## Constraints

- **Git:** read-only. Leave changes uncommitted; the user commits.
- **Dev server:** don't start, stop or restart it.
- **Data:** live Neon DB writes need the user's confirmation. Never print secret keys.
- **Backend:** no backend services in place of contract functions.
- **Hooks:** memoize ABIs, configs and callbacks (see CLAUDE.md).
