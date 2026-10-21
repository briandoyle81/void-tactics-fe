"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionType, Attributes, GRID_DIMENSIONS, Ship } from "../types/types";
import { GridShipPosition } from "../types/gridDisplay";
import type { Web2LastMove } from "../types/web2Game";
import { generateRandomShip } from "../utils/generateRandomShip";
import { calculateAttributesFromContracts } from "../utils/shipAttributesCalculator";
import { toGameplayShip, toGridShip } from "../utils/toGridDisplay";
import { useGameplayInteraction } from "../hooks/useGameplayInteraction";
import { useDamageCalculation } from "../hooks/useDamageCalculation";
import { calculateDamage } from "../utils/calculateDamage";
import { buildMapGridsFromContractMap } from "../utils/mapGridUtils";
import {
  HERO_DEMO_BLOCKED,
  HERO_DEMO_IMPASSABLE,
  HERO_DEMO_SCORING,
} from "../data/content/heroDemoMap";
import { GameGrid } from "./GameGrid";
import { WeaponSoundsMuted } from "./weapon-animations/weaponSounds";
import { GameBoardLayout } from "./GameBoardLayout";
import { useInView } from "../hooks/useInView";
import { usePageVisible } from "../hooks/usePageVisible";

// Info-page replacement for missile-clip.gif: a small, non-interactive
// autoplay loop built from the SAME real components/state machine the
// in-game tutorial (SimulatedGameDisplay.tsx) uses — <GameGrid> +
// <GameBoardLayout> driven by the shared `useGameplayInteraction` hook —
// with synthetic local ships (still no live chain/tutorial ship data) on a
// REAL preset map's terrain (DEMO_MAP_GRIDS, below), and a timer stepping
// through the same setters a player's clicks would call (select ship ->
// propose move -> lock target -> last-move replay) instead of onClick
// handlers. Every pixel
// (range highlights, weapon selector, confirm bar, target reticle,
// weapon-fire beam, nebula/hazard terrain tiles) is real GameGrid
// rendering, not reimplemented.
//
// GameGrid's own CSS grid template is hardcoded to the real board size
// (`grid-cols-[repeat(17,1fr)] grid-rows-[repeat(11,1fr)]`), so this must
// use the real GRID_DIMENSIONS — a smaller synthetic grid only fills a
// corner of that fixed template and renders broken.
//
// Renders at the real board's normal (unzoomed, scale-1) size — cells, ship
// art, and the weapon-selector/confirm-bar UI are exactly the pixel sizes
// they'd be in a live game — then a smaller `overflow: hidden` viewport
// crops down to just the close-up region via plain position offsets (no
// CSS transform scale), panned to the scripted action. `pointer-events-none`
// makes the whole thing strictly view-only, since this sits on a marketing
// page and shouldn't be clickable/draggable/wheel-zoomable at all.
const GRID_WIDTH = GRID_DIMENSIONS.WIDTH;
const GRID_HEIGHT = GRID_DIMENSIONS.HEIGHT;

const ALLY_ID = 1;
const ENEMY_ID = 2;
// Purely decorative background ships (never selected/targeted) — atmosphere,
// matching real screenshots always showing a few other fleets nearby.
const BG_ALLY_1_ID = 3;
const BG_ALLY_2_ID = 4;
const BG_ENEMY_1_ID = 5;
const BG_ENEMY_2_ID = 6;

const ALLY_START = { row: 5, col: 3 };
const ALLY_DEST = { row: 5, col: 7 };
const ENEMY_POS = { row: 4, col: 9 };
const BG_ALLY_1_POS = { row: 1, col: 4 };
const BG_ALLY_2_POS = { row: 9, col: 4 };
const BG_ENEMY_1_POS = { row: 1, col: 11 };
const BG_ENEMY_2_POS = { row: 2, col: 12 };

// Floors so the scripted move/shot always fall inside the real computed
// movement/shooting range regardless of the ship's randomly rolled
// equipment (never lowers a naturally-better roll — see the Math.max below).
const DEMO_MIN_MOVEMENT = 5;
const DEMO_MIN_RANGE = 4;

// GameGrid always renders the full 17x11 board at whatever real size its
// container gives it — cells, ship art, and the weapon-selector/confirm-bar
// UI (fixed-px Tailwind sizes) all come out at their true, correctly
// proportioned sizes this way, unlike a CSS `transform: scale()` zoom, which
// visually inflates the UI right along with the cells. So: render the real
// board at a genuinely larger size (CROP_SCALE× the visible viewport, via
// real width/height, not a transform), then crop down to just the close-up
// region with `overflow: hidden` on a smaller viewport, positioned via plain
// offsets (not a transform) so nothing inside gets visually rescaled.
const VISIBLE_COLS = 10;
const CROP_SCALE = GRID_WIDTH / VISIBLE_COLS;
// Board-fraction coordinates (not cell indices) of the point to center in
// the cropped viewport — anchored on the destination cell.
const FOCUS_COL = ALLY_DEST.col;
const FOCUS_ROW = 4.5;
const FOCUS_X_FRACTION = FOCUS_COL / GRID_WIDTH;
const FOCUS_Y_FRACTION = FOCUS_ROW / GRID_HEIGHT;

const DEMO_PLAYER_ADDRESS =
  "0x1111111111111111111111111111111111111a" as `0x${string}`;
const DEMO_ENEMY_ADDRESS =
  "0x2222222222222222222222222222222222222b" as `0x${string}`;

const EMPTY_MOVED_SET = new Set<number>();

const POSITIONS: GridShipPosition[] = [
  { shipId: ALLY_ID, position: ALLY_START, isCreator: true, status: 0 },
  { shipId: ENEMY_ID, position: ENEMY_POS, isCreator: false, status: 0 },
  { shipId: BG_ALLY_1_ID, position: BG_ALLY_1_POS, isCreator: true, status: 0 },
  { shipId: BG_ALLY_2_ID, position: BG_ALLY_2_POS, isCreator: true, status: 0 },
  {
    shipId: BG_ENEMY_1_ID,
    position: BG_ENEMY_1_POS,
    isCreator: false,
    status: 0,
  },
  {
    shipId: BG_ENEMY_2_ID,
    position: BG_ENEMY_2_POS,
    isCreator: false,
    status: 0,
  },
];

const COMMITTED_POSITIONS: GridShipPosition[] = POSITIONS.map((p) =>
  p.shipId === ALLY_ID ? { ...p, position: ALLY_DEST } : p,
);

const DEMO_LAST_MOVE: Web2LastMove = {
  shipId: ALLY_ID,
  oldRow: ALLY_START.row,
  oldCol: ALLY_START.col,
  newRow: ALLY_DEST.row,
  newCol: ALLY_DEST.col,
  actionType: ActionType.Shoot,
  targetShipId: ENEMY_ID,
  timestamp: 0,
};

const COMMITTED_MOVED_SET = new Set<number>([ALLY_ID]);

// A real preset map's terrain instead of a made-up decorative layout:
// "Debris Ring — Sector 14" (id 14), whose blocked, impassable and scoring
// tiles clear the scripted ally's move path (row 5, cols 3-7). It ships as
// a local snapshot (app/data/content/heroDemoMap.ts), so the homepage makes
// no RPC calls for it; built once at module load.
const DEMO_MAP_GRIDS = buildMapGridsFromContractMap(
  HERO_DEMO_BLOCKED,
  HERO_DEMO_SCORING,
  GRID_WIDTH,
  GRID_HEIGHT,
  HERO_DEMO_IMPASSABLE,
);

// select ship -> propose move -> lock target -> last-move replay -> reset
const PHASE_DURATIONS = [1000, 1000, 1600, 1800, 2600];
// Fire is "clicked" this long into the lock-target phase, before the shot.
const FIRE_CLICK_MS = 1200;

const cellSelector = (p: { row: number; col: number }) =>
  `[data-grid-row="${p.row}"][data-grid-col="${p.col}"]`;
// Where each phase's click lands (the phase's setter runs as it starts).
const PHASE_CLICK_SELECTORS: Record<number, string> = {
  1: cellSelector(ALLY_START),
  2: cellSelector(ALLY_DEST),
  3: cellSelector(ENEMY_POS),
};
const FIRE_SELECTOR = "[data-confirm-submit]";

type DemoClick = { x: number; y: number; key: number };

// A click mark over the demo, like a screen recording's: a translucent
// circle that expands and fades, with a second ring just behind it. Styles
// are inline (with their keyframes) so they ship with the component.
const CLICK_KEYFRAMES = `@keyframes demo-click{0%{transform:translate(-50%,-50%) scale(.4);opacity:.9}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}`;
const CLICK_CIRCLE: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: 44,
  height: 44,
  borderRadius: "9999px",
  opacity: 0,
};
const CLICK_FILL: React.CSSProperties = {
  ...CLICK_CIRCLE,
  background: "rgba(20, 24, 30, 0.45)",
  border: "2px solid rgba(255, 255, 255, 0.75)",
  boxShadow: "0 0 6px rgba(0, 0, 0, 0.5)",
  animation: "demo-click 600ms ease-out forwards",
};
const CLICK_RING: React.CSSProperties = {
  ...CLICK_CIRCLE,
  border: "2px solid rgba(255, 255, 255, 0.6)",
  animation: "demo-click 600ms ease-out 140ms forwards",
};

function DemoClickMark({ click }: { click: DemoClick }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-[1000]"
      style={{ left: click.x, top: click.y }}
    >
      <style>{CLICK_KEYFRAMES}</style>
      <span style={CLICK_FILL} />
      <span style={CLICK_RING} />
    </div>
  );
}

function buildDemoShips() {
  const allyBase = generateRandomShip(ALLY_ID, 1);
  const ally: Ship = {
    ...allyBase,
    owner: DEMO_PLAYER_ADDRESS,
    equipment: {
      ...allyBase.equipment,
      mainWeapon: 0,
    },
  };
  const enemy: Ship = {
    ...generateRandomShip(ENEMY_ID, 1),
    owner: DEMO_ENEMY_ADDRESS,
  };
  const bgAlly1: Ship = {
    ...generateRandomShip(BG_ALLY_1_ID, 1),
    owner: DEMO_PLAYER_ADDRESS,
  };
  const bgAlly2: Ship = {
    ...generateRandomShip(BG_ALLY_2_ID, 1),
    owner: DEMO_PLAYER_ADDRESS,
  };
  const bgEnemy1: Ship = {
    ...generateRandomShip(BG_ENEMY_1_ID, 1),
    owner: DEMO_ENEMY_ADDRESS,
  };
  const bgEnemy2: Ship = {
    ...generateRandomShip(BG_ENEMY_2_ID, 1),
    owner: DEMO_ENEMY_ADDRESS,
  };

  const allyBaseAttrs = calculateAttributesFromContracts(ally);
  const allyAttrs: Attributes = {
    ...allyBaseAttrs,
    movement: Math.max(allyBaseAttrs.movement, DEMO_MIN_MOVEMENT),
    range: Math.max(allyBaseAttrs.range, DEMO_MIN_RANGE),
  };
  const enemyAttrs = calculateAttributesFromContracts(enemy);
  const bgAlly1Attrs = calculateAttributesFromContracts(bgAlly1);
  const bgAlly2Attrs = calculateAttributesFromContracts(bgAlly2);
  const bgEnemy1Attrs = calculateAttributesFromContracts(bgEnemy1);
  const bgEnemy2Attrs = calculateAttributesFromContracts(bgEnemy2);

  // The last-move step shows the shot landed: the enemy's hull drops by what
  // the locked-target preview showed (the same calculation), never to 0.
  const shot = calculateDamage({
    shooterId: ALLY_ID,
    targetShipId: ENEMY_ID,
    getShipAttributes: (id) => (id === ALLY_ID ? allyAttrs : id === ENEMY_ID ? enemyAttrs : null),
    selectedWeaponType: "weapon",
    specialData: null,
    specialType: 0,
  });
  const enemyHitAttrs: Attributes = {
    ...enemyAttrs,
    hullPoints: Math.max(1, enemyAttrs.hullPoints - shot.reducedDamage),
  };

  return {
    ally,
    enemy,
    bgAlly1,
    bgAlly2,
    bgEnemy1,
    bgEnemy2,
    allyAttrs,
    enemyAttrs,
    enemyHitAttrs,
    bgAlly1Attrs,
    bgAlly2Attrs,
    bgEnemy1Attrs,
    bgEnemy2Attrs,
  };
}

export function TacticalTargetingPreview() {
  const [ships, setShips] = useState<ReturnType<typeof buildDemoShips> | null>(
    null,
  );
  const [phase, setPhase] = useState(0);
  const [selectedShipId, setSelectedShipId] = useState<number | null>(null);
  const [draggedShipId, setDraggedShipId] = useState<number | null>(null);
  // The autoplay re-renders the whole board every phase: pause it while the
  // preview is scrolled away or the tab is hidden.
  const rootRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(rootRef);
  const isPageVisible = usePageVisible();
  const isPlaying = isInView && isPageVisible;

  // Ship art/attributes use Math.random() — generate client-side only,
  // after mount, to avoid a hydration mismatch (same pattern as
  // HeroShipShowcase.tsx).
  useEffect(() => {
    setShips(buildDemoShips());
  }, []);

  const { blockedGrid, scoringGrid, onlyOnceGrid, impassableGrid } = DEMO_MAP_GRIDS;

  const showLastMove = phase === 4;

  const attributesById = useMemo(() => {
    const map = new Map<number, Attributes>();
    if (ships) {
      map.set(ALLY_ID, ships.allyAttrs);
      map.set(ENEMY_ID, showLastMove ? ships.enemyHitAttrs : ships.enemyAttrs);
      map.set(BG_ALLY_1_ID, ships.bgAlly1Attrs);
      map.set(BG_ALLY_2_ID, ships.bgAlly2Attrs);
      map.set(BG_ENEMY_1_ID, ships.bgEnemy1Attrs);
      map.set(BG_ENEMY_2_ID, ships.bgEnemy2Attrs);
    }
    return map;
  }, [ships, showLastMove]);
  const getShipAttributes = useCallback(
    (shipId: number) => attributesById.get(shipId) ?? null,
    [attributesById],
  );

  const gameplayShipMap = useMemo(() => {
    const map = new Map(
      ships
        ? [
            [ALLY_ID, toGameplayShip(ships.ally)],
            [ENEMY_ID, toGameplayShip(ships.enemy)],
            [BG_ALLY_1_ID, toGameplayShip(ships.bgAlly1)],
            [BG_ALLY_2_ID, toGameplayShip(ships.bgAlly2)],
            [BG_ENEMY_1_ID, toGameplayShip(ships.bgEnemy1)],
            [BG_ENEMY_2_ID, toGameplayShip(ships.bgEnemy2)],
          ]
        : [],
    );
    return map;
  }, [ships]);
  const gridShipMap = useMemo(() => {
    const map = new Map(
      ships
        ? [
            [ALLY_ID, toGridShip(ships.ally)],
            [ENEMY_ID, toGridShip(ships.enemy)],
            [BG_ALLY_1_ID, toGridShip(ships.bgAlly1)],
            [BG_ALLY_2_ID, toGridShip(ships.bgAlly2)],
            [BG_ENEMY_1_ID, toGridShip(ships.bgEnemy1)],
            [BG_ENEMY_2_ID, toGridShip(ships.bgEnemy2)],
          ]
        : [],
    );
    return map;
  }, [ships]);

  const shipPositions = showLastMove ? COMMITTED_POSITIONS : POSITIONS;
  const demoLastMove = showLastMove ? DEMO_LAST_MOVE : null;
  const movedShipIdsSet = showLastMove ? COMMITTED_MOVED_SET : EMPTY_MOVED_SET;

  const interaction = useGameplayInteraction({
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    shipMap: gameplayShipMap,
    getShipAttributes,
    allShipPositions: shipPositions,
    aliveShipPositions: shipPositions,
    movedShipIdsSet,
    playerAddress: DEMO_PLAYER_ADDRESS,
    currentTurn: DEMO_PLAYER_ADDRESS,
    isGameOver: false,
    isCurrentPlayerTurn: true,
    isSubmitting: false,
    blockedGrid,
    impassableGrid,
    lastMove: demoLastMove,
    selectedShipId: showLastMove ? null : selectedShipId,
    setSelectedShipId,
    draggedShipId,
    setDraggedShipId,
    selectedShipSpecialRange: undefined,
    selectedShipSpecialData: null,
    draggedShipSpecialRange: undefined,
    // This scripted demo never enters ram/repair targeting mode.
    selectedShipFactionAbilityRange: undefined,
    selectedShipFactionAbilityIsHeal: false,
    isFactionAbilitySupported: false,
  });

  const calculateDamage = useDamageCalculation({
    selectedShipId: interaction.selectedShipId,
    getShipAttributes,
    selectedWeaponType: interaction.selectedWeaponType,
    specialData: interaction.specialData,
    specialType: interaction.specialType,
  });

  const { resetSelection, setPreviewPosition, setTargetShipId } = interaction;

  // Click marks: measured from the real elements, relative to the viewport.
  const [click, setClick] = useState<DemoClick | null>(null);
  const showClickAt = useCallback((selector: string) => {
    const root = rootRef.current;
    const el = root?.querySelector(selector);
    if (!root || !el) return;
    const r = el.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    // Plus the crop box's own scroll, which absolutely positioned marks move with.
    setClick((prev) => ({
      x: r.left + r.width / 2 - box.left + root.scrollLeft,
      y: r.top + r.height / 2 - box.top + root.scrollTop,
      key: (prev?.key ?? 0) + 1,
    }));
  }, []);
  useEffect(() => {
    if (!isPlaying || !ships) return;
    const selector = PHASE_CLICK_SELECTORS[phase];
    if (selector) showClickAt(selector);
    if (phase !== 3) return;
    const t = setTimeout(() => showClickAt(FIRE_SELECTOR), FIRE_CLICK_MS);
    return () => clearTimeout(t);
  }, [phase, isPlaying, ships, showClickAt]);

  // Autoplay driver — calls the exact same setters a player's clicks would,
  // just on a timer instead of onClick.
  useEffect(() => {
    if (phase === 0 || phase === 4) resetSelection();
    else if (phase === 1) setSelectedShipId(ALLY_ID);
    else if (phase === 2) setPreviewPosition(ALLY_DEST);
    else if (phase === 3) setTargetShipId(ENEMY_ID);
  }, [phase, resetSelection, setPreviewPosition, setTargetShipId]);

  useEffect(() => {
    if (!isPlaying) return;
    const t = setTimeout(
      () => setPhase((p) => (p + 1) % PHASE_DURATIONS.length),
      PHASE_DURATIONS[phase],
    );
    return () => clearTimeout(t);
  }, [phase, isPlaying]);

  if (!ships) {
    // Same root element type as the board below, so React keeps this DOM
    // node and useInView's observer stays attached when the board appears.
    return <div ref={rootRef} className="h-[320px] w-full bg-near-black md:h-[400px]" />;
  }

  return (
    // Outer crop viewport: fixed size, clips overflow. The inner content div
    // is rendered at its real, unscaled size (CROP_SCALE× wider/taller than
    // this viewport, via actual width/height — not a CSS transform), so
    // cells/ships come out bigger while the weapon-selector/confirm-bar UI's
    // fixed-px sizing stays exactly what it'd be in a live game. `flex` on
    // the inner div is load-bearing — GameBoardLayout's own div declares no
    // height (it just shrinks to content), so GameGrid's internal `h-full`
    // chain has nothing definite to resolve against unless its immediate
    // parent is a flex container — default `align-items: stretch` is what
    // gives GameBoardLayout's div (and everything GameGrid computes from it)
    // an actual definite height instead of collapsing after layout settles.
    <div ref={rootRef} className="relative h-[320px] w-full overflow-hidden md:h-[400px]">
      <div
        className="absolute flex"
        style={{
          width: `${CROP_SCALE * 100}%`,
          aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}`,
          left: `${50 - FOCUS_X_FRACTION * CROP_SCALE * 100}%`,
          top: `${50 - FOCUS_Y_FRACTION * CROP_SCALE * 100}%`,
        }}
      >
        {/* A marketing page: the demo's weapons stay silent. */}
        <WeaponSoundsMuted value={true}>
        <GameBoardLayout isCurrentPlayerTurn={true}>
          <GameGrid
            grid={interaction.displayGrid}
            allShipPositions={shipPositions}
            shipMap={gridShipMap}
            selectedShipId={interaction.selectedShipId}
            previewPosition={interaction.previewPosition}
            targetShipId={interaction.targetShipId}
            selectedWeaponType={interaction.selectedWeaponType}
            draggedShipId={interaction.draggedShipId}
            dragOverCell={interaction.dragOverCell}
            movementRange={interaction.movementRange}
            shootingRange={interaction.shootingRange}
            validTargets={interaction.validTargets}
            labelTargets={interaction.labelTargets}
            assistableTargets={interaction.assistableTargets}
            assistableTargetsFromStart={interaction.assistableTargetsFromStart}
            dragShootingRange={interaction.dragShootingRange}
            dragValidTargets={interaction.dragValidTargets}
            isCurrentPlayerTurn={true}
            isShipOwnedByCurrentPlayer={interaction.isShipOwnedByCurrentPlayer}
            movedShipIdsSet={movedShipIdsSet}
            lastMoveShipId={showLastMove ? DEMO_LAST_MOVE.shipId : null}
            lastMoveOldPosition={
              showLastMove
                ? { row: DEMO_LAST_MOVE.oldRow, col: DEMO_LAST_MOVE.oldCol }
                : null
            }
            lastMoveNewPosition={
              showLastMove
                ? { row: DEMO_LAST_MOVE.newRow, col: DEMO_LAST_MOVE.newCol }
                : null
            }
            lastMoveResolvedTo={
              showLastMove
                ? {
                    shipId: DEMO_LAST_MOVE.shipId,
                    row: DEMO_LAST_MOVE.newRow,
                    col: DEMO_LAST_MOVE.newCol,
                  }
                : null
            }
            lastMoveActionType={showLastMove ? DEMO_LAST_MOVE.actionType : null}
            lastMoveTargetShipId={
              showLastMove ? DEMO_LAST_MOVE.targetShipId : null
            }
            lastMoveIsCurrentPlayer={showLastMove ? true : undefined}
            specialType={interaction.specialType}
            specialRange={interaction.specialRange}
            blockedGrid={blockedGrid}
            impassableGrid={impassableGrid}
            scoringGrid={scoringGrid}
            onlyOnceGrid={onlyOnceGrid}
            calculateDamage={calculateDamage}
            getShipAttributes={getShipAttributes}
            disableTooltips={true}
            address={DEMO_PLAYER_ADDRESS}
            currentTurn={DEMO_PLAYER_ADDRESS}
            setSelectedShipId={interaction.setSelectedShipId}
            setPreviewPosition={interaction.setPreviewPosition}
            setTargetShipId={interaction.setTargetShipId}
            setSelectedWeaponType={interaction.setSelectedWeaponType}
            setDraggedShipId={interaction.setDraggedShipId}
            setDragOverCell={interaction.setDragOverCell}
            getHoverPreview={interaction.getHoverPreview}
            showConfirmWidget={interaction.showConfirmWidget}
            confirmWidgetLabel={interaction.confirmWidgetLabel}
            onCancelMove={interaction.handleCancelMove}
            renderShipCard={() => null}
          />
        </GameBoardLayout>
        </WeaponSoundsMuted>
      </div>

      {/* Click-blocker: GameGridWeaponSelector/GameGridConfirmWidget/the HOLD
          button explicitly set pointer-events-auto on themselves (needed so
          they stay clickable over cells that intentionally ignore clicks in
          a real game), which would override a plain pointer-events-none on
          an ancestor. Sitting on top in stacking order, above everything
          GameGrid renders, is what actually guarantees this whole preview is
          strictly view-only on the Info page. */}
      <div className="absolute inset-0 z-[999]" aria-hidden />
      {click && <DemoClickMark key={click.key} click={click} />}
    </div>
  );
}
