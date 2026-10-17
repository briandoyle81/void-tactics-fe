# Frontend Handoff — Lottery Draws, Block-Hash Randomness, On-Chain Destroyed/Unconstructed Art

_Written 2026-10-17. Combines three earlier handoffs into one doc, current as of this date:_
- _`frontend-handoff-lottery-prize-retry-2026-10-14.md`_
- _`frontend-handoff-block-hash-randomness-2026-10-16.md`_
- _`frontend-handoff-onchain-explosion-art-2026-10-16.md`_

_Those files are kept for history, but this doc is the one to work from._

_None of this is deployed yet. All of it takes effect at the next redeploy:_
- _**Lottery:** `UTCLotteryHook` and `VariantPurchaseGate`._
- _**Randomness:** `RandomManager` and `Tournament`._
- _**Art:** `ImageRenderer`, `ImageRendererV2` and `RenderMetadata`._
- _**Ships**, which all three areas touch._

_Background: `docs/audit-3.md` HA6-04 to HA6-07, HA6-19 and HA6-27._

_After the redeploy, `uniswap-lottery-hook.json` at the repo root keeps the same format (`address`, `abi`, `poolId`, `poolKey`). Only its values change._

---

## 1. Lottery draws and prize delivery

This section supersedes `uniswap-lottery-selfie-check-frontend-integration.md` §4.5–4.6. It also supersedes the `PrizeMintFailed` note in `frontend-handoff-engine-registry-and-redeploy-2026-09-30.md` §6.

### How a draw works now

1. **Entries:** qualifying UTC→ETH sells enter the current draw (`currentDrawId`). This is unchanged.
2. **Close:** the first swap after `drawInterval` (24h) with at least `minParticipants` entrants **closes** the draw.
   - The swap emits `DrawClosed(drawId, closeBlock, totalWeight)`.
   - Entries freeze, and `currentDrawId` moves to the next draw.
   - The close block's hash already decides the winner, but nobody can know who it is until that block is sealed.
3. **Resolve:** the draw resolves automatically during the next swap in any later block. That swap mints the prize and emits `DrawResolved` or `DrawResolvedNoWinner`.
   - If no swap with enough gas comes along, anyone can call `resolveDraw(drawId)`. The result is the same whoever calls it, whenever they call it.
   - If nothing resolves the draw within **8191 blocks** (about 4.5 hours on Base, via EIP-2935; 256 blocks on a chain without it), the next attempt re-targets it to a new block. That attempt emits `DrawRetargeted(drawId, closeBlock)`. Resolving after that works normally.

Prize ships are minted straight to the winner, with no claim step. Any address can win any ship, including gated variants. Contract wallets without an ERC-721 receiver hook can receive them too.

### Frontend changes needed

- **Events:**
  - Listen for `DrawClosed` instead of `DrawStarted` (`LOTTERY_EVENTS` in `useUtcLotteryHook.ts`).
  - Optionally listen for `DrawRetargeted` too.
  - `PrizeMintFailed` no longer exists.
- **Resolve button (`UtcLotteryPanel.tsx`):**
  - It currently passes `currentDrawId`. That's the open draw, which can never be resolved.
  - Use `nextDrawToResolve()` instead. A draw is pending when `nextDrawToResolve() < currentDrawId()` and `!drawResolved(id)`.
  - Show the button while a draw is pending. It's a fallback; normally the next swap resolves the draw.
- **Revert reasons to surface on `resolveDraw`:**
  - `DrawNotClosed(id)`.
  - `DrawNotReady(id)`: the call is in the same block as the close. Retry in the next block.
  - `DrawAlreadyResolved(id)`.
  - `MintPaused()`: Ships is paused. Retry later.
  - Out of gas: let the wallet estimate the gas. Resolving uses up to about 600k.
- **Swap gas while a draw is pending (optional):**
  - Automatic resolution only runs in a swap that has at least `autoResolveMinGas()` gas left (1,000,000 by default).
  - Wallet gas estimates will normally come in below that. The swap still succeeds, but it skips resolving.
  - If your swap UI should resolve pending draws, set its gas limit to about `autoResolveMinGas + 300,000` while a draw is pending.
- **Removed reads:** `drawRandomRequestId` and `randomManager`. Use `drawCloseBlock(drawId)` instead; 0 means the draw isn't closed.
- **Random 4-star fallback prizes arrive unconstructed.** See §2.4.

### ABI summary

- **UTCLotteryHook:**
  - **Added:**
    - Reads: `drawCloseBlock`, `drawEffectiveTotalWeight`, `nextDrawToResolve`, `autoResolveMinGas`, `drawSegmentCount(drawId)` and `getDrawSegment(drawId, i) returns (owner, end)`.
    - Owner: `setAutoResolveMinGas`.
    - Events: `DrawClosed` and `DrawRetargeted`.
    - Errors: `DrawNotClosed` and `DrawNotReady`.
    - Segments: each segment is one slice of a draw's ticket range. A player can own several, and their slices add up to their `weightInDraw`. Segments are useful for showing or checking how a winner was picked.
    - Existing reads (`weightInDraw`, `totalWeightInDraw`, `drawParticipants`) are unchanged.
  - **Removed:** `drawRandomRequestId`, `randomManager`, `setRandomManager`, `DrawStarted`, `PrizeMintFailed` and `DrawNotStarted`.
  - **Constructor:** it no longer takes a RandomManager address.
- **VariantPurchaseGate:**
  - **Added:** `exemptMinter(address) view returns (bool)` and the owner function `setExemptMinter(address,bool)`.
  - **Changed:** `checkGate` takes a third argument, `address _minter`. The frontend doesn't call it.

---

## 2. Ship randomness comes from the mint block's hash

### What changed

A ship's random roll is now `keccak256(blockhash(mint block), requestId)`. It's fixed the moment the mint's block is sealed. Revealing or constructing later can't change it, and nobody can pick a better or worse moment to reveal.

The catch is that the hash can only be read for **8191 blocks (about 4.5 hours on Base)** after the mint, using the EIP-2935 history contract. On a chain without EIP-2935 the window is 256 blocks (about 8.5 minutes). If nothing reveals or constructs a ship within that window, its request **expires**:
- `constructShip(s)` reverts with `RequestExpired(requestId)`.
- The ship can't be constructed until an admin re-targets it with `RandomManager.retargetExpired`, which is done in batches. After that it constructs normally.

### Frontend changes needed

1. **Construct right after minting.** As soon as a pack purchase, free claim or tutorial claim confirms, automatically send `constructShips(newIds)` (or `constructAllMyShips`) as one signature. Constructing captures the hash and reveals the stats in the same transaction.
   - Today the reveal and construct only happen when the player clicks construct. That may be long after the window has closed.
2. **Drop the separate reveal step**, the `revealRandomnessBatch` call before construct in `useRandomManager.ts`. Constructing reveals by itself.
   - `NotYetRevealed` no longer exists. The comments describing it are stale: in `useRandomManager.ts`, and in `components/ShipActionButton.tsx` around lines 27 and 240.
   - Dropping the step saves a signature, which helps with the Dynamic rate-limit problem.
   - If you keep calling `revealRandomnessBatch`, it still works. It now only captures the hash and can't do any harm.
3. **Show an "awaiting admin" state** for expired ships:
   - If `RandomManager.isExpired(serialNumber)` is `true`, the ship needs an admin re-target. Show something like "Construction window missed — contact support".
   - If `canFulfill(serialNumber)` or `canFulfillBatch(ids)` is `true`, construct will succeed now: the ship is already revealed, or it's inside the window and at least one block past the mint.
   - There's no window-size constant to hard-code. `isExpired` and `canFulfill` are the source of truth, because they check whether the hash can actually be read.
4. **Ships minted outside the player's own transaction** are the most likely to expire:
   - **Lottery fallback prizes:** minted during someone else's swap. A random 4-star ship arrives unconstructed. Curated template prizes arrive already constructed.
   - **`ShipGrantWinEffect` win rewards:** minted at game end. Since HA6-27 these are PvE only (single-player and roguelike); PvP and tournament games have no win effects.

   Where you can detect these (a `DrawResolved` naming the user, or the game-end screen), prompt for a construct or send one automatically right away. Otherwise these ships will need the admin path.

### ABI changes

- **`RandomManager.requests(id)`** now returns `(blockNumber, revealed, result)`. `prevRandaoAtCommit` was removed.
- **Added:**
  - `isExpired(uint)` and `retargetExpired(uint[])`; `retargetExpired` is owner-only.
  - The `RequestExpired(uint requestId)` error and the `RandomnessRetargeted(requestId, blockNumber)` event.
  - `RandomManager` is now `Ownable`.
- **Unchanged:** `canRevealBatch` keeps its name. It now means the same as `canFulfillBatch`.
- **Tournament:** `rerollBracketShuffle` now also becomes available as soon as the shuffle request expires, not only after the 10-minute deadline. On Base the request lasts about 4.5 hours, so in practice the deadline comes first.

### Admin / ops

Whenever convenient, the owner (MAP_EDITOR in production) calls `RandomManager.retargetExpired([serialNumbers])`.
- **What it does:** points each expired, unrevealed request at the block of that transaction. Ids that are revealed, still valid or unknown are skipped, so this can't re-roll a valid roll.
- **Follow-up:** players (or the frontend) must then construct within the next ~4.5 hours, or the request expires again.

---

## 3. Destroyed and unconstructed ships render on-chain art

### What changed

`tokenURI`'s `image` is now an on-chain SVG data URI, specific to each variant, for these two states. Each one used to be a single shared IPFS image:
- **Destroyed ships:** variant 1 and variant 2 explosion art. Previously `ipfs://bafkreige3z6...`.
- **Unconstructed ships:** variant 1 and variant 2 unconstructed art. Previously `ipfs://bafkreibc3fdr...`.

The art is stored already base64-encoded. It's split across leaf contracts so each stays under the 24 KiB cap:

| Image | Leaves |
|---|---|
| v1 explosion | `RenderExplosion1`–`2` |
| v2 explosion | `RenderExplosion1V2`–`3V2` |
| v1 unconstructed | `RenderUnconstructed1`–`2` |
| v2 unconstructed | `RenderUnconstructed1V2`–`5V2` |

`ImageRenderer*` joins them in order behind `data:image/svg+xml;base64,`.

### Frontend changes needed

- **Local renderer port:** `app/utils/shipRenderer/ImageRenderer.ts` still returns the two old IPFS URIs (`DESTROYED_IMAGE` and `UNCONSTRUCTED_IMAGE`). Switch it to each variant's art. Any of these sources works:
  - The source SVGs in `~/Documents/void-tactics-character-art/`:
    - Explosions: `variant-{1,2}-explosion/variant-{1,2}-explosion-256px-portrait.svg`.
    - Unconstructed: `v{1,2}-unconstructed/v{1,2}-unconstructed-256px-merge35.svg`.

    The on-chain copies differ only in using `fill="#..."` attributes instead of `style="fill:#...;"`.
  - The joined `render()` output of the leaves, which is base64.
  - The `image` field from `tokenURI`.
- **Constructor ABI:** `ImageRenderer` and `ImageRendererV2` take two more arguments, `address[] _destroyedParts` and `address[] _unconstructedParts`. Two new views come with them: `destroyedParts(uint)` and `unconstructedParts(uint)`.
- **Gas,** measured on the test chain:

  | Call | Gas |
  |---|---|
  | `tokenURI`, unconstructed v1 | ~5.1M |
  | `tokenURI`, unconstructed v2 | ~11.4M |
  | `tokenURI`, constructed ship | ~15–16M |
  | Destroyed render | under 1M |

  These don't raise any new risk of hitting an RPC's gas cap. The unconstructed art was re-traced at `--merge=35` to get here; the earlier `--merge=15` v2 file put `tokenURI` near 48M.

---

## 4. Checklist

- [ ] Listen for `DrawClosed`, plus `DrawRetargeted` if wanted, instead of `DrawStarted`; stop listening for `PrizeMintFailed` (§1).
- [ ] Resolve button uses `nextDrawToResolve()` and shows only while a draw is pending (§1).
- [ ] Surface the `resolveDraw` revert reasons (§1).
- [ ] Optional: raise the swap gas limit while a draw is pending (§1).
- [ ] Replace `drawRandomRequestId` / `randomManager` reads with `drawCloseBlock` (§1).
- [ ] Auto-construct right after every mint the player makes (§2).
- [ ] Drop the separate reveal step and remove the stale `NotYetRevealed` comments (§2).
- [ ] Add the expired / "awaiting admin" state using `isExpired` / `canFulfill` (§2).
- [ ] Prompt a construct for lottery fallback prizes and PvE win-reward ships (§2).
- [ ] Update the `RandomManager.requests` decoding to the new return shape (§2).
- [ ] Switch the local `ImageRenderer.ts` port to the per-variant destroyed and unconstructed art (§3).
