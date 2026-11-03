"use client";

import React, { useContext, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { GridShip, GridShipPosition } from "../types/gridDisplay";
import type { ActivePlayback, PlaybackPhase } from "../hooks/useMovePlayback";
import { routeForShip } from "../utils/movePath";
import { weaponEffectFor, weaponOnceMs, type WeaponEffectKind } from "../utils/weaponPlayback";
import { MovePathArrow } from "./MovePathArrow";
import { ShipMoveAnimation } from "./weapon-animations/ShipMoveAnimation";
import { LaserShootingAnimation } from "./weapon-animations/LaserShootingAnimation";
import { MissileShootingAnimation } from "./weapon-animations/MissileShootingAnimation";
import { PlasmaShootingAnimation } from "./weapon-animations/PlasmaShootingAnimation";
import { MiningDrillAnimation } from "./weapon-animations/MiningDrillAnimation";
import { RailgunShootingAnimation } from "./weapon-animations/RailgunShootingAnimation";
import { FlakExplosionAnimation } from "./weapon-animations/FlakExplosionAnimation";
import { EmpWaveAnimation } from "./weapon-animations/EmpWaveAnimation";
import { LightningFieldAnimation } from "./weapon-animations/LightningFieldAnimation";
import { RepairDroneAnimation } from "./weapon-animations/RepairDroneAnimation";
import { AttackDroneAnimation } from "./weapon-animations/AttackDroneAnimation";
import { RamAnimation } from "./weapon-animations/RamAnimation";
import { FleeAnimation } from "./weapon-animations/FleeAnimation";
import { WarpFieldCollapseAnimation } from "./weapon-animations/WarpFieldCollapseAnimation";
import { ShipExplosionSound, shipExplosionDelayMs, type KillingBlow } from "./weapon-animations/ShipExplosionSound";
import {
  CinematicHostContext,
  CombatCinematic,
  cinematicCovers,
  cinematicDurationMs,
} from "./weapon-animations/CombatCinematic";
import { cellsInManhattanRange, flakArrayRange, lightningFieldRange } from "./GameGridOverlays";
import { useCombatView } from "../hooks/useCombatView";

// Draws the move that's playing back (useMovePlayback): while "moving", the
// route arrow and the ship sliding along it; while "firing", the arrow and
// the ship's weapon fired once (weaponOnceMs), with its sound once. Calls
// onPhaseDone(key, phase) as each phase ends; when the queue is empty nothing
// is drawn. Lives in GameGrid, so web3, web2, the tutorial and replay share it.
// With Combat view set to Cinematic (useCombatView), an attack on an enemy
// ship (or a repair on another friendly one) plays in CombatCinematic's two
// panels over the board instead: the
// board's weapon (and its sounds) isn't mounted for that move, and the
// firing phase lasts the cinematic's length.

type Position = { row: number; col: number };

const sameTile = (a: Position, b: Position) => a.row === b.row && a.col === b.col;

/** The ships GameGrid's cells hide while a move plays: the one sliding or fleeing, and a rammed victim. */
export function playbackHiddenShipIds(active: ActivePlayback | null, shipMap: Map<number, GridShip>): Set<number> {
  const ids = new Set<number>();
  if (!active) return ids;
  const { move, phase } = active;
  const ship = shipMap.get(move.shipId);
  const effect = ship ? effectOf(move.actionType, ship) : null;
  if (phase === "moving" && !sameTile(move.from, move.to)) ids.add(move.shipId);
  if (phase === "firing" && effect?.kind === "retreat") ids.add(move.shipId);
  if (phase === "firing" && effect?.kind === "ram" && move.targetShipId) ids.add(move.targetShipId);
  return ids;
}

function effectOf(actionType: number, ship: GridShip): WeaponEffectKind {
  return weaponEffectFor(actionType, {
    variant: Number(ship.traits.variant),
    mainWeapon: Number(ship.equipment.mainWeapon),
    special: Number(ship.equipment.special),
  });
}

export function MovePlaybackLayer({
  active,
  onPhaseDone,
  gridContainerRef,
  grid,
  allShipPositions,
  shipMap,
  impassableGrid,
  getShipAttributes,
  background,
  blockedGrid,
  isShipOwnedByCurrentPlayer,
}: {
  active: ActivePlayback | null;
  onPhaseDone: (key: string, phase: PlaybackPhase) => void;
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  grid: (GridShipPosition | null)[][];
  allShipPositions: readonly GridShipPosition[];
  shipMap: Map<number, GridShip>;
  impassableGrid?: boolean[][];
  getShipAttributes: (shipId: number) => {
    hullPoints: number;
    maxHullPoints: number;
    reactorCriticalTimer: number;
  } | null;
  /** The map's background image, behind the cinematic's panels. */
  background: string;
  /** The map's nebula tiles, for the cinematic's backdrop. */
  blockedGrid?: boolean[][];
  /** Whose ship it is, for the cinematic's captions (blue yours, red theirs). */
  isShipOwnedByCurrentPlayer?: (shipId: number) => boolean;
}) {
  const combatView = useCombatView();
  const cinematicHost = useContext(CinematicHostContext);
  // Each ship's side as last seen: a retreating ship may already be gone.
  const lastSeenIsCreatorRef = useRef(new Map<number, boolean>());
  allShipPositions.forEach((p) => lastSeenIsCreatorRef.current.set(p.shipId, p.isCreator));

  const move = active?.move ?? null;
  const phase = active?.phase ?? null;
  const ship = move ? shipMap.get(move.shipId) : undefined;
  const effect: WeaponEffectKind = move && ship ? effectOf(move.actionType, ship) : { kind: "none" };
  const isCreator = move
    ? (allShipPositions.find((p) => p.shipId === move.shipId)?.isCreator ??
      lastSeenIsCreatorRef.current.get(move.shipId) ??
      true)
    : true;

  // The route, computed once per move from the board as it was when the move started.
  const path = useMemo(() => {
    if (!move) return [];
    return routeForShip({
      shipId: move.shipId,
      from: move.from,
      to: move.to,
      shipPositions: allShipPositions,
      impassableGrid,
      isDisabled: (id) => getShipAttributes(id)?.hullPoints === 0,
    });
    // The board changes as the move lands; the route is the one it set out on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [move?.key]);

  const slides = !!move && !!ship && effect.kind !== "retreat" && !sameTile(move.from, move.to);
  const targetPos = move?.targetShipId
    ? (allShipPositions.find((p) => p.shipId === move.targetShipId)?.position ?? null)
    : null;
  const distanceCells = move && targetPos ? Math.hypot(move.to.row - targetPos.row, move.to.col - targetPos.col) : 0;
  const targetShip = move?.targetShipId ? shipMap.get(move.targetShipId) : undefined;
  // A ship repairing itself stays on the board: the cinematic needs two ships.
  const cinematic =
    combatView === "cinematic" &&
    cinematicCovers(effect) &&
    !!targetShip &&
    !!targetPos &&
    move?.targetShipId !== move?.shipId;
  const fireMs = cinematic ? cinematicDurationMs(effect) : weaponOnceMs(effect, distanceCells);

  // Skip a phase with nothing to draw (a hold doesn't slide; Pass fires nothing).
  const onPhaseDoneRef = useRef(onPhaseDone);
  onPhaseDoneRef.current = onPhaseDone;
  useEffect(() => {
    if (!move || !phase) return;
    if (phase === "moving" && !slides) {
      onPhaseDoneRef.current(move.key, "moving");
      return;
    }
    if (phase === "firing") {
      const timer = window.setTimeout(() => onPhaseDoneRef.current(move.key, "firing"), fireMs);
      return () => window.clearTimeout(timer);
    }
  }, [move, phase, slides, fireMs]);

  if (!move || !phase || !ship) return null;
  const arrow = slides && effect.kind !== "ram" ? <MovePathArrow path={path} /> : null;

  if (phase === "moving") {
    if (!slides) return null;
    return (
      <>
        {arrow}
        <ShipMoveAnimation
          key={move.key}
          gridContainerRef={gridContainerRef}
          ship={ship}
          isCreator={isCreator}
          path={path}
          onComplete={() => onPhaseDone(move.key, "moving")}
        />
      </>
    );
  }

  const soundOnceKey = `playback:${move.key}`;
  if (cinematic && targetShip) {
    // Over the board's viewport, outside its pan/zoom transform (or the
    // window a cropped board is shown through).
    const viewport = cinematicHost?.current ?? gridContainerRef.current?.parentElement;
    if (!viewport) return null;
    return createPortal(
      <CombatCinematic
        key={move.key}
        effect={effect}
        attacker={ship}
        defender={targetShip}
        attackerIsCreator={isCreator}
        attackerIsMine={isShipOwnedByCurrentPlayer?.(move.shipId) ?? false}
        killsTarget={!!move.killsTarget}
        defenderDisabled={getShipAttributes(targetShip.id)?.hullPoints === 0}
        defenderStatus={getShipAttributes(targetShip.id)}
        defenderStatusAfter={move.targetAfter ?? null}
        soundOnceKey={soundOnceKey}
        background={background}
        attackerInNebula={!!blockedGrid?.[move.to.row]?.[move.to.col]}
        defenderInNebula={!!targetPos && !!blockedGrid?.[targetPos.row]?.[targetPos.col]}
      />,
      viewport,
    );
  }
  const attacker = move.to;
  const blow: KillingBlow =
    effect.kind === "ram"
      ? { kind: "ram" }
      : effect.kind === "main"
        ? { kind: "weapon", mainWeapon: effect.mainWeapon, variant: effect.variant, distanceCells }
        : { kind: "other" };

  let weapon: React.ReactNode = null;
  const common = { gridContainerRef, soundOnceKey };
  switch (effect.kind) {
    case "main": {
      if (!targetPos) break;
      const aim = {
        ...common,
        attackerRow: attacker.row,
        attackerCol: attacker.col,
        targetRow: targetPos.row,
        targetCol: targetPos.col,
        facingRight: isCreator,
      };
      if (effect.mainWeapon === 0) weapon = <LaserShootingAnimation {...aim} variant={effect.variant} />;
      else if (effect.mainWeapon === 1) weapon = <RailgunShootingAnimation {...aim} variant={effect.variant} />;
      else if (effect.mainWeapon === 2) weapon = <MissileShootingAnimation {...aim} variant={effect.variant} />;
      else if (effect.mainWeapon === 3)
        weapon = effect.variant === 2 ? <MiningDrillAnimation {...aim} /> : <PlasmaShootingAnimation {...aim} />;
      break;
    }
    case "flak":
      weapon = (
        <FlakExplosionAnimation {...common} targetCells={cellsInManhattanRange(attacker, flakArrayRange(ship), grid)} />
      );
      break;
    case "lightning":
      weapon = (
        <LightningFieldAnimation
          {...common}
          originRow={attacker.row}
          originCol={attacker.col}
          range={lightningFieldRange(ship)}
        />
      );
      break;
    case "emp":
    case "repair":
    case "attackDrones": {
      if (!targetPos) break;
      const aim = {
        ...common,
        attackerRow: attacker.row,
        attackerCol: attacker.col,
        targetRow: targetPos.row,
        targetCol: targetPos.col,
      };
      weapon =
        effect.kind === "emp" ? (
          <EmpWaveAnimation {...aim} />
        ) : effect.kind === "repair" ? (
          <RepairDroneAnimation {...aim} />
        ) : (
          <AttackDroneAnimation {...aim} once />
        );
      break;
    }
    case "ram":
      weapon = (
        <RamAnimation
          gridContainerRef={gridContainerRef}
          fromRow={move.from.row}
          fromCol={move.from.col}
          toRow={move.to.row}
          toCol={move.to.col}
          victim={move.targetShipId ? (shipMap.get(move.targetShipId) ?? null) : null}
          victimIsCreator={!isCreator}
          playKey={soundOnceKey}
        />
      );
      break;
    case "retreat":
      weapon = (
        <>
          <WarpFieldCollapseAnimation {...common} row={move.from.row} col={move.from.col} />
          <FleeAnimation
            gridContainerRef={gridContainerRef}
            fromRow={move.from.row}
            fromCol={move.from.col}
            ship={ship}
            isCreator={isCreator}
          />
        </>
      );
      break;
    case "none":
      break;
  }

  return (
    <>
      {arrow}
      {weapon && (
        <div key={move.key} className="weapon-once absolute inset-0 pointer-events-none">
          {weapon}
        </div>
      )}
      {move.killsTarget && move.targetShipId ? (
        <ShipExplosionSound playKey={soundOnceKey} delayMs={shipExplosionDelayMs(blow)} />
      ) : null}
    </>
  );
}
