"use client";

import React, { createContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { GRID_DIMENSIONS, getMainWeaponName, getSpecialName } from "../../types/types";
import type { GridShip } from "../../types/gridDisplay";
import { weaponOnceMs, type WeaponEffectKind } from "../../utils/weaponPlayback";
import { GridShipImage } from "../GridShipImage";
import { DroneArtContext, DroneArtStore, useDroneArtHiddenIn } from "./droneArt";
import { SosHullFires } from "../SosHullFires";
import { LaserShootingAnimation } from "./LaserShootingAnimation";
import { RailgunShootingAnimation } from "./RailgunShootingAnimation";
import { MissileShootingAnimation } from "./MissileShootingAnimation";
import { PlasmaShootingAnimation } from "./PlasmaShootingAnimation";
import { MiningDrillAnimation } from "./MiningDrillAnimation";
import { EmpWaveAnimation } from "./EmpWaveAnimation";
import { AttackDroneAnimation, SAW_AT_MS } from "./AttackDroneAnimation";
import { RepairDroneAnimation, SCAN_END_MS } from "./RepairDroneAnimation";
import { ShipExplosionSound, shipExplosionDelayMs } from "./ShipExplosionSound";
import { WeaponSoundsMuted, useWeaponSoundsMuted } from "./weaponSounds";
import { paintRamLight, playRamCrash, rammerAt, type RamLayout, type RamTiming } from "./RamAnimation";
import { attachOverlayCanvas, FX_CANVAS_STYLE, prefersReducedMotion } from "./canvasFx";
import { startCancelledRaf } from "./overlayPaint";
import type { TargetStatusAfter } from "../../hooks/useMovePlayback";
import { terrainFullArt } from "../../utils/terrainEdges";

// Cinematic combat (Settings › Combat › Cinematic, useCombatView): an attack
// on an enemy ship plays as two overlapping comic panels over the board
// instead of on it. The attacker's panel is top left when the creator
// attacks and top right when the joiner does; the defender's is in the
// opposite bottom corner, on top. A repair on a friendly ship plays the same
// way: the healer's panel, then the patient's, captioned as a repair, both
// in the side's colour, with the hull bar filling instead of draining.
//
// Each panel is a zoomed window onto the same staged 17x11 board, with the
// two ships a fixed distance apart. The game's own weapon component runs in
// both panels' copies of that board from the same moment, so a shot leaves
// the attacker's panel through its frame and enters the defender's through
// its frame at the speed and angle it flies on the board; the stretch
// between the windows is never drawn. Only the attacker's copy plays sound.
// MovePlaybackLayer mounts this for the firing phase and keeps the board's
// own effect unmounted meanwhile.
//
// A Ram has no shot: the rammer itself is the projectile. It leaves its
// panel at the charge (drawn on both panels' staged boards, like a shot),
// slams into the victim's panel, the victim spins off out of frame, and the
// rammer stays on the victim's cell until the panels go.

const NEBULA_FULL_ART = terrainFullArt("nebula");
const CELL = 50; // layout px per staged cell: the game's unzoomed cell, which the effects are tuned for
const BOARD_W = GRID_DIMENSIONS.WIDTH * CELL;
const BOARD_H = GRID_DIMENSIONS.HEIGHT * CELL;

type Pt = { x: number; y: number };
type Cell = { row: number; col: number };

// Staged cells (creator attacking; mirrored for the joiner).
const STAGE_ATTACKER: Cell = { row: 4, col: 3 };
const STAGE_DEFENDER: Cell = { row: 5, col: 11 };
const STAGED_DISTANCE = Math.hypot(STAGE_DEFENDER.row - STAGE_ATTACKER.row, STAGE_DEFENDER.col - STAGE_ATTACKER.col);
const mirrorCell = (c: Cell): Cell => ({ row: c.row, col: GRID_DIMENSIONS.WIDTH - 1 - c.col });

// Panel outlines in % of the 16:9 stage (creator attacking), and where each
// ship's cell centre sits. Chosen so the line of fire leaves A through its
// right edge above B, and enters B through its left edge below A.
const PANEL_A: Pt[] = [{ x: 1.5, y: 3 }, { x: 64, y: 3 }, { x: 58, y: 58 }, { x: 1.5, y: 65 }];
const PANEL_B: Pt[] = [{ x: 40, y: 47 }, { x: 98.5, y: 40 }, { x: 98.5, y: 97 }, { x: 34, y: 97 }];
const ANCHOR_A: Pt = { x: 21, y: 31 };
const ANCHOR_B: Pt = { x: 73, y: 72 };
// A ship repairing itself has one panel, centred, its ship at the middle.
const PANEL_SOLO: Pt[] = [{ x: 20, y: 6 }, { x: 82, y: 3 }, { x: 80, y: 94 }, { x: 18, y: 97 }];
const ANCHOR_SOLO: Pt = { x: 50, y: 50 };
/** A staged cell's size as a fraction of the stage height. */
const CELL_OF_STAGE_H = 0.22;

// Timeline, ms from mount.
const B_IN_MS = 330;
const PANEL_IN_MS = 540;
const FIRE_AT_MS = 1125;
const HOLD_AFTER_MS = 750;
const PANEL_OUT_MS = 420;
const BACKDROP_FADE_MS = 300;
/** The hull bar drains from the hit to the end of the firing, and over at least this long. */
const MIN_HULL_DRAIN_MS = 500;
/** A killing blow empties the bar this fast, then the wreck replaces the ship. */
const KILL_HULL_DRAIN_MS = 400;
/** Ram: the rammer backs up a little, then charges across to the victim's cell. */
const RAM_WINDUP_MS = 240;
const RAM_CHARGE_MS = 360;
/** Ram: the victim spins off out of its panel. */
const RAM_KNOCKOFF_MS = 900;

/** How long the firing runs: the weapon's one shot, or a ram's charge and knock-off. */
function firingMs(effect: WeaponEffectKind): number {
  if (effect.kind === "ram") return RAM_WINDUP_MS + RAM_CHARGE_MS + RAM_KNOCKOFF_MS;
  return weaponOnceMs(effect, STAGED_DISTANCE);
}

function hullDrainMs(effect: WeaponEffectKind, killsTarget: boolean): number {
  if (killsTarget) return KILL_HULL_DRAIN_MS;
  return Math.max(MIN_HULL_DRAIN_MS, FIRE_AT_MS + firingMs(effect) - hitAtMs(effect));
}

/**
 * Where the cinematic draws: by default over the board's viewport (the grid's
 * parent). A board shown through a crop (the website's hero demo, which
 * renders a bigger board than it shows) names its visible window instead.
 */
export const CinematicHostContext = createContext<React.RefObject<HTMLElement | null> | null>(null);

// How many cinematics are playing. The board's tooltips stay off meanwhile
// (useCinematicPlaying): the panels cover the board, but take no pointer
// events, so the cells under them would still be hovered.
let cinematicsPlaying = 0;
const cinematicListeners = new Set<() => void>();
function setCinematicsPlaying(delta: number) {
  cinematicsPlaying += delta;
  cinematicListeners.forEach((fn) => fn());
}
function subscribeCinematics(fn: () => void) {
  cinematicListeners.add(fn);
  return () => {
    cinematicListeners.delete(fn);
  };
}

/** Whether a combat cinematic is on screen. */
export function useCinematicPlaying(): boolean {
  return useSyncExternalStore(
    subscribeCinematics,
    () => cinematicsPlaying > 0,
    () => false,
  );
}

/** Whether a move plays as a cinematic: a weapon fired at (or a ram into) an enemy ship, or a repair on a friendly one. */
export function cinematicCovers(effect: WeaponEffectKind): boolean {
  return (
    effect.kind === "main" ||
    effect.kind === "emp" ||
    effect.kind === "attackDrones" ||
    effect.kind === "repair" ||
    effect.kind === "ram"
  );
}

/** The cinematic's whole length: panels in, one firing, a beat, panels out. */
export function cinematicDurationMs(effect: WeaponEffectKind): number {
  return FIRE_AT_MS + firingMs(effect) + HOLD_AFTER_MS + PANEL_OUT_MS;
}

/** When the shot lands, ms after mount (the timing the game's explosion sound uses). */
function hitAtMs(effect: WeaponEffectKind): number {
  // The drones' work lands when the first ones start cutting or welding.
  if (effect.kind === "attackDrones") return FIRE_AT_MS + SAW_AT_MS;
  if (effect.kind === "repair") return FIRE_AT_MS + SCAN_END_MS;
  if (effect.kind === "ram") return FIRE_AT_MS + RAM_WINDUP_MS + RAM_CHARGE_MS;
  if (effect.kind !== "main") return FIRE_AT_MS + 300;
  return (
    FIRE_AT_MS +
    shipExplosionDelayMs({
      kind: "weapon",
      mainWeapon: effect.mainWeapon,
      variant: effect.variant,
      distanceCells: STAGED_DISTANCE,
    }) -
    250
  );
}

function weaponName(effect: WeaponEffectKind, ship: GridShip): string {
  const variant = Number(ship.traits.variant);
  if (effect.kind === "main") return getMainWeaponName(effect.mainWeapon, effect.variant);
  if (effect.kind === "emp" || effect.kind === "attackDrones") return getSpecialName(Number(ship.equipment.special), variant);
  // Both repairs (variant 1's special, variant 2's faction ability) are drones.
  if (effect.kind === "repair") return "Repair Drones";
  return "";
}

/** The cinematic's charge: the board's back-off and shove, with a longer charge across the panels. */
const CINEMATIC_RAM_TIMING: RamTiming = { windupMs: RAM_WINDUP_MS, chargeMs: RAM_CHARGE_MS, followMs: 360 };

/**
 * The rammer on a panel's staged board: at its cell until `charging`, then
 * the ram's back-off, its charge across to the victim and its shove onto the
 * victim's cell, where it stays (RamAnimation's motion), with the ram's light
 * (plume, ram field, the hit) on a canvas over the staged board. Drawn in
 * both panels from the same moment, so it leaves the rammer's panel through
 * its frame and arrives in the victim's. The victim's panel knocks its own
 * ship out of frame.
 */
function ChargingShip({
  ship,
  from,
  to,
  facesRight,
  charging,
  boardRef,
}: {
  ship: GridShip;
  from: Cell;
  to: Cell;
  facesRight: boolean;
  charging: boolean;
  boardRef: React.RefObject<HTMLDivElement | null>;
}) {
  const shipRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    if (!charging) return;
    const board = boardRef.current;
    const canvas = canvasRef.current;
    if (!board || !canvas) return;
    const surface = attachOverlayCanvas(board, canvas, "add");
    const reduced = prefersReducedMotion();
    const seed = Math.floor(Math.random() * 1000);
    const layout: RamLayout = {
      from: { x: (from.col + 0.5) * CELL, y: (from.row + 0.5) * CELL },
      to: { x: (to.col + 0.5) * CELL, y: (to.row + 0.5) * CELL },
      cell: CELL,
      facingRight: facesRight,
      // The victim is its panel's own ship; the charge's light doesn't draw it.
      victimTilt: (15 * Math.PI) / 180,
      victimBob: 0,
    };
    const startedAt = performance.now();
    const paint = (now: number) => {
      const f = now - startedAt;
      const r = rammerAt(f, layout, CINEMATIC_RAM_TIMING, reduced);
      if (shipRef.current) {
        shipRef.current.style.transform = `translate(${r.x - layout.from.x}px, ${r.y - layout.from.y}px)`;
      }
      const ctx = surface.begin();
      if (ctx) paintRamLight(ctx, f, layout, CINEMATIC_RAM_TIMING, seed, reduced, false);
    };
    paint(startedAt);
    return startCancelledRaf(paint);
    // One run per charge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charging]);

  return (
    <>
      <div
        ref={shipRef}
        className="pointer-events-none absolute"
        style={{ left: from.col * CELL, top: from.row * CELL, width: CELL, height: CELL, zIndex: 5 }}
      >
        <GridShipImage
          ship={ship}
          className={`h-full w-full ${facesRight ? "[&_img]:scale-x-[-1]" : ""}`}
          hideRankStars
          showLoadingState={false}
        />
      </div>
      <canvas ref={canvasRef} style={{ ...FX_CANVAS_STYLE, zIndex: 6 }} />
    </>
  );
}

/**
 * The weapon gets its own compositor layer. Without it, it shares a layer
 * with its zoomed, clipped panel, and every frame of the effect re-rasters
 * that panel at the screen's full pixel density, in both panels: measured
 * at phone density with a throttled CPU, raster time was 2-6x the on-board
 * effect's (plasma ~1000 ms vs ~160 ms over 7 s); with this, ~230 ms.
 */
const WEAPON_LAYER_STYLE: React.CSSProperties = { willChange: "transform" };

const MY_COLOR = "var(--color-cyan)";
const THEIR_COLOR = "var(--color-warning-red)";

/** "<Ship name> Attacking · Railgun"; just the role when the board has no name. */
function shipCaption(ship: GridShip, role: string): string {
  return ship.name ? `${ship.name} ${role}` : role;
}

const mirrorPts = (pts: Pt[]) => pts.map((p) => ({ x: 100 - p.x, y: p.y }));
const polyCss = (pts: Pt[]) => `polygon(${pts.map((p) => `${p.x}% ${p.y}%`).join(", ")})`;
const polyPoints = (pts: Pt[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");

function StagedWeapon({
  effect,
  boardRef,
  attacker,
  defender,
  facingRight,
  ship,
  soundOnceKey,
  attackerShown = true,
}: {
  effect: WeaponEffectKind;
  boardRef: React.RefObject<HTMLDivElement | null>;
  attacker: Cell;
  defender: Cell;
  facingRight: boolean;
  /** The attacking ship (the drone specials' drones are cut out of its art). */
  ship: GridShip;
  soundOnceKey: string;
  /** Whether this panel draws the attacker (the defender's panel doesn't): its drones then leave its art. */
  attackerShown?: boolean;
}) {
  const aim = {
    gridContainerRef: boardRef,
    attackerRow: attacker.row,
    attackerCol: attacker.col,
    targetRow: defender.row,
    targetCol: defender.col,
    soundOnceKey,
  };
  if (effect.kind === "emp") return <EmpWaveAnimation {...aim} once />;
  if (effect.kind === "attackDrones") return <AttackDroneAnimation {...aim} facingRight={facingRight} ship={ship} hideShipArt={attackerShown} once />;
  if (effect.kind === "repair") return <RepairDroneAnimation {...aim} facingRight={facingRight} ship={ship} hideShipArt={attackerShown} once />;
  if (effect.kind !== "main") return null;
  if (effect.mainWeapon === 0) return <LaserShootingAnimation {...aim} facingRight={facingRight} variant={effect.variant} once />;
  if (effect.mainWeapon === 1) return <RailgunShootingAnimation {...aim} facingRight={facingRight} variant={effect.variant} once />;
  if (effect.mainWeapon === 2) return <MissileShootingAnimation {...aim} facingRight={facingRight} variant={effect.variant} once />;
  return effect.variant === 2 ? (
    <MiningDrillAnimation {...aim} facingRight={facingRight} once />
  ) : (
    <PlasmaShootingAnimation {...aim} facingRight={facingRight} once />
  );
}

type PanelState = "waiting" | "in" | "out";

function CinematicPanel({
  poly,
  anchor,
  focus,
  stage,
  ship,
  shipFacesRight,
  shipHidden = false,
  knockOff = null,
  shipDisabled = false,
  shipStatus,
  shipStatusAfter = null,
  hullDrainMs = MIN_HULL_DRAIN_MS,
  background,
  nebula = false,
  enterFrom,
  state,
  shake,
  flash,
  flashKind = "hit",
  caption,
  captionColor,
  captionAt,
  captionSide,
  z,
  children,
  boardRef,
}: {
  poly: Pt[];
  anchor: Pt;
  focus: Cell;
  stage: { w: number; h: number };
  ship: GridShip;
  shipFacesRight: boolean;
  /** The panel's ship isn't drawn at its cell (a rammer: ChargingShip draws it). */
  shipHidden?: boolean;
  /** Set when a ram lands: the ship spins off along this direction (staged px) and out of frame. */
  knockOff?: Pt | null;
  /** Drawn the way the board draws a disabled (0 hull) ship: tilted, hull on fire. */
  shipDisabled?: boolean;
  /** The ship's hull bar and reactor damage, drawn as on the board. Omitted: neither. */
  shipStatus?: CinematicShipStatus | null;
  /** Set when the hit lands: the hull bar drains to it. */
  shipStatusAfter?: TargetStatusAfter | null;
  hullDrainMs?: number;
  background: string;
  /** The ship fights from a nebula tile: the panel's backdrop is nebula, tiled at the board's cell size over the map background. */
  nebula?: boolean;
  enterFrom: Pt;
  state: PanelState;
  shake: number;
  flash: number;
  /** "heal": a repair lands with a green glow instead of the hit's white-red flash. */
  flashKind?: "hit" | "heal";
  caption: string | null;
  /** The side's colour: yours cyan, theirs red. */
  captionColor: string;
  captionAt: "top" | "bottom";
  captionSide: "left" | "right";
  z: number;
  children?: React.ReactNode;
  boardRef: React.RefObject<HTMLDivElement | null>;
}) {
  // The drone specials take the drones off this panel's ship while they're out (droneArt.ts).
  const [droneArt] = useState(() => new DroneArtStore());
  const droneArtHidden = useDroneArtHiddenIn(droneArt, ship.id, focus.row, focus.col);
  // Shake and flash without remounting: the weapon inside keeps running.
  const shakeRef = useRef<HTMLDivElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!shake || !shakeRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    shakeRef.current.animate(
      [
        { transform: "translate(0,0)" },
        { transform: "translate(-1.2%,0.8%) rotate(-0.4deg)" },
        { transform: "translate(1%,-0.6%) rotate(0.3deg)" },
        { transform: "translate(-0.6%,0.4%)" },
        { transform: "translate(0.3%,-0.2%)" },
        { transform: "translate(0,0)" },
      ],
      { duration: 360, easing: "ease-out" },
    );
  }, [shake]);
  useEffect(() => {
    if (!flash || !flashRef.current) return;
    flashRef.current.animate(
      flashKind === "heal"
        ? [
            { filter: "brightness(1)" },
            { filter: "brightness(1.8) drop-shadow(0 0 6px var(--color-phosphor-green))", offset: 0.3 },
            { filter: "brightness(1)" },
          ]
        : [
            { filter: "brightness(1)" },
            { filter: "brightness(3.2) saturate(0.2)", offset: 0.12 },
            { filter: "brightness(1.4) sepia(1) hue-rotate(-40deg) saturate(4)", offset: 0.4 },
            { filter: "brightness(1)" },
          ],
      { duration: 520, easing: "ease-out" },
    );
  }, [flash, flashKind]);
  const knockRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!knockOff || !knockRef.current) return;
    const spin = knockOff.x >= 0 ? 720 : -720;
    knockRef.current.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${knockOff.x * 0.5}px, ${knockOff.y * 0.5}px) rotate(${spin * 0.45}deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${knockOff.x}px, ${knockOff.y}px) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: RAM_KNOCKOFF_MS, easing: "cubic-bezier(.15,.7,.4,1)", fill: "forwards" },
    );
  }, [knockOff]);

  const scale = (stage.h * CELL_OF_STAGE_H) / CELL;
  const cx = (focus.col + 0.5) * CELL;
  const cy = (focus.row + 0.5) * CELL;
  const tx = (anchor.x / 100) * stage.w - cx * scale;
  const ty = (anchor.y / 100) * stage.h - cy * scale;
  const shown = state === "in";
  const minY = Math.min(...poly.map((p) => p.y));
  const maxY = Math.max(...poly.map((p) => p.y));
  const midY = (minY + maxY) / 2;
  // The caption sits in the panel's outer corner, along its straight edge.
  const captionRow = poly.filter((p) => (captionAt === "top" ? p.y < midY : p.y > midY));
  const captionX =
    captionSide === "left"
      ? { left: `calc(${Math.min(...captionRow.map((p) => p.x))}% + 0.75rem)` }
      : { right: `calc(${100 - Math.max(...captionRow.map((p) => p.x))}% + 0.75rem)` };
  return (
    <div
      className="absolute inset-0"
      style={{
        zIndex: z,
        transform: shown ? "translate(0,0)" : `translate(${enterFrom.x}%, ${enterFrom.y}%)`,
        opacity: shown ? 1 : 0,
        transition:
          state === "out"
            ? `transform ${PANEL_OUT_MS}ms cubic-bezier(.6,0,.8,.4), opacity ${PANEL_OUT_MS}ms linear`
            : `transform ${PANEL_IN_MS}ms cubic-bezier(.2,1.4,.4,1), opacity 180ms linear`,
      }}
    >
      <div ref={shakeRef} className="absolute inset-0">
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: polyCss(poly) }}>
          <div
            ref={boardRef}
            className="absolute left-0 top-0 bg-near-black"
            style={{
              width: BOARD_W,
              height: BOARD_H,
              transformOrigin: "0 0",
              transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              backgroundImage: nebula ? `url(${NEBULA_FULL_ART}), url(${background})` : `url(${background})`,
              backgroundSize: nebula ? `${CELL}px ${CELL}px, cover` : "cover",
              backgroundPosition: nebula ? "0 0, center" : "center",
              backgroundRepeat: nebula ? "repeat, no-repeat" : undefined,
            }}
          >
            <div
              ref={knockRef}
              className="absolute"
              style={{
                left: focus.col * CELL,
                top: focus.row * CELL,
                width: CELL,
                height: CELL,
                visibility: shipHidden ? "hidden" : undefined,
              }}
            >
            <div ref={flashRef} className="absolute inset-0">
              <div
                className={`relative h-full w-full origin-center transition-transform duration-300 ease-out ${shipDisabled ? "sos-art-tilt rotate-[15deg]" : ""}`}
              >
                <div className={`relative h-full w-full ${shipDisabled && shipFacesRight ? "scale-x-[-1]" : ""}`}>
                  <GridShipImage
                    ship={ship}
                    className={`h-full w-full ${!shipDisabled && shipFacesRight ? "[&_img]:scale-x-[-1]" : ""}`}
                    hideRankStars
                    showLoadingState={false}
                    hideSpecialArt={droneArtHidden}
                  />
                  {shipDisabled && <SosHullFires shipId={ship.id} failing />}
                </div>
              </div>
              {shipStatus && (
                <ShipStatusMarks
                  status={shipStatus}
                  after={shipStatusAfter}
                  drainMs={hullDrainMs}
                  reactorOnLeft={shipFacesRight}
                />
              )}
            </div>
            </div>
            <DroneArtContext.Provider value={droneArt}>{children}</DroneArtContext.Provider>
          </div>
          <div
            className="pointer-events-none absolute inset-0 opacity-50 mix-blend-overlay"
            style={{
              background:
                "radial-gradient(circle at 1.5px 1.5px, rgba(255,255,255,0.35) 1px, transparent 1.6px) 0 0 / 7px 7px",
            }}
          />
        </div>
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polygon
            points={polyPoints(poly)}
            fill="none"
            stroke="var(--color-text-primary)"
            strokeWidth={10}
            strokeLinejoin="miter"
            vectorEffect="non-scaling-stroke"
          />
          <polygon
            points={polyPoints(poly)}
            fill="none"
            stroke="var(--color-near-black)"
            strokeWidth={4}
            strokeLinejoin="miter"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {caption && (
          <div
            className="absolute max-w-[46%] truncate border-2 bg-near-black px-2 py-0.5 font-bold uppercase tracking-wider"
            style={{
              ...(captionAt === "top" ? { top: `calc(${minY}% + 0.6rem)` } : { bottom: `calc(${100 - maxY}% + 0.6rem)` }),
              ...captionX,
              color: captionColor,
              borderColor: captionColor,
              boxShadow: "3px 3px 0 var(--color-near-black)",
              fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              fontSize: "clamp(11px, 2.4cqh, 20px)",
            }}
          >
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}

/** A ship's condition when the shot is fired. */
export interface CinematicShipStatus {
  hullPoints: number;
  maxHullPoints: number;
  reactorCriticalTimer: number;
}

/**
 * The board's hull bar (top of the tile; red at 25% or less) and reactor
 * damage marks (bottom corner, up to 3), in the staged cell's 50px units.
 * Once `after` is set (the hit has landed), the bar drains to it over
 * `drainMs` and the reactor marks show the new damage.
 */
function ShipStatusMarks({
  status,
  after,
  drainMs,
  reactorOnLeft,
}: {
  status: CinematicShipStatus;
  after: TargetStatusAfter | null;
  drainMs: number;
  reactorOnLeft: boolean;
}) {
  const { maxHullPoints } = status;
  const hullPoints = after ? after.hullPoints : status.hullPoints;
  const reactorCriticalTimer = after ? after.reactorCriticalTimer : status.reactorCriticalTimer;
  const pct = maxHullPoints > 0 ? Math.max(0, Math.min(100, (hullPoints / maxHullPoints) * 100)) : 0;
  const marks = Math.min(Math.max(0, reactorCriticalTimer), 3);
  // A ship knocked to 0 keeps its (empty) bar until the panel goes.
  const showBar = status.hullPoints > 0;
  return (
    <>
      {showBar && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-[30] px-0.5" dir="ltr">
          <div className="relative h-1 w-full overflow-hidden" style={{ backgroundColor: "var(--color-gunmetal)" }}>
            <div
              className="absolute left-0 top-0 h-full"
              style={{
                width: `${pct}%`,
                backgroundColor: pct <= 25 ? "var(--color-warning-red)" : "var(--color-phosphor-green)",
                transition: `width ${drainMs}ms linear, background-color ${drainMs}ms linear`,
              }}
            />
          </div>
        </div>
      )}
      {marks > 0 && (
        <div
          className={`pointer-events-none absolute bottom-0 z-[22] flex items-end ${reactorOnLeft ? "left-0" : "right-0"}`}
          style={{ margin: 1, gap: 1 }}
        >
          {Array.from({ length: marks }, (_, i) => (
            <div
              key={i}
              className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-warning-red/90 leading-none"
              style={{ width: 9, height: 9 }}
            >
              <span className="font-mono leading-none" style={{ fontSize: 7 }}>
                ✕
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export interface CombatCinematicProps {
  effect: WeaponEffectKind;
  attacker: GridShip;
  defender: GridShip;
  /** The creator's ships face right and fire from the left. */
  attackerIsCreator: boolean;
  /** The attacker is the viewer's ship: its caption is cyan and the target's red (else the other way round). */
  attackerIsMine: boolean;
  killsTarget: boolean;
  /** The target is disabled (0 hull) when the shot is fired. */
  defenderDisabled?: boolean;
  /** The target's hull and reactor damage when the shot is fired. */
  defenderStatus?: CinematicShipStatus | null;
  /** ...and once it lands: the hull bar drains to it from the hit. */
  defenderStatusAfter?: TargetStatusAfter | null;
  /** The move's sound key: its sounds play once per key, as on the board. */
  soundOnceKey: string;
  /** The map's background image (mapBackgroundFor), behind both panels. */
  background: string;
  /** The attacker fires from / the target sits on a nebula tile: that panel's backdrop is nebula. */
  attackerInNebula?: boolean;
  defenderInNebula?: boolean;
}

/**
 * The two-panel attack, filling its positioned parent (the board's
 * viewport, outside its pan/zoom). Runs once for cinematicDurationMs; the
 * caller unmounts it.
 */
export const CombatCinematic = React.memo(function CombatCinematic({
  effect,
  attacker,
  defender,
  attackerIsCreator,
  attackerIsMine,
  killsTarget,
  defenderDisabled = false,
  defenderStatus = null,
  defenderStatusAfter = null,
  soundOnceKey,
  background,
  attackerInNebula = false,
  defenderInNebula = false,
}: CombatCinematicProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const boardA = useRef<HTMLDivElement | null>(null);
  const boardB = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [a, setA] = useState<PanelState>("waiting");
  const [b, setB] = useState<PanelState>("waiting");
  const [firing, setFiring] = useState(false);
  const [hit, setHit] = useState(0);
  const soundsMuted = useWeaponSoundsMuted();
  // When the hull bar has finished draining (or a killing blow's has
  // emptied). The outcome is read from the props at that moment, not at
  // mount: an enemy move starts playing from its Move event, and the target's
  // hull after it (and whether it was destroyed) can arrive mid-cinematic.
  const [hullSettled, setHullSettled] = useState(false);
  const [killLanded, setKillLanded] = useState(false);
  const wrecked = killsTarget && killLanded;
  // A hit (a weapon or a special) that takes the target to 0 hull without
  // destroying it disables it: once the bar has drained, it tilts and burns
  // as the board draws it.
  const disabledByHit =
    hullSettled && !killsTarget && !defenderDisabled && effect.kind !== "repair" &&
    effect.kind !== "ram" &&
    defenderStatusAfter?.hullPoints === 0;
  // A repair that brings a disabled (SOS) ship's hull back above 0 restores
  // it: once the bar has filled, it rights itself and the fires go out.
  const restoredByRepair =
    hullSettled && effect.kind === "repair" && defenderDisabled && (defenderStatusAfter?.hullPoints ?? 0) > 0;

  useEffect(() => {
    setCinematicsPlaying(1);
    return () => setCinematicsPlaying(-1);
  }, []);

  // The largest 16:9 stage that fits the board's viewport.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const stageW = Math.min(w, (h * 16) / 9);
      setStage({ w: stageW, h: (stageW * 9) / 16 });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const fireMs = firingMs(effect);
    const hitMs = hitAtMs(effect);
    const outMs = FIRE_AT_MS + fireMs + HOLD_AFTER_MS;
    const timers = [
      window.setTimeout(() => setA("in"), 20),
      window.setTimeout(() => setB("in"), B_IN_MS),
      window.setTimeout(() => setFiring(true), FIRE_AT_MS),
      window.setTimeout(() => {
        setHit((n) => n + 1);
        if (effect.kind === "ram") playRamCrash(soundOnceKey, soundsMuted);
      }, hitMs),
      window.setTimeout(() => setFiring(false), FIRE_AT_MS + fireMs),
      window.setTimeout(() => {
        setA("out");
        setB("out");
      }, outMs),
    ];
    timers.push(window.setTimeout(() => setKillLanded(true), hitMs + KILL_HULL_DRAIN_MS + 50));
    timers.push(window.setTimeout(() => setHullSettled(true), hitMs + hullDrainMs(effect, false)));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // One run per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A repair's patient is on the healer's side.
  const isRepair = effect.kind === "repair";
  const isRam = effect.kind === "ram";
  const flip = !attackerIsCreator;
  const stagedAttacker = flip ? mirrorCell(STAGE_ATTACKER) : STAGE_ATTACKER;
  const stagedDefender = flip ? mirrorCell(STAGE_DEFENDER) : STAGE_DEFENDER;
  const polyA = flip ? mirrorPts(PANEL_A) : PANEL_A;
  const polyB = flip ? mirrorPts(PANEL_B) : PANEL_B;
  const anchorA = flip ? { x: 100 - ANCHOR_A.x, y: ANCHOR_A.y } : ANCHOR_A;
  const anchorB = flip ? { x: 100 - ANCHOR_B.x, y: ANCHOR_B.y } : ANCHOR_B;
  const dir = attackerIsCreator ? 1 : -1;
  const wreck = wrecked ? { ...defender, shipData: { ...defender.shipData, timestampDestroyed: 1 } } : defender;
  // A rammed ship is knocked on along the charge, well out of its panel.
  const ramDx = (stagedDefender.col - stagedAttacker.col) * CELL;
  const ramDy = (stagedDefender.row - stagedAttacker.row) * CELL;
  const ramDist = Math.hypot(ramDx, ramDy) || 1;
  const knockOff: Pt | null =
    isRam && hit > 0 ? { x: (ramDx / ramDist) * CELL * 4, y: (ramDy / ramDist) * CELL * 4 + CELL * 0.8 } : null;
  const rammer = (boardRef: React.RefObject<HTMLDivElement | null>) =>
    isRam ? (
      <ChargingShip
        ship={attacker}
        from={stagedAttacker}
        to={stagedDefender}
        facesRight={attackerIsCreator}
        charging={firing || hit > 0}
        boardRef={boardRef}
      />
    ) : null;
  // A ship repairing itself: one panel, its drones working on its own hull.
  const solo = attacker.id === defender.id;
  const weaponProps = {
    effect,
    attacker: stagedAttacker,
    defender: solo ? stagedAttacker : stagedDefender,
    facingRight: attackerIsCreator,
    ship: attacker,
  };

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-[250] flex items-center justify-center"
      style={{
        background: "color-mix(in srgb, var(--color-near-black) 72%, transparent)",
        opacity: a === "waiting" ? 0 : 1,
        transition: `opacity ${BACKDROP_FADE_MS}ms linear`,
      }}
      aria-hidden
    >
      {stage.w > 0 && (
        <div className="relative" style={{ width: stage.w, height: stage.h, containerType: "size" }}>
          {solo ? (
            <CinematicPanel
              z={1}
              poly={flip ? mirrorPts(PANEL_SOLO) : PANEL_SOLO}
              anchor={ANCHOR_SOLO}
              focus={stagedAttacker}
              stage={stage}
              ship={attacker}
              shipFacesRight={attackerIsCreator}
              shipStatus={defenderStatus}
              shipStatusAfter={hit > 0 ? defenderStatusAfter : null}
              hullDrainMs={hullDrainMs(effect, false)}
              background={background}
              nebula={attackerInNebula}
              enterFrom={{ x: 0, y: 14 }}
              state={a}
              shake={0}
              flash={hit}
              flashKind="heal"
              caption={shipCaption(attacker, hit > 0 ? "Repaired" : `Repairing · ${weaponName(effect, attacker)}`)}
              captionColor={attackerIsMine ? MY_COLOR : THEIR_COLOR}
              captionAt="top"
              captionSide={attackerIsCreator ? "left" : "right"}
              boardRef={boardA}
            >
              {firing && (
                <div className="weapon-once pointer-events-none absolute inset-0" style={WEAPON_LAYER_STYLE}>
                  <StagedWeapon {...weaponProps} boardRef={boardA} soundOnceKey={soundOnceKey} />
                </div>
              )}
            </CinematicPanel>
          ) : (
            <>
            <CinematicPanel
              z={1}
              poly={polyA}
              anchor={anchorA}
              focus={stagedAttacker}
              stage={stage}
              ship={attacker}
              shipFacesRight={attackerIsCreator}
              shipHidden={isRam}
              background={background}
              nebula={attackerInNebula}
              enterFrom={{ x: -18 * dir, y: -14 }}
              state={a}
              shake={0}
              flash={0}
              caption={shipCaption(
                attacker,
                isRam ? "Ramming" : `${isRepair ? "Repairing" : "Attacking"} · ${weaponName(effect, attacker)}`,
              )}
              captionColor={attackerIsMine ? MY_COLOR : THEIR_COLOR}
              captionAt="top"
              captionSide={attackerIsCreator ? "left" : "right"}
              boardRef={boardA}
            >
              {rammer(boardA)}
              {firing && !isRam && (
                <div className="weapon-once pointer-events-none absolute inset-0" style={WEAPON_LAYER_STYLE}>
                  <StagedWeapon {...weaponProps} boardRef={boardA} soundOnceKey={soundOnceKey} />
                </div>
              )}
            </CinematicPanel>
            <CinematicPanel
              z={2}
              poly={polyB}
              anchor={anchorB}
              focus={stagedDefender}
              stage={stage}
              ship={wreck}
              shipFacesRight={isRepair ? attackerIsCreator : !attackerIsCreator}
              shipDisabled={((defenderDisabled && !restoredByRepair) || disabledByHit) && !wrecked}
              shipStatus={wrecked ? null : defenderStatus}
              shipStatusAfter={hit > 0 && !isRam ? defenderStatusAfter : null}
              knockOff={knockOff}
              hullDrainMs={hullDrainMs(effect, killsTarget)}
              background={background}
              nebula={defenderInNebula}
              enterFrom={{ x: 18 * dir, y: 14 }}
              state={b}
              shake={isRepair ? 0 : hit}
              flash={hit}
              flashKind={isRepair ? "heal" : "hit"}
              caption={shipCaption(
                defender,
                isRepair
                  ? hit > 0
                    ? "Repaired"
                    : "Receiving repairs"
                  : isRam
                    ? hit > 0
                      ? "Rammed"
                      : "Defending"
                    : wrecked
                    ? "Destroyed"
                    : disabledByHit
                      ? "Disabled"
                      : "Defending",
              )}
              captionColor={isRepair === attackerIsMine ? MY_COLOR : THEIR_COLOR}
              captionAt="bottom"
              captionSide={attackerIsCreator ? "right" : "left"}
              boardRef={boardB}
            >
              {/* The same shot, from the same moment; its sounds are A's. */}
              {rammer(boardB)}
              <WeaponSoundsMuted value={true}>
                {firing && !isRam && (
                  <div className="weapon-once pointer-events-none absolute inset-0" style={WEAPON_LAYER_STYLE}>
                    <StagedWeapon {...weaponProps} boardRef={boardB} soundOnceKey={`${soundOnceKey}:defender`} attackerShown={false} />
                  </div>
                )}
              </WeaponSoundsMuted>
            </CinematicPanel>
            </>
          )}
        </div>
      )}
      {killsTarget ? (
        <ShipExplosionSound playKey={soundOnceKey} delayMs={hitAtMs(effect) + 250} />
      ) : null}
    </div>
  );
});
