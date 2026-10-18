# Mobile design pass (2026-10-18)

The alternates from the design-pass canvas, built. Shared between the three battle views (GameDisplay, GameDisplayWeb2, SimulatedGameDisplay) and between web3 and web2 where both have the screen.

- **Debug mode** (Settings › Developer › Debug mode, `useDebugMode`, off by default, remembered per browser). While it's off these are hidden: the tutorial card's Debug checkbox and Clear reward cache, the battle debug panel (was dev-builds only), the last-move target coordinates, the cache-reset buttons (Battles, campaign graphs), the Manage Navy debug buttons (their own checkbox is gone) and the art-slot labels (were dev-builds only).
- **Rotate prompt:** one shared `RotateToLandscapePrompt`. Full screen, a card with the mission, round, whose turn and the turn clock (it keeps running), and a full-width Back at the bottom.
- **Battle rail, phone sideways** (`LandscapeBattleRail.tsx`):
  - One 44px header: Back, round and turn (with the clock), score, and a ⋯ menu (Sync in live games; Reset tutorial and Sign in/Quit in the tutorial).
  - Icon tabs in one row (labels for screen readers and on hover); Fleets is the green one.
  - Tutorial card footer is Prev/Next only, 40px tall.
  - Ship selected: a sheet with the ship's thumbnail, name and hull bar, a ⋯ menu with Retreat, and Close. The staged move ("Move · Hold position" or the destination, then "Target · weapon"), then the ship card, scroll in the middle; Cancel/Submit are pinned at the bottom. The weapon is picked only on the board; in the tutorial the board's picker carries the EMP cue (`GameGridWeaponSelector`'s new `tutorialWeaponOption`).
  - Web2 has the same ship sheet and an Actions tab now (parity). Its Retreat moved from the Status tab into the sheet's ⋯ menu. The staged move and targets are one shared component, `LandscapeStagedMove`, in all three views; the desktop staged-move panels are unchanged.
  - Checked at 812×375 and 667×340 (header fits at 12rem).
- **Operations map, phone upright:**
  - The route runs top to bottom (`CampaignGraphCanvas` below 640px), in a box capped at 60dvh that scrolls the selected mission into view.
  - The mission is a bar under the chart (title, kind, first line of the briefing); tapping it opens the briefing over the chart. The briefing's portrait sits above the text on phones, so the text is full width.
  - The bar and the action are pinned together above the bottom nav (`--vt-bottom-nav-h`, set by GameNav).
  - The empty toolbar row is gone, and the signed-out header is one row.
  - Checked at 390×770 signed out.
- **Command Deck, phones (layout A):** battles waiting on you first (when there are any), then Operations, the free-ship claim, and one list: Skirmish, Store (with the featured pack), Battles (when nothing's waiting), Tournaments (Soon).
- **Bottom nav:** drawn SVG icons on one grid and stroke instead of text glyphs.
- **Mobile notice:** opens only in the game client (the play host, or client paths), not over the website.

Not checked in a browser: signed-in screens (Command Deck, live and web2 battles, the nav), because wallet sign-in doesn't work on localhost.
