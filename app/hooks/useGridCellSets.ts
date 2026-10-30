import { useMemo } from "react";
import type { TutorialTargetTone } from "@/app/components/TutorialTarget";

/** How a tutorial highlight cell draws its brackets. */
export interface TutorialHighlightLook {
  tone: TutorialTargetTone;
  ripple: boolean;
}

const EMPTY_TILE_SET: Set<string> = new Set();
const EMPTY_ID_SET: Set<number> = new Set();

interface UseGridCellSetsParams {
  movementRange: readonly { row: number; col: number }[];
  shootingRange: readonly { row: number; col: number }[];
  effectiveShootingRange: readonly { row: number; col: number }[];
  validTargets: readonly { shipId: number }[];
  effectiveValidTargets: readonly { shipId: number }[];
  assistableTargets: readonly { shipId: number }[];
  assistableTargetsFromStart: readonly { shipId: number }[];
  tutorialHighlightCells?: readonly {
    row: number;
    col: number;
    tone?: TutorialTargetTone;
    ripple?: boolean;
  }[];
}

export function useGridCellSets({
  movementRange,
  shootingRange,
  effectiveShootingRange,
  validTargets,
  effectiveValidTargets,
  assistableTargets,
  assistableTargetsFromStart,
  tutorialHighlightCells,
}: UseGridCellSetsParams) {
  const movementTileSet = useMemo(
    () =>
      movementRange.length === 0
        ? EMPTY_TILE_SET
        : new Set(movementRange.map((p) => `${p.row},${p.col}`)),
    [movementRange],
  );
  const shootingTileSet = useMemo(
    () =>
      shootingRange.length === 0
        ? EMPTY_TILE_SET
        : new Set(shootingRange.map((p) => `${p.row},${p.col}`)),
    [shootingRange],
  );
  const effectiveShootingTileSet = useMemo(
    () =>
      effectiveShootingRange.length === 0
        ? EMPTY_TILE_SET
        : new Set(effectiveShootingRange.map((p) => `${p.row},${p.col}`)),
    [effectiveShootingRange],
  );
  const validTargetIdSet = useMemo(
    () =>
      validTargets.length === 0
        ? EMPTY_ID_SET
        : new Set(validTargets.map((t) => t.shipId)),
    [validTargets],
  );
  const effectiveValidTargetIdSet = useMemo(
    () =>
      effectiveValidTargets.length === 0
        ? EMPTY_ID_SET
        : new Set(effectiveValidTargets.map((t) => t.shipId)),
    [effectiveValidTargets],
  );
  const assistableTargetIdSet = useMemo(
    () =>
      assistableTargets.length === 0
        ? EMPTY_ID_SET
        : new Set(assistableTargets.map((t) => t.shipId)),
    [assistableTargets],
  );
  const assistableTargetsFromStartIdSet = useMemo(
    () =>
      assistableTargetsFromStart.length === 0
        ? EMPTY_ID_SET
        : new Set(assistableTargetsFromStart.map((t) => t.shipId)),
    [assistableTargetsFromStart],
  );
  const tutorialHighlightKeySet = useMemo(() => {
    if (!tutorialHighlightCells?.length) return null;
    // Cell key -> bracket color and ripple.
    return new Map<string, TutorialHighlightLook>(
      tutorialHighlightCells.map((p) => [
        `${p.row},${p.col}`,
        { tone: p.tone ?? "green", ripple: !!p.ripple },
      ]),
    );
  }, [tutorialHighlightCells]);

  return {
    movementTileSet,
    shootingTileSet,
    effectiveShootingTileSet,
    validTargetIdSet,
    effectiveValidTargetIdSet,
    assistableTargetIdSet,
    assistableTargetsFromStartIdSet,
    tutorialHighlightKeySet,
  };
}
