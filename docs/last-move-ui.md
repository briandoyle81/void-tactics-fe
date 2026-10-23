# The last-move UI (as it was before the animation redesign, 2026-10-23)

Before `docs/eth-global-remote/animation-redesign`, the board showed the
previous action as a static "last move": the board snapped straight to the
new state, then decorated the move that got it there. This records how that
worked, since the redesign removes it in favor of playing each move back
(the ship moving along a path, its weapon firing once). Line numbers are
from the tree on 2026-10-23.

## Where the last move came from

All three views read one `lastMove` record:
`{ shipId, oldRow, oldCol, newRow, newCol, actionType, targetShipId, timestamp }`.

- **Web3** (`app/components/GameDisplay.tsx`): `Game.getGame` via `useGetGame`
  (`app/hooks/useGameContract.ts`), normalized by
  `app/utils/normalizeGameDataView.ts` (FactionAbility 5 is remapped to 7).
  No events fed the display: `GameUpdate` / `AITurnTaken` only triggered
  refetches, and the `Move` event was never read. A batched AI turn
  (`takeAITurns`, up to 6 moves) left only its final move in `lastMove`, so the
  earlier moves in it were never shown.
  - Your own move showed at once: `applyPendingMoveToGame`
    (`app/utils/pendingMove.ts`) wrote a predicted `lastMove` while the
    transaction was in flight.
  - `displayedLastMove` was the replay snapshot's `lastMove` while replaying.
- **Web2** (`app/components/GameDisplayWeb2.tsx`): `game.lastMove` from
  `/api/games/[id]` (written by `app/lib/gameEngineWeb2.ts`), refreshed by the
  SSE stream (`useGameStreamWeb2`). Same pending-move overlay as web3.
- **Tutorial** (`app/components/SimulatedGameDisplay.tsx`): the scripted
  per-step state's `lastMove`, written by hand in
  `app/utils/tutorialStepScripts.ts` and `app/utils/simulatedTutorialRules.ts`.
  Some steps (`ship-destruction`, `rescue`, `destroy-disabled`) substituted a
  scripted `lastMove` (`tutorialDisplayLastMove`). `rescue-outcome-sniper`
  applied two actions, so only the second showed.

Shared helpers: `app/utils/ramLastMove.ts` (`lastMoveEndPosition`: a Ram ends
on the victim's tile), `toGridLastMove` (`app/utils/toGridDisplay.ts`).

## When it showed

- **Web3** gated it with `computeShouldShowLastMove` (`GameDisplay.tsx`
  ~165-197). Hidden when the game was over, there was no move, or a ship was
  selected. Shown for a Retreat, for your own optimistic move, when the mover
  stood on the end tile, or (the AI grace window, `AI_LAST_MOVE_GRACE_MS`, 5 s)
  when the mover had briefly dropped out of the positions.
  - A side effect (~1381-1458) parked the selection on the last move:
    `setPreviewPosition(end)` (null for a hold), `setTargetShipId(target)` and
    the weapon type. That drove the weapon range highlight and beam target.
- **Web2** didn't gate the props; the cells and overlays hid things while a
  ship was selected.
- **Tutorial** nulled the props while a ship was selected
  (`lastMoveProps`); `showLastMoveEmpReplayWhenSelected` kept the EMP replay on
  two steps.

## What it drew

- **Ghost ship at the From tile.** `buildDisplayGrid`
  (`app/utils/gameplayDerived.ts` ~119-186) added the mover at its old tile
  with `isPreview: true` (when that tile was empty), and placed a ship just
  destroyed by a Shoot/Special with `status === 1`.
  `useGameplayInteraction` only did this with no ship selected and no move
  being proposed. Cells drew it with `move-hologram move-hologram-steady`
  (`globals.css`, "Last-move From: same hologram look, no flicker"). The
  design rule: while proposing, From is live and To is the hologram; for the
  last move, From is the hologram and To is live.
- **Cell styling** (`GameGridCell.tsx`): a green wash on the hologram; From
  tile dashed border, To tile solid border in team color (cyan you, red the
  opponent), the attack target bordered in the target's team color, the
  hologram From in green; the "moved this round" veil and grayscale skipped on
  the hologram and To tile; the destroyed target drawn solid, its SOS pulse
  suppressed; an amber pulse on the new position (`highlightedMovePosition`,
  web3 and the tutorial).
- **Hold (stayed in place).** A `hold-hologram-cell-last-move` pulse on the
  cell, the `.hold-hologram-overlay`, and a "Hold Position" label
  (`GameGridOverlays.tsx`).
- **Move arrow.** `GameGridMoveArrow` (`GameGridOverlays.tsx` ~207-426),
  shared with the proposed-move arrow: yellow (`#facc15`), drawn in a 17x11
  grid-unit SVG; a lone triangle for a one-tile move, a straight line along a
  row or column, otherwise an L (horizontal first, then vertical) that ignored
  obstacles. Never drawn for a Retreat.
- **Weapon fire, looping.** With no ship selected, the last Shoot replayed its
  directed weapon (laser, mining laser, missile/torpedo, plasma, mining drill,
  railgun/linear accelerator) from the To tile at its target, in live color
  (the aiming preview drew in the green `.weapon-hologram`). Specials replayed
  through their own mounts: flak (`lastMoveFlakTargetCells`), lightning
  field, EMP wave, repair drones, attack drones. Every animation looped for as
  long as it was mounted. Sounds played once per move through
  `soundOnceKey` and `takeFirstPlay` (`weapon-animations/playOnce.ts`, a
  sessionStorage list of recent keys), so re-showing the same move stayed
  quiet.
- **Retreat.** `WarpFieldCollapseAnimation` at the old tile and
  `FleeAnimation` (the ship's hologram zooming off its own side), with a
  dashed ring on the cell; `lastSeenIsCreatorRef` kept the side after the ship
  left the board.
- **Ram.** `RamAnimation` (a charge streak, the impact, the victim tumbling
  off; looping, with its crash sound and shake once) and the "RAMMING SPEED" /
  "WARNING: OVERLOAD" labels.
- **Kill.** `ShipExplosionSound`, once per move, after the weapon's hit time.
- **No damage numbers** for the last move ("Don't show damage labels for the
  prior move").

The hero demo (`TacticalTargetingPreview.tsx`) staged a hard-coded
`DEMO_LAST_MOVE` in its phase 4, with weapon sounds muted
(`WeaponSoundsMuted`).

## Replay mode

Replay (`?replay=1`, the Battles inbox's Replay button) drew each turn with
this same machinery: web3 swapped `displayedLastMove` to the replay
snapshot's `lastMove` (snapshots from the browser's `GameRecord`,
`serializeGameRecord.ts`), web2 used its server `GameTurn` history
(`/api/games/[id]/replay`). Controls: `GameReplayControls.tsx`. A quirk: web3's
gate read the live game (winner, positions), so a finished game's replay hid
most of it; web2's ungated props showed it.

## Off the board (kept)

The written record isn't part of this: `GameLastMovePanel.tsx` (bottom right)
and the Events tab (`GameEvents.tsx`) describe the last move in words.
