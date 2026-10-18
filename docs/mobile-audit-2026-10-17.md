# Mobile audit (2026-10-17)

## Context
This is a mobile-focused pass across the website, the game client and the battle views. The goals: content stays on screen, nothing important is unreachable, and space isn't wasted.

**How it was checked**
- **Browser:** signed-out screens were rendered in phone-sized frames on the running dev server: 390×770 portrait, 812×375 landscape, and 667×340 for a small phone in landscape. Covered: the website, sign-in, the rotate prompt, and the tutorial battle.
- **Code review:** signed-in screens were reviewed from the code. Wallet sign-in doesn't work on localhost.
- **Labels:** **[seen]** means confirmed in the browser. **[code]** means found by code review, with estimated sizes, not yet seen on a device.

Fixes stay shared between GameDisplay, GameDisplayWeb2 and SimulatedGameDisplay (parity rule).

## Status
- **Batch 1 fixed:**
  - #1, #2 (with #13), #6, #7, #9, #10, #11, #20, #21.
  - Also the 110% base font, now limited to screens taller than 500px.
  - #1, #2, #9, #10 and #11 were checked in phone frames.
- **Batch 2 fixed:**
  - #3, #4, #5, #8 (web3 and web2) and #22.
  - Code only: these are signed-in screens, so they need a check on a real phone.
- **Batch 3 fixed:**
  - #12, #14, #15, #16, #17, #18, #19, #23 and #24.
  - The Operations map and tablet portrait were checked in phone/tablet frames; the rest are code only.
  - Also fixed from the Low list: the Operations drawer close × (now 40px), the ship card icon buttons and the comms × and OK.
- **Open:**
  - Tablets in portrait now get the regular battle layout, but it only uses the top third of a tall screen. The layout should fill the height.
  - The rest of the Low list.

## How the client decides the layout
`useLandscapeMode.ts:10-16` treats any screen narrower than 1024px as mobile.
- **Portrait:** shows only a rotate prompt. [seen]
- **Landscape:** all three battle views switch to a full-height layout: a left column (tabs, panel) next to the board. The board's height fills the screen and its width follows the 17×11 grid.

## High: content unreachable or progress blocked
1. **Round report can't be acknowledged in landscape** [seen 812×375]
   - `RoundStartModal.tsx:100,107`: the card is centered with `overflow-hidden` and no height cap. It needs about 540px of height, and the screen is 375px.
   - The "Acknowledged" button rendered at y=399–439, off screen, with nothing scrollable around it. The top of the card is cut off too.
   - Report-only tutorial steps only advance from that button (`SimulatedGameDisplay.tsx:3082-3086`), so **the tutorial gets stuck on phones**. Every live mission round report has the same problem.
   - Fix: `max-h-[calc(100dvh-1rem)] overflow-y-auto` and a compact layout on short screens (smaller title, side-by-side scores). Also let a tap on the backdrop dismiss it.
2. **The live game's ship panel hides Retreat and the target list** [code]
   - In landscape, selecting a ship opens a panel that covers the left column (`GameDisplay.tsx:3062`), tabs included. Retreat and targets live in the actions tab (`:2500-2718`, Retreat at `:2671`).
   - The on-board confirm popup is never turned on in this layout (`:3228-3294`). So there's no voluntary retreat and no target picking from the list on a phone.
   - Web2 shows the board's confirm popup (`GameDisplayWeb2.tsx:1224`).
   - Fix: turn on the confirm popup in landscape for web3 too. That matches web2 and uses one interaction for both.
3. **Fleet selection modal has no phone layout** (Operations launch, Skirmish) [code]
   - `FleetSelectionModal.tsx:183,340-372` is a fixed `w-1/4` ship list next to a `w-3/4` map. On a phone the list is about 70px wide.
   - It uses `h-[100vh]`, so the bottom sits under the browser toolbar.
   - Fix: stack it below md (map on top, ship strip or sheet below), use `100dvh`, and `p-3`.
4. **Card-payment modal sits under the bottom nav and can't scroll** [code]
   - `FlowPaymentModal.tsx:47,54`: `z-50` is below GameNav's `z-[250]`, and the card has no height cap or scrolling.
   - Fix: `z-[450]`, `max-h-[90dvh] overflow-y-auto`, `p-4`, or reuse the CheckoutSheet bottom sheet.
5. **Ship filter popover runs off screen** [code]
   - `NavyFilterControls.tsx:52-54` and `NavyFilterToolbar.tsx:59-62`: it's fixed, anchored to the button and 96vw wide, so the right edge (and its Close) is clipped and the bottom can fall below the screen.
   - Fix: a full-width bottom sheet below md.
6. **Weapon dropdown opens off screen** (live game and tutorial, landscape) [code]
   - `GameDisplay.tsx:3088` and `SimulatedGameDisplay.tsx:3850` open upward from the top of a scrolling panel.
   - Fix: open downward.
7. **Flee menu clipped when you're the second player** [code]
   - `GameDisplay.tsx:3299-3321` (and the twin in the tutorial): the flag moves left, but the menu stays anchored `right-0` and is 13.25rem wide.
   - Fix: anchor `left-0` when the flag is on the left.
8. **No timeout claim and no replay controls on phones** [code]
   - The live game's "Claim win (timeout)" (`GameDisplay.tsx:3698-3721`) and the replay banner and controls (`:3917,3967`) exist only in the desktop layout. A replay opened from Battles plays with no controls. Web2 has the same gap.
   - Fix: add them to the landscape header and over the board.

## Medium: cramped, overflowing, wasted space
9. **The left column collapses on smaller phones** [seen 667×340]
   - The board won't shrink (`GameDisplay.tsx:3200` `shrink-0`), so the left column gets about 125px.
   - The header is cut to "G…/Y…", the tabs read "TUT STA ACT EVE", and the tutorial text is completely covered by the "Scroll for more" badge.
   - Fix: give the column a minimum width of about 13rem and cap the board at `calc(100vw - 13rem)`.
10. **Battle tab labels overlap** [seen 812×375]
    - "TUTOR/STATUS ACTION EVENTS FLEETS" (`SimulatedGameDisplay.tsx:3494`: `grid-cols-5`, uppercase with letter-spacing). The live game has 4 tabs and is tight too.
    - Fix: short labels or icons, no letter-spacing.
11. **The frame on the mobile Next button is wider than the button** [seen] — a regression from the 2026-10-14 Next-button change. The `TutorialTarget` wrapper stretches to fill its grid cell. Fix: make the button `w-full`, or `justify-self-start` on the wrapper.
12. **The tutorial card is covered while a ship is selected** [code] (`SimulatedGameDisplay.tsx:3823`). Fix: show a one-line version of the step in the ship panel.
13. **Submit is below the fold in the ship panel** [code] (`GameDisplay.tsx:3166-3192`), after a full ship card. Fix: pin the Submit/Cancel row.
14. **Operations: main action below the fold, chart doesn't scroll to the current mission** [code]
    - `CampaignGraphCanvas.tsx:9` sets a minimum chart height of 560, and RunActionBar stacks on phones. Total is about 940px against roughly 700px of screen.
    - `MIN_COL_WIDTH 230` makes the chart about 1,950px wide, and nothing scrolls the current node into view.
    - Fix: chart height `min(560px,55dvh)` on phones, a sticky RunActionBar above the nav, a smaller column width, and scroll the current or selected node into view.
15. **HUD resource pills are cut off with no cue** [code] (`Header.tsx:1051`, hidden scrollbar). The + buttons are 24px. Fix: compact numbers (1.2k), drop the text labels on phones, add an edge fade, 32px buttons.
16. **Store tabs clip "Lottery"** [code] (`SubTabs.tsx:21`). Fix: shorter labels on phones, or an edge fade.
17. **ShipCard header squeezes the name** [code] (`ShipCard.tsx:430-630`). The chips and icons take about 200px, tap targets are 16–24px, and the rank tooltip is hover-only. Fix: put the chips on a second row on phones, 40px icon buttons, and open the tooltip on tap.
18. **Command Deck layout A is about 1,400px of scrolling** [code] (`commandDeck/CommandDeck.tsx:222-330`). Fix: hide or shrink secondary tile art on phones, smaller headings, and a 2-column grid for the secondary tiles like layout B.
19. **Comms card has no height cap in landscape** [code] (`MissionDialogPanel.tsx:132`). The × is about 12×16px and Next/OK about 20px. Fix: cap the text at about 40% of the board height, 32px+ buttons.
20. **Flee confirmation is confined to the board** [code] (`FleeSafetySwitch.tsx:104`, inside `[contain:layout]`). Fix: render it through a portal.
21. **Safe areas aren't used** [code]
    - `app/layout.tsx:27` has no `viewportFit: "cover"`, so `env(safe-area-inset-*)` is 0 everywhere. GameNav's bottom inset does nothing, and in landscape the notch area is wasted.
    - Fix: set `viewportFit: "cover"` and add left/right insets on the landscape battle root.
22. **CheckoutSheet uses vh** [code] (`CheckoutSheet.tsx:60`). Fix: `90dvh` plus a bottom safe-area padding.
23. **Tablets in portrait are forced to rotate** [code] (the <1024px rule). Fix: decide by pointer type plus a short side of 500px or less.
24. **No pinch zoom on the board** [code] (`useGridPanZoom.ts:10,153`: wheel and right-drag only). Cells are about 30px. Fix: two-finger pinch and pan.

## Low: polish
- **Website:** the header's "[SIGN UP/LOGIN]" wraps onto two lines at 390px [seen]. The hero battle preview is cropped at the right edge [seen]. The page is about 7,900px long; acceptable, but the vertical padding between sections could tighten.
- **Alpha notice:**
  - It shows on the website too [seen].
  - It's centered with no height cap (`MobileAlphaNoticeModal.tsx:87`). It fits at 667×340 [seen], but only just.
  - Phones under 768px wide get the 110% base font in landscape (`globals.css:84-88`).
- **Rotate prompt:** it sits in the top half of the portrait screen, which leaves empty space below [seen]. The tutorial's prompt and the live game's don't match (`SimulatedGameDisplay.tsx:3375` vs `GameDisplay.tsx:2305`).
- **Tiny text and small tap targets** (10px text, 18–24px buttons):
  - the landscape battle header Back/Sync (`GameDisplay.tsx:2922-2960`)
  - the tutorial Prev/Next (`SimulatedGameDisplay.tsx:3687-3734`)
  - the flee switch (9px)
  - settings menu items (`Header.tsx:984`)
  - the Operations toolbar, including Retreat run (`RoguelikeGraph.tsx:59`)
  - the drawer close × (`OperationsMap.tsx:71`)
  - star-chart node titles (`RoguelikeNodeCard.tsx:129`)
  - lobby stat labels at 9px (`LobbyCard.tsx:193`)
  - price-card labels
- **Small confirm modals under the nav:** `MockPurchaseConfirmModal.tsx:42` and `RecycleConfirmModal.tsx:37` are z-50 under the nav. Raise them to z-[450].
- **Hover-only help:** the ShipConstructor help (`ShipConstructor.tsx:514`) is hover-only and overflows to the right.
- **Wasted padding:** p-6 / py-10 / mb-8 with no phone variant in LobbyCreateSection, ManageNavy, RoguelikeRunStart, RoguelikeCampaign, FleetFilterPanel and RetreatRunConfirmModal. The mission drawer uses a `text-2xl` title.
- **Profile:** it shows the full 42-character address centered with `break-all`. Shorten it and add a copy button.
- **Battle board:** the turn-colour outline is clipped on the bottom and left (`GameDisplay.tsx:3203-3212`).
- **Leftover landscape code:** dead branches (`mobileActivePanel` etc.).
- **First frame:** phones show the desktop layout for one frame before the landscape check runs.

## Already fine
- The website and sign-in screen fit at 390px with no horizontal scroll [seen].
- The landscape board fills the height [seen].
- GameNav's bottom bar.
- The Operations drawer as a bottom sheet.
- BattlesInbox rows.
- The Store, lobby and loadout grids (they start at one column).
- The Header settings menu.
- GameResultModal (scrolls within 100dvh).

## Suggested fix order
1. **Batch 1 (blockers, all three battle views):** #1 round report, #2 confirm popup in landscape, #9 column minimum width, #10 tab labels, #11 Next frame, #6/#7 menus, #20 flee portal, #21 viewportFit.
2. **Batch 2:** #3 fleet selection modal, #4/#22 payment sheets, #5 filter sheet, #8 claim and replay on phones.
3. **Batch 3 (space and reach):** #12–#19, #23, #24.
4. **Then the Low list.**

## Verification
- Use the same phone-frame method: an iframe on the dev-server origin at 390×770, 812×375 and 667×340.
  - For each fix: run the overflow audit script (elements past the viewport, `scrollWidth`), take a screenshot, and check the target control is inside the viewport.
  - Tutorial walk-through in landscape: round report → Acknowledged → select a ship → stage a move → Submit.
- Signed-in screens: check on a real phone after deploy (Fleet filters, Store checkout, Operations launch, live battle retreat and timeout).
- Run `npx tsc --noEmit -p .`, `npx vitest run`, and lint on the changed files.

## Re-audit
**How it was checked:**
- **Browser:** phone frames on the dev server. Website, sign-in and the Operations map at 360×740. The tutorial battle in landscape at 932×430 and 667×340, from the round report through steps 2–7, including a staged move.
- **Code:** a re-review of the three fix batches plus the signed-in screens.
- **Labels:** **[seen]** means confirmed in a browser frame. **[code]** means found in code review.

### Regressions from batches 1–3
- **R1. Medium-high: the landscape board overflows on notched iPhones** [code]
  - The board's height cap is `calc((100vw - 12.5rem) * 11/17)`. But body now has `env(safe-area-inset-left/right)` padding (from #21), which `100vw` still includes.
  - On an 844×390 iPhone the 12rem column doesn't fit and the board's outer edge gets clipped.
  - Files: `GameDisplay.tsx`, `SimulatedGameDisplay.tsx` and `GameDisplayWeb2.tsx` board containers.
  - Fix: subtract both insets in the calc, or size the board from the row with container units (`100cqw`).
- **R2. Medium: the staged-move panel is cramped in the landscape ship panel** [seen 667×340]
  - It renders its wide stacked-desktop layout: `flex-row gap-6`, p-4 (plus the tutorial's own p-3 box) and `pt-8`.
  - At 667×340, "CANCEL" spills out of its button, Submit and Cancel crowd each other, the coordinates wrap, and Retreat is pushed down. At 932×430 it fits but wastes about 330px of height.
  - It also shows a second weapon picker (the panel's `<select>` next to the ▼ dropdown).
  - Files: `renderProposedMoveActivePanel` in `GameDisplay.tsx` and `renderProposedMovePanel` in `SimulatedGameDisplay.tsx`.
  - Fix: a compact variant in landscape (stacked, p-2, no `pt-8`, one weapon picker).
- **R3. Medium: Command Deck layout A leaves an empty cell on phones** [code]
  - With `grid-cols-2`, Tournaments sits alone in its row, because the next block spans two columns.
  - The Store tile keeps its square featured-pack image, so the art-less Skirmish tile next to it stretches to match and is mostly empty.
  - File: `commandDeck/CommandDeck.tsx`.
  - Fix: Tournaments `col-span-2` on phones (or move it into the 2-column block), and shrink the featured-pack image on phones.
- **R4. Low-medium: the ship card header fix doesn't reach landscape phones** [code]
  - `max-w-[55%] … sm:max-w-none` keys off the viewport width, and landscape phones are wider than sm. So the 12rem battle ship panel still squeezes the name.
  - The chips wrap inside the right-hand column rather than onto a second row.
  - Tapping the rank chip no longer selects the card (its new stopPropagation).
  - File: `ShipCard.tsx`.
  - Fix: base it on the card's width with a container query, not the viewport.
- **R5. Low: replay controls on phones** [code] have tap targets of about 20px (`GameReplayControls.tsx`). There's also no one-finger pan or reset once the board is pinch-zoomed.

### New or still open
- **High: the website scrolls sideways at 360px** [seen]
  - The page is 390px wide. The header's right-hand group (Discord, X, [SIGN UP/LOGIN]) ends at x=390, and the hero headline "OUTMANEUVER." runs to x=366.
  - Fix: below about 380px, hide or shrink the social icons and shorten the button. Clamp the headline size.
- **Medium: fleet selection on a 390px phone shows only about one ship card** [code]
  - The list is one column, with `gap-4` and `mb-6`, and the map cells are about 21px.
  - Fix: a 2-column list below md; drop the `mb-6`.
- **Medium: HUD pills** [code]: still partial.
  - The text labels still show on phones.
  - There's no edge fade on the row, which hides its scrollbar.
  - The + buttons are 28px rather than 32px.
- **Medium: FleetViewModal** [code] (`FleetViewModal.tsx:31`) uses `p-6 h-[80vh]`, with Close only at the top. Fix: `p-3 md:p-6`, `max-h-[90dvh]`.
- **Medium: the Lobbies confirm modal** [code] (`Lobbies.tsx:2477`) uses `p-6` with no height cap or scrolling.
- **Medium, tablet only: the ship filter popover** [code] still uses the anchored desktop popover from 768 to 1023px wide, and it can run off the right edge.
- **Low: small tap targets on the sign-in screen** [seen]: the footer links are 17px tall and "Skip tutorial" is 18px.
- **Low: fixed full-width layers run under the notch in landscape** [code], for example the landscape fleet modal and GameNav at 667–767px wide.
- **Still open from before:**
  - the tablet portrait layout height
  - the first-frame desktop flash
  - dead `mobileActivePanel` branches
  - the rest of the Low list: LobbyCreateSection, ManageNavy and RoguelikeRunStart padding; RecycleConfirmModal and MockPurchaseConfirmModal z-50; the ShipConstructor help popover; the Profile address

### Checked and fine
- **Browser:**
  - At 360px: the sign-in screen and the signed-out Operations map (the action bar is on screen, and the chart scrolls to the current mission).
  - In the tutorial at 932×430 and 667×340: the round report fits with Acknowledged on screen, nothing is off screen through steps 2–7, the step strip shows in the ship panel, and the disabled Next is gray.
- **Code:**
  - The extracted render functions are declared in the right order, with no use-before-definition.
  - The countdown context reaches the landscape timer panel.
  - The `[@media(max-height:500px)]` variants are valid Tailwind 4.
  - The flee confirm portal is SSR-safe, and its z-index sits above the other overlays.
  - The pinch-zoom listener flags are right, and one-finger ship drags still work.
  - The Operations action bar sticks as intended: no ancestor sets overflow.
  - The 110% font rule and `formatBalanceCompact` are correct.

### Suggested fix order
1. The website overflow at 360px, then R1, R2 and R3.
2. Fleet selection list density, then R4.
3. HUD pills, FleetViewModal, Lobbies confirm modal.
4. The Low items.

### Re-audit fixes (2026-10-17)
- **Website at 360px:** the social links hide below 400px, the header button is tighter, and the headline is clamped (`clamp(2.25rem, 12vw, 3rem)`). Checked at 360px: no sideways scroll.
- **R1:** the board height is one shared value, `LANDSCAPE_BOARD_HEIGHT` (`app/utils/landscapeBoard.ts`), which subtracts both notch insets. Used by all three battle views.
- **R2:** the staged-move panel has a compact landscape variant in GameDisplay and SimulatedGameDisplay: stacked, p-1, smaller buttons and coordinates, and no second weapon picker (the ▼ picker stays). The tutorial keeps the top padding only while the Submit pointer shows. Checked at 667×340.
- **R3:** on phones the Command Deck uses dense grid flow (Tournaments moves up beside Skirmish), the Store spans both columns, and the pack art is smaller.
- **R4:** the ShipCard header stacks based on the card's own width (an `@container` query, under 18rem). Icon tap sizes go by pointer type (`pointer-coarse:`), and tapping the rank chip selects the card again.
- **R5:** replay buttons are at least 32px tall on touch screens, and a Reset zoom button shows while the board is zoomed.
- **Fleet selection:** the ship list is two columns below md, and the bottom margin is smaller.
- **HUD pills:** phones show a colour swatch instead of the label, the + fills the pill's height, and the row fades on the right while there's more to scroll.
- **FleetViewModal:** uses dvh, a height cap, phone padding, and two columns from 500px.
- **Lobbies confirm modal:** now one shared `FleetThreatWarningModal` for web3 and web2, capped to the screen and scrolling.
- **Ship filter:** the bottom sheet is used below 1024px, and the desktop anchor math accounts for the wrapper padding and the scrollbar.
- **Low list:**
  - Sign-in footer links and Skip Tutorial are 32px tall.
  - GameNav and the full-screen fleet modal are padded for the notch.
  - RecycleConfirmModal and MockPurchaseConfirmModal are z-[450] and capped.
  - LobbyCreateSection, ManageNavy and RoguelikeRunStart have less padding on phones.
  - The ShipConstructor help opens on tap and is pinned across the screen on phones.
  - Profile shows a shortened address on phones.
  - The dead `mobileActivePanel` code is removed from GameDisplay.
- **Tablet portrait:** a tablet held upright (portrait, up to 1024px wide, not a phone; `isPortraitTablet` in `useLandscapeMode`) gets the side layout stacked. The board is full width on top, and the rail is below it in two columns (header and score, fleet status). The classes are shared by all three views through `gameViewSideChrome` (`useGameViewChromeLayout.ts`). Checked in the tutorial:
  - 768×1024: the board is 758×490, up from about 480×310.
  - 1024×1366: the board is 972×639.
  - Held sideways (1024×768): it switches back to the side-by-side layout.
  - The tutorial card (`TutorialGridTaskPanel`, new `docked` prop) moves out of the board into the rail under the score, sized to its content. At 768×1024 it stays inside the screen on every step I checked (tallest 301px, bottom at 1022). Held sideways, it goes back over the board.
- **First-frame flash:** `useLandscapeMode` now reads the media queries during render (`useSyncExternalStore`) instead of in an effect after paint, so a battle view opening on a phone draws the phone layout from its first frame. Checked at 812×375 by watching every DOM change while the tutorial opened: the desktop rail never appeared. It still appears at 1280×800 and goes away after resizing back to 812×375.
