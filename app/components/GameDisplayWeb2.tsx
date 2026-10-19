"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import posthog from "posthog-js";
import {
  ActionType,
  Attributes,
  GRID_DIMENSIONS,
  getMainWeaponName,
  getSpecialName,
} from "../types/types";
import type { Web2GameDataView } from "../types/web2Game";
import { Web2Ship } from "../types/web2Ship";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useGetGame } from "../hooks/useGamesWeb2";
import { useGameShipsWeb2 } from "../hooks/useGameShipsWeb2";
import { useGameStreamWeb2 } from "../hooks/useGameStreamWeb2";
import { useGamePolling } from "../hooks/useGamePolling";
import { useMapWeb2 } from "../hooks/useMapWeb2";
import { gameStateSyncKey, isOlderGameState } from "../utils/normalizeGameDataView";
import { useDamageCalculation } from "../hooks/useDamageCalculation";
import { useTurnChangeAlertSound, useTurnTitleCue, playTurnAlertSound } from "../hooks/useTurnChangeAlertSound";
import { usePendingMove } from "../hooks/usePendingMove";
import { applyPendingMoveToGame, lastMoveKey, predictAoeEffect, type PendingMoveEffect } from "../utils/pendingMove";
import { lastMoveEndPosition } from "../utils/ramLastMove";
import { RoundStartModal } from "./RoundStartModal";
import { useOpeningLineReport } from "./useOpeningLineReport";
import { useRoundStartAnnouncement } from "../hooks/useRoundStartAnnouncement";
import { GameResultModal, type MissionLossReason } from "./GameResultModal";
import { RewardShipReceivedWeb2 } from "./rewardShips/RewardShipReceived";
import { resolveNodeContent, useNodeContentWeb2 } from "../hooks/useNodeContent";
import { inferVictoryReason } from "../utils/victoryReason";
import {
  useGameViewChromeLayout,
  gameViewSideChrome,
  GAME_VIEW_SIDE_ROOT_CLASS,
} from "../hooks/useGameViewChromeLayout";
import { useLandscapeMode } from "../hooks/useLandscapeMode";
import {
  useGameplayInteraction,
  type GameplayShip,
} from "../hooks/useGameplayInteraction";
import { apiMutate } from "../lib/apiMutate";
import { apiFetch } from "../lib/apiFetch";
import { getSpecialConfigWeb2, isAoeSpecialWeb2, isLightningFieldSpecial, isRepairDronesSpecial } from "../utils/specialConfigWeb2";
import { wouldDestroy, wouldEnterSos } from "../utils/calculateDamage";
import { requireShipValue } from "../utils/requireShipValue";
import { getFactionAbilityConfigWeb2 } from "../utils/factionAbilityConfigWeb2";
import { AI_USER_ID } from "../config/aiUser";
import { useAITurnLoopWeb2 } from "../hooks/useAITurnLoopWeb2";
import { GameBoardLayout } from "./GameBoardLayout";
import { GameGrid } from "./GameGrid";
import { GameGridTooltipHoveredCell } from "./GameGridTooltip";
import { ShipImageWeb2 } from "./ShipImageWeb2";
import { toShipCardDataWeb2 } from "../utils/toShipCardData";
import { GameScoreBox } from "./GameScoreBox";
import { GameTurnTimerPanel } from "./GameTurnTimerPanel";
import { RotateToLandscapePrompt, rotatePromptTurnLabel } from "./RotateToLandscapePrompt";
import {
  LandscapeBattleHeader,
  LandscapeRailTabs,
  LandscapeShipSheet,
  LandscapeStagedMove,
} from "./LandscapeBattleRail";
import { TurnCountdownProvider } from "./TurnCountdown";
import { GridHoverProvider } from "./GridHover";
import { GameFleetStatusCard } from "./GameFleetStatusCard";
import { GameFleetStatusPanel } from "./GameFleetStatusPanel";
import { GameFleetDetailsModal } from "./GameFleetDetailsModal";
import { GameFleetDetailShipCard } from "./GameFleetDetailShipCard";
import { GameTooltipShipCard } from "./GameTooltipShipCard";
import { gameFleetPanelLabel } from "../utils/gameFleetPanelLabel";
import {
  GameEvents,
  type GameEventsLastMove,
  type GameEventsShipInfo,
} from "./GameEvents";
import { GameLastMovePanel } from "./GameLastMovePanel";
import { GameReplayControls, GameReplayBanner } from "./GameReplayControls";
import { toGameScoreDataWeb2, toGameWinnerResultWeb2 } from "../utils/gameDisplayDataWeb2";
import { FleeSafetySwitch } from "./FleeSafetySwitch";
import { FleeConfirmButtonWeb2 } from "./FleeConfirmButtonWeb2";
import { STYLE_LABEL } from "../styles/fontStyles";
import { useMissionDialog } from "../hooks/useMissionDialog";
import {
  invalidateRoguelikeRunQueriesWeb2,
  resetRoguelikeRunQueriesWeb2,
  useRoguelikeRunWeb2,
} from "../hooks/useRoguelikeWeb2";
import { DialogLineCard, MissionDialogPanel } from "./MissionDialogPanel";
import { buildDialogSnapshot } from "../utils/missionDialog";
import type { DialogMission } from "../types/dialog";
import { gameModeOf, gameResultOf } from "../utils/analytics/gameEvents";
import { useTrackGameEnded } from "../hooks/useTrackGameEnded";
import { LANDSCAPE_BOARD_HEIGHT } from "../utils/landscapeBoard";

// Web2-mode counterpart to `GameDisplay.tsx`. Genuinely playable (grid
// interaction via the shared <GameGrid> and useGameplayInteraction hook,
// move/shoot/special/retreat/ram, turn/score/timer, fleet status, weapon
// selection, confirm, win banner, replay) — but a deliberately simpler
// first slice, not full pixel parity with the ~3900-line web3 file (no
// mobile action-sheet layout, no debug panel, no full replay/localStorage
// game-record machinery). See docs/merge-explore-traditional-plan.md.
//
// Unlike GameDisplay/SimulatedGameDisplay, no bigint boundary-adapter block
// is needed here — Web2GameDataView/Web2Ship are already number-native, so
// state hands straight to <GameGrid>.

const GRID_WIDTH = GRID_DIMENSIONS.WIDTH;
const GRID_HEIGHT = GRID_DIMENSIONS.HEIGHT;

interface GameDisplayWeb2Props {
  game: Web2GameDataView;
  onBack: () => void;
  refetch?: () => void;
  readOnly?: boolean;
  /** Open straight into the replay (the Battles inbox's Replay button). */
  startInReplay?: boolean;
}

function GameDisplayWeb2({
  game: initialGame,
  onBack,
  refetch,
  readOnly = false,
  startInReplay = false,
}: GameDisplayWeb2Props) {
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();

  const [selectedShipId, setSelectedShipId] = useState<number | null>(null);
  const [draggedShipId, setDraggedShipId] = useState<number | null>(null);
  // True from submit until the POST settles. The submitted proposal stays
  // up, locked, its button showing [...]; the ref is for handlers that run
  // before a re-render (see the guarded setters after useGameplayInteraction).
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = React.useRef(false);
  const [showReplay, setShowReplay] = useState(startInReplay);
  const [showFleetModal, setShowFleetModal] = useState(false);

  const gameViewRootRef = React.useRef<HTMLDivElement | null>(null);
  const gridContainerRef = React.useRef<HTMLDivElement | null>(null);
  const chromeLayout = useGameViewChromeLayout(gameViewRootRef, gridContainerRef);
  const chromeOnSide = chromeLayout === "side";
  const { isLandscapeMobile, requiresLandscapeMode, isPortraitTablet } = useLandscapeMode();
  const useSideLayout = chromeOnSide && !isLandscapeMobile;
  const sideChrome = gameViewSideChrome(isPortraitTablet);
  const [isMobileFleeOpen, setIsMobileFleeOpen] = useState(false);
  // Mirrors GameDisplay.tsx's mobileLeftPanelTab — landscape-mobile's narrow
  // left column switches between these instead of showing everything at
  // once (there's no room). A selected ship's orders open in the ship sheet
  // over the column (LandscapeShipSheet), as in web3.
  const [mobileLeftPanelTab, setMobileLeftPanelTab] = useState<"status" | "actions" | "events">("status");

  const gameId = Number(initialGame.metadata.gameId);

  const { data: gameData, refetch: refetchGame } = useGetGame(gameId);
  const latestGameDataRef = React.useRef(initialGame);
  const gameSyncKeyRef = React.useRef(gameStateSyncKey(initialGame));
  const incomingGame = gameData ?? latestGameDataRef.current;
  const incomingSyncKey = gameStateSyncKey(incomingGame);
  // Never step back to an older read (see isOlderGameState).
  if (
    incomingSyncKey !== gameSyncKeyRef.current &&
    !isOlderGameState(incomingGame, latestGameDataRef.current)
  ) {
    gameSyncKeyRef.current = incomingSyncKey;
    latestGameDataRef.current = incomingGame;
  }
  // Server data. `game` (below) is this plus the predicted result of a
  // submitted move that hasn't landed yet — same as GameDisplay.tsx, see
  // usePendingMove.
  const chainGame = latestGameDataRef.current;
  const onPendingMoveResolvedRef = React.useRef<(() => void) | null>(null);
  const pendingMove = usePendingMove({
    chainLastMoveKey: lastMoveKey(chainGame.lastMove),
    isGameOver: chainGame.metadata.winner !== "",
    onResolved: () => onPendingMoveResolvedRef.current?.(),
  });
  const {
    capture: capturePendingMove,
    markSent: markPendingMoveSent,
    fail: failPendingMove,
  } = pendingMove;
  const game = useMemo(
    () => applyPendingMoveToGame(chainGame, pendingMove.pendingMove, (n) => n),
    [chainGame, pendingMove.pendingMove],
  );

  // ── Replay ──────────────────────────────────────────────────────────────
  // Server-authoritative Prisma GameTurn history (vs. GameDisplay.tsx's
  // client-only localStorage GameRecord) — the one genuinely different data
  // source, per GameReplayControls.tsx's doc comment. Step/autoplay state
  // and the replaySnapshotGame -> displayGame -> aliveShipPositions swap
  // below all mirror GameDisplay.tsx's own replayStep/replaySnapshotGame/
  // displayGame exactly, so replayed ship positions actually show on the
  // grid instead of only a text summary.
  const [replayData, setReplayData] = useState<{
    initialState: Web2GameDataView;
    turns: Array<{ id: number; round: number; snapshot: Web2GameDataView | null }>;
  } | null>(null);
  const [replayStep, setReplayStep] = useState<number | null>(null);
  const [replayAutoPlay, setReplayAutoPlay] = useState(false);
  const replayAutoPlayRef = React.useRef(false);

  React.useEffect(() => {
    if (!showReplay) {
      setReplayData(null);
      setReplayStep(null);
      setReplayAutoPlay(false);
      return;
    }
    let cancelled = false;
    apiFetch<typeof replayData>(`/api/games/${gameId}/replay`).then((res) => {
      if (cancelled) return;
      setReplayData(res);
      if (res && res.turns.length > 0) setReplayStep(-1);
    });
    return () => {
      cancelled = true;
    };
  }, [showReplay, gameId]);

  React.useEffect(() => {
    replayAutoPlayRef.current = replayAutoPlay;
  }, [replayAutoPlay]);
  React.useEffect(() => {
    if (!replayAutoPlay || !replayData) return;
    const total = replayData.turns.length;
    if (total === 0) return;
    const timer = setInterval(() => {
      if (!replayAutoPlayRef.current) {
        clearInterval(timer);
        return;
      }
      setReplayStep((s) => {
        if (s === null) return s;
        if (s >= total - 1) {
          replayAutoPlayRef.current = false;
          setReplayAutoPlay(false);
          return s;
        }
        return s + 1;
      });
    }, 1200);
    return () => clearInterval(timer);
  }, [replayAutoPlay, replayData?.turns.length]);

  const isReplaying = replayStep !== null && !!replayData && replayData.turns.length > 0;
  const replaySnapshotGame: Web2GameDataView | null = isReplaying
    ? replayStep! < 0
      ? replayData!.initialState
      : (replayData!.turns[replayStep!]?.snapshot ?? null)
    : null;
  const displayGame = replaySnapshotGame ?? game;

  useGameStreamWeb2(gameId, !readOnly);

  const { ships: gameShips } = useGameShipsWeb2(gameId);

  const shipMap = useMemo(() => {
    const map = new Map<number, Web2Ship>();
    gameShips.forEach((s) => map.set(s.id, s));
    return map;
  }, [gameShips]);

  // GameEvents.tsx is number/string-native — build a string-keyed view of
  // shipMap for it here rather than changing shipMap's own number keys.
  const gameEventsShipMap = useMemo(() => {
    const map = new Map<string, GameEventsShipInfo>();
    shipMap.forEach((ship, id) => {
      map.set(String(id), {
        name: ship.name,
        owner: ship.owner,
        equipment: { special: ship.equipment.special },
      });
    });
    return map;
  }, [shipMap]);

  // Adapter for `useGameplayInteraction`'s ownership-aware ship shape (see
  // that hook's doc) — cheap here since web2's Web2Ship is already number-id.
  const gameplayShipMap = useMemo(() => {
    const map = new Map<number, GameplayShip>();
    shipMap.forEach((ship, id) =>
      map.set(id, {
        id: ship.id,
        owner: ship.owner,
        equipment: ship.equipment,
        traits: { variant: Number(ship.traits.variant) },
      }),
    );
    return map;
  }, [shipMap]);

  const { blockedGrid, scoringGrid, onlyOnceGrid, impassableGrid } = useMapWeb2(
    game.mapId,
    game.gridDimensions.gridWidth,
    game.gridDimensions.gridHeight,
  );

  const shipIdsRef = React.useRef(game.shipIds);
  const shipAttributesRef = React.useRef(game.shipAttributes);
  shipIdsRef.current = game.shipIds;
  shipAttributesRef.current = game.shipAttributes;
  const getShipAttributes = useCallback(
    (shipId: number): Attributes | null => {
      const idx = shipIdsRef.current.findIndex((id) => id === shipId);
      if (idx === -1 || !shipAttributesRef.current[idx]) return null;
      return shipAttributesRef.current[idx];
    },
    [],
  );

  const movedShipIdsSet = useMemo(() => {
    const set = new Set<number>();
    game.creatorMovedShipIds.forEach((id) => set.add(id));
    game.joinerMovedShipIds.forEach((id) => set.add(id));
    return set;
  }, [game.creatorMovedShipIds, game.joinerMovedShipIds]);

  const aliveShipPositions = useMemo(
    () => displayGame.shipPositions.filter((p) => (p.status ?? 0) === 0),
    [displayGame.shipPositions],
  );

  // Matches web3's isMyTurnEffective: no acting again until a sent move lands.
  const isCurrentPlayerTurn =
    !readOnly && game.turnState.currentTurn === userId && !pendingMove.isAwaitingSync;
  // Mirrors GameDisplay.tsx: once the flee request succeeds the game is a
  // loss, so the result screen shows straight away instead of the board.
  const [didFlee, setDidFlee] = useState(false);
  const serverWinnerResult = toGameWinnerResultWeb2(game.metadata.winner, userId);
  const gameWinnerResult = serverWinnerResult ?? (didFlee ? "opponent" : null);
  const isGameOver = gameWinnerResult !== null;

  // Vs-AI games are regular Game rows where the joiner is the AI sentinel
  // user — same read shape as PvP, just a different currentTurn id to watch
  // for. Mirrors GameDisplay.tsx's isVsAIGame/isAITurn. A Campaign mission or
  // Roguelike combat node is a *subset* of this (see isSinglePlayerGame/
  // isRoguelikeGame below) — a plain vs-AI skirmish lobby is neither.
  const isVsAIGame = game.metadata.joiner === AI_USER_ID;
  const isAITurn = isVsAIGame && game.turnState.currentTurn === AI_USER_ID;
  // Mirrors GameDisplay.tsx's isSinglePlayerGame/isRoguelikeGame split (there
  // driven by which orchestrator contract owns the match; here driven by
  // which Lobby field the game's originating lobby was tagged with) — only
  // used to route GameResultModal's "Return to X" CTA and mission copy.
  const isSinglePlayerGame = isVsAIGame && game.metadata.campaignNodeId != null;
  const isRoguelikeGame = isVsAIGame && game.metadata.roguelikeRunId != null;
  // Analytics: game_ended once when this match finishes while watched.
  const analyticsGameMode = gameModeOf({ isRoguelikeGame, isSinglePlayerGame, isVsAIGame });
  useTrackGameEnded({
    appMode: "web2",
    gameMode: analyticsGameMode,
    gameId: game.metadata.gameId,
    result: gameResultOf(gameWinnerResult),
    retreated: didFlee,
    round: Number(game.turnState.currentRound),
    enabled: !readOnly,
  });
  // Mirrors GameDisplay.tsx: PvP and roguelike can flee (a roguelike flee
  // ends the whole run); the campaign has no flee.
  const canFlee = !isVsAIGame || isRoguelikeGame;
  const fleeConsequence = isRoguelikeGame
    ? (
        <>
          This action is irreversible. The engagement will be recorded as a loss and{" "}
          <span className="text-warning-red">your run will end</span>.
        </>
      )
    : undefined;

  const aiTurnLoop = useAITurnLoopWeb2({
    gameId,
    isAITurn,
    isGameOver,
    lastMoveSignal: game.lastMove ? `${game.lastMove.shipId}-${game.lastMove.timestamp}` : "",
    refetchGame: () => refetchGame(),
    gameMode: analyticsGameMode,
  });

  // "AI is taking its turn..." as a toast rather than a sticky banner over
  // the grid — mirrors GameDisplay.tsx. Fixed id so successive updates
  // (move count ticking up) replace the same toast instead of stacking.
  const aiTurnToastId = `ai-turn-${gameId}`;
  React.useEffect(() => {
    if (!isVsAIGame) return;
    if (aiTurnLoop.error) {
      toast.error(aiTurnLoop.error, { id: aiTurnToastId });
      return;
    }
    if (aiTurnLoop.isAIThinking) {
      toast.loading(
        `AI is taking its turn${
          aiTurnLoop.moveCount > 0 ? ` (move ${aiTurnLoop.moveCount})` : ""
        }...`,
        { id: aiTurnToastId },
      );
    } else {
      toast.dismiss(aiTurnToastId);
    }
  }, [
    isVsAIGame,
    aiTurnLoop.isAIThinking,
    aiTurnLoop.moveCount,
    aiTurnLoop.error,
    aiTurnToastId,
  ]);

  // Don't leave the loading toast stuck on screen after leaving this game.
  React.useEffect(() => {
    return () => {
      toast.dismiss(aiTurnToastId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track previous turn state — passed into useTurnChangeAlertSound below as
  // an external ref so the optimistic-move-confirmed effect further down can
  // stamp it directly (see that effect's "still my turn" comment for why).
  const prevTurnRef = React.useRef<boolean | null>(null);

  // Play alert sound when it becomes the player's turn (turn changes from
  // opponent to player only).
  useTurnChangeAlertSound(isCurrentPlayerTurn, userId, readOnly, prevTurnRef);
  useTurnTitleCue(isCurrentPlayerTurn, !readOnly && !!userId && !isGameOver);

  // Round-start announcement — mirrors GameDisplay.tsx's roundStartInfo:
  // fires on the very first render (game start) and again whenever
  // currentRound changes (new round). Gated on !isGameOver so the last
  // round's end doesn't pop this alongside the result screen. Also captures
  // each side's round-only score gain by diffing against a snapshot taken
  // the last time a round started — undefined on the very first showing.
  const prevRoundScoreRef = React.useRef<{ myScore: number; opponentScore: number } | undefined>(
    undefined,
  );
  const { roundStartInfo, handleCloseRoundStart } = useRoundStartAnnouncement(
    gameId,
    game.turnState.currentRound,
    isGameOver,
    () => {
      const isCreatorNow = game.metadata.creator === userId;
      const myScoreNow = isCreatorNow ? game.creatorScore : game.joinerScore;
      const opponentScoreNow = isCreatorNow ? game.joinerScore : game.creatorScore;
      const prevScores = prevRoundScoreRef.current;
      prevRoundScoreRef.current = { myScore: myScoreNow, opponentScore: opponentScoreNow };
      return {
        isMyTurnFirst: game.turnState.currentTurn === userId,
        myRoundScore: prevScores ? myScoreNow - prevScores.myScore : undefined,
        opponentRoundScore: prevScores ? opponentScoreNow - prevScores.opponentScore : undefined,
        myScore: myScoreNow,
        opponentScore: opponentScoreNow,
        maxScore: game.maxScore,
      };
    },
  );

  const [isGameResultDismissed, setIsGameResultDismissed] = useState(false);

  // In-mission dialog — mirrors GameDisplay.tsx. Campaign missions come from
  // the game's lobby tag; roguelike combat uses the run's current node, read
  // only for roguelike games.
  const { run: roguelikeRunForDialog } = useRoguelikeRunWeb2(isRoguelikeGame);
  const roguelikeDialogNodeId =
    isRoguelikeGame && roguelikeRunForDialog ? roguelikeRunForDialog.currentNodeId : 0;
  const campaignDialogNodeId = isSinglePlayerGame ? (game.metadata.campaignNodeId ?? 0) : 0;
  const dialogMission: DialogMission | null = useMemo(() => {
    if (campaignDialogNodeId > 0) return { kind: "campaign", nodeId: campaignDialogNodeId };
    if (roguelikeDialogNodeId > 0) return { kind: "roguelike", nodeId: roguelikeDialogNodeId };
    return null;
  }, [campaignDialogNodeId, roguelikeDialogNodeId]);
  // Confirmed data only: a pending move's predicted result must not fire
  // dialog lines (they'd stay fired even if the move then fails).
  const dialogSnapshot = useMemo(() => {
    const isCreatorNow = chainGame.metadata.creator === userId;
    return buildDialogSnapshot({
      round: chainGame.turnState.currentRound,
      myScore: isCreatorNow ? chainGame.creatorScore : chainGame.joinerScore,
      enemyScore: isCreatorNow ? chainGame.joinerScore : chainGame.creatorScore,
      ships: chainGame.shipPositions.map((p) => {
        const index = chainGame.shipIds?.findIndex((id) => id === p.shipId) ?? -1;
        return {
          id: String(p.shipId),
          isMine: p.isCreator === isCreatorNow,
          status: p.status,
          hullPoints: index >= 0 ? (chainGame.shipAttributes?.[index]?.hullPoints ?? null) : null,
          reactorLevel: index >= 0 ? (chainGame.shipAttributes?.[index]?.reactorCriticalTimer ?? null) : null,
          position: p.position,
        };
      }),
      scoringGrid,
      // Victory/defeat triggers; a draw is neither.
      outcome:
        gameWinnerResult === "me" ? "victory" : gameWinnerResult === "opponent" ? "defeat" : null,
    });
  }, [
    chainGame.metadata.creator,
    userId,
    chainGame.turnState.currentRound,
    chainGame.creatorScore,
    chainGame.joinerScore,
    chainGame.shipPositions,
    chainGame.shipIds,
    chainGame.shipAttributes,
    gameWinnerResult,
    scoringGrid,
  ]);
  const missionDialog = useMissionDialog({
    gameId: String(gameId),
    mission: dialogMission,
    snapshot: dialogSnapshot,
    // Stays on after the game ends so victory/defeat lines can play.
    enabled: !readOnly && !isReplaying,
    paused: roundStartInfo != null && !isGameOver,
    // New lines wait for the player's turn (and for a submitted move to
    // land), when they're looking at the board; a line already showing
    // stays put.
    holdNewLines: !isCurrentPlayerTurn && !isGameOver,
  });
  // The mission's opening line goes in the round report (as in the
  // tutorial) rather than the comms panel.
  const openingReport = useOpeningLineReport(
    missionDialog.openingLine,
    missionDialog.takeOpeningLine,
    handleCloseRoundStart,
  );
  // On the board while the game runs (and after the result screen is
  // dismissed); while the result screen is up, lines play inside it instead
  // (missionDebriefNode) since it covers the board.
  const missionDialogOverlay =
    (!isGameOver || isGameResultDismissed) &&
    (missionDialog.current || missionDialog.log.length > 0) ? (
      <MissionDialogPanel
        line={missionDialog.current}
        log={missionDialog.log}
        position={missionDialog.position}
        total={missionDialog.total}
        onAdvance={missionDialog.advance}
        onDismiss={missionDialog.dismissAll}
        compact={isLandscapeMobile}
        unreadCount={missionDialog.unreadCount}
        onLogOpened={missionDialog.markLogSeen}
      />
    ) : null;
  const missionDebriefNode = missionDialog.current ? (
    <DialogLineCard
      key={missionDialog.current.key}
      line={missionDialog.current}
      position={missionDialog.position}
      total={missionDialog.total}
      onAdvance={missionDialog.advance}
      onDismiss={missionDialog.dismissAll}
      compact={false}
    />
  ) : null;

  // Pre-resolved special range/data for the selected/dragged ship's equipped
  // special — a plain object lookup for web2 (no real contract-read hook
  // needed, unlike web3's useSpecialRangeAt/useSpecialStrengthAt), but still
  // computed before the shared hook call per its params contract. A
  // special's slot number is per-faction (see specialConfigWeb2.ts), so the
  // ship's own variant must come along with its equipped special.
  const selectedShip = selectedShipId != null ? shipMap.get(selectedShipId) : undefined;
  const selectedShipVariant = selectedShip
    ? requireShipValue("variant", selectedShip.traits.variant)
    : undefined;
  const selectedShipSpecialType = selectedShip
    ? Number(selectedShip.equipment.special)
    : 0;
  const selectedShipSpecialConfig =
    selectedShipVariant != null
      ? getSpecialConfigWeb2(selectedShipVariant, selectedShipSpecialType)
      : undefined;
  const selectedShipSpecialRange = selectedShipSpecialConfig?.range;
  const selectedShipSpecialData = useMemo(
    () =>
      selectedShipSpecialConfig != null
        ? { strength: selectedShipSpecialConfig.strength }
        : null,
    [selectedShipSpecialConfig],
  );
  const draggedShip = draggedShipId != null ? shipMap.get(draggedShipId) : undefined;
  const draggedShipVariant = draggedShip
    ? requireShipValue("variant", draggedShip.traits.variant)
    : undefined;
  const draggedShipSpecialType = draggedShip
    ? Number(draggedShip.equipment.special)
    : 0;
  const draggedShipSpecialRange =
    draggedShipVariant != null
      ? getSpecialConfigWeb2(draggedShipVariant, draggedShipSpecialType)?.range
      : undefined;

  // Every ship's innate faction ability (Ram/variant 1, Repair/variant 2) —
  // web2's own engine, so (unlike web3, which is chain-gated) this is
  // always supported.
  const selectedShipFactionAbility =
    selectedShipVariant != null
      ? getFactionAbilityConfigWeb2(selectedShipVariant)
      : undefined;

  const interaction = useGameplayInteraction({
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    shipMap: gameplayShipMap,
    getShipAttributes,
    allShipPositions: game.shipPositions,
    aliveShipPositions,
    movedShipIdsSet,
    playerAddress: userId,
    currentTurn: game.turnState.currentTurn,
    isGameOver,
    isCurrentPlayerTurn,
    isSubmitting,
    blockedGrid,
    impassableGrid,
    lastMove: game.lastMove ?? null,
    selectedShipId,
    setSelectedShipId,
    draggedShipId,
    setDraggedShipId,
    selectedShipSpecialRange,
    selectedShipSpecialData,
    draggedShipSpecialRange,
    selectedShipFactionAbilityRange: selectedShipFactionAbility?.range,
    selectedShipFactionAbilityIsHeal: selectedShipFactionAbility?.isHeal === true,
    isFactionAbilitySupported: true,
  });

  const {
    previewPosition,
    targetShipId,
    selectedWeaponType,
    dragOverCell,
    displayGrid,
    movementRange,
    shootingRange,
    validTargets,
    labelTargets,
    assistableTargets,
    assistableTargetsFromStart,
    dragValidTargets,
    dragShootingRange,
    isRammingMovePreview,
    isShowingProposedMove,
    isShipOwnedByCurrentPlayer,
    computedActionType,
    confirmWidgetLabel,
    showConfirmWidget,
    retreatPrepShipId,
    retreatPrepIsCreator,
    specialType,
    specialRange,
    specialData,
    handleCancelMove: clearProposal,
    handleGridRightClickDeselect: interactionRightClickDeselect,
    handleRetreatClick: interactionRetreatClick,
    buildActionPayload,
    recordOptimisticSos,
    clearOptimisticSos,
    optimisticSosShipIds,
    recordOptimisticDestroy,
    clearOptimisticDestroy,
    optimisticDestroyShipIds,
    setPreviewPosition: interactionSetPreviewPosition,
    setTargetShipId: interactionSetTargetShipId,
    setSelectedWeaponType: interactionSetWeaponType,
    setDragOverCell,
    getHoverPreview,
  } = interaction;

  // Player input can't cancel or change a submitted proposal while it's
  // locked; clearProposal (the submit lifecycle's own) still clears it.
  const handleCancelMove = useCallback(() => {
    if (!submitLockRef.current) clearProposal();
  }, [clearProposal]);
  const handleGridRightClickDeselect = useCallback(() => {
    if (!submitLockRef.current) interactionRightClickDeselect();
  }, [interactionRightClickDeselect]);
  const handleRetreatClick = useCallback(() => {
    if (!submitLockRef.current) interactionRetreatClick();
  }, [interactionRetreatClick]);
  const setPreviewPosition = useCallback(
    (position: { row: number; col: number } | null) => {
      if (!submitLockRef.current) interactionSetPreviewPosition(position);
    },
    [interactionSetPreviewPosition],
  );
  const setTargetShipId = useCallback(
    (id: number | null) => {
      if (!submitLockRef.current) interactionSetTargetShipId(id);
    },
    [interactionSetTargetShipId],
  );
  const setSelectedWeaponType = useCallback(
    (type: "weapon" | "special" | "ram") => {
      if (!submitLockRef.current) interactionSetWeaponType(type);
    },
    [interactionSetWeaponType],
  );
  const setSelectedShipIdForInput = useCallback((id: number | null) => {
    if (!submitLockRef.current) setSelectedShipId(id);
  }, []);
  const setDraggedShipIdForInput = useCallback((id: number | null) => {
    if (!submitLockRef.current) setDraggedShipId(id);
  }, []);

  // Escape deselects/cancels the current move — mirrors GameDisplay.tsx's
  // window keydown handler (mouse/tap deselect via handleGridRightClickDeselect
  // is shared, but the keyboard path itself needs its own listener per file).
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancelMove();
        setDraggedShipId(null);
        setDragOverCell(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCancelMove, setDragOverCell]);

  const calculateDamageForShip = useDamageCalculation({
    selectedShipId,
    getShipAttributes,
    selectedWeaponType,
    specialData,
    specialType,
    shipVariant: selectedShipVariant,
  });

  const recordPlayerMoveRef = React.useRef<(() => void) | null>(null);
  const { recordPlayerMove } = useGamePolling({
    gameId,
    turnTime: game.turnState.turnTime,
    gameData: chainGame,
    refetchGame,
    onRefetch: useCallback(() => setTargetShipId(null), [setTargetShipId]),
    // vs AI: a fixed fast post-move cadence, not one derived from the
    // stored turn time (as in GameDisplay).
    isSinglePlayerGame: isVsAIGame,
  });
  recordPlayerMoveRef.current = recordPlayerMove;

  const handleSubmitMove = useCallback(async () => {
    if (submitLockRef.current) return;
    const payload = buildActionPayload();
    if (!payload) return;
    if (interaction.ramActionError) {
      toast.error(interaction.ramActionError);
      return;
    }
    const current = aliveShipPositions.find((p) => p.shipId === payload.shipId)?.position;
    if (!current) return;
    const targetPosition =
      payload.targetShipId > 0
        ? (aliveShipPositions.find((p) => p.shipId === payload.targetShipId)?.position ?? null)
        : null;
    let effect: PendingMoveEffect = { kind: "none" };
    if (payload.actionType === ActionType.FactionAbility) {
      effect = selectedShipFactionAbility?.isHeal
        ? { kind: "heal", amount: selectedShipFactionAbility.strength ?? 0 }
        : { kind: "ram" };
    } else if (
      payload.actionType === ActionType.Special &&
      isAoeSpecialWeb2(selectedShipVariant ?? 1, payload.specialType)
    ) {
      // Flak Array / Electric Storm hit everything in range of the
      // destination, not a chosen target.
      if (specialRange != null && specialData?.strength != null) {
        effect = predictAoeEffect({
          kind: isLightningFieldSpecial(selectedShipVariant ?? 1, payload.specialType) ? "storm" : "flak",
          center: { row: payload.row, col: payload.col },
          range: specialRange,
          strength: specialData.strength,
          casterShipId: payload.shipId,
          positions: aliveShipPositions,
          getShipAttributes,
        });
      }
    } else if (
      payload.targetShipId > 0 &&
      (payload.actionType === ActionType.Shoot || payload.actionType === ActionType.Special)
    ) {
      const isSpecial = payload.actionType === ActionType.Special;
      const dmg = calculateDamageForShip(
        payload.targetShipId,
        isSpecial ? "special" : "weapon",
        payload.specialType === 3 ? true : undefined,
      );
      const targetAttrs = getShipAttributes(payload.targetShipId);
      if (wouldDestroy(dmg, targetAttrs)) {
        recordOptimisticDestroy([payload.targetShipId]);
      } else if (wouldEnterSos(dmg, targetAttrs)) {
        recordOptimisticSos([payload.targetShipId]);
      }
      effect =
        isSpecial && isRepairDronesSpecial(selectedShipVariant ?? 1, payload.specialType)
          ? { kind: "heal", amount: dmg.baseDamage }
          : { kind: "damage", reducedDamage: dmg.reducedDamage, reactorCritical: dmg.reactorCritical };
    }
    // Show the predicted result straight away (the POST is the "send"), with
    // the proposal locked and its button pending until the POST settles.
    submitLockRef.current = true;
    setIsSubmitting(true);
    const key = capturePendingMove({
      shipId: payload.shipId,
      actionType: payload.actionType,
      targetShipId: payload.targetShipId,
      row: payload.row,
      col: payload.col,
      current,
      targetPosition,
      getShipAttributes,
      effect,
      baselineLastMoveKey: lastMoveKey(chainGame.lastMove),
    });
    markPendingMoveSent(key);
    try {
      // buildActionPayload already returns ActionType.FactionAbility (with
      // the real target) for a ram/repair move — web2's engine implements
      // that action directly (see gameEngineWeb2.ts), no override needed.
      const newState = await apiMutate<Web2GameDataView>(`/api/games/${gameId}/action`, "POST", {
        shipId: payload.shipId,
        row: payload.row,
        col: payload.col,
        actionType: payload.actionType,
        targetShipId: payload.targetShipId,
        specialType: payload.specialType,
      });
      // The response is the new state; put it in the cache so the pending
      // move resolves now instead of on the next fetch. A GET that started
      // before the POST would land after this with the old board, so cancel
      // it first. The response lacks the lobby fields GET /api/games/[id]
      // attaches, so keep those from the cache.
      await queryClient.cancelQueries({ queryKey: ["gamesWeb2", gameId] });
      queryClient.setQueryData<Web2GameDataView>(["gamesWeb2", gameId], (prev) =>
        prev
          ? {
              ...newState,
              mapId: newState.mapId || prev.mapId,
              metadata: {
                ...newState.metadata,
                campaignNodeId: prev.metadata.campaignNodeId,
                roguelikeRunId: prev.metadata.roguelikeRunId,
              },
            }
          : newState,
      );
      // Success: retire the submitted proposal.
      submitLockRef.current = false;
      clearProposal();
      posthog.capture("game_move_submitted", {
        game_id: String(gameId),
        game_mode: analyticsGameMode,
        ship_id: String(payload.shipId),
        move_type: ActionType[payload.actionType] ?? String(payload.actionType),
        ...(payload.targetShipId ? { target_ship_id: String(payload.targetShipId) } : {}),
      });
      recordPlayerMoveRef.current?.();
      toast.success("Move submitted!");
      refetchGame();
      refetch?.();
    } catch (e) {
      // Back to no move entered.
      failPendingMove(key);
      submitLockRef.current = false;
      clearProposal();
      clearOptimisticSos();
      clearOptimisticDestroy();
      // isCurrentPlayerTurn dipped while submitting and flips back now,
      // which isn't a turn change, so no "your turn" cue.
      prevTurnRef.current = true;
      toast.error(e instanceof Error ? e.message : "Move failed");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    analyticsGameMode,
    interaction.ramActionError,
    buildActionPayload,
    aliveShipPositions,
    selectedShipFactionAbility,
    selectedShipVariant,
    specialRange,
    specialData,
    chainGame.lastMove,
    gameId,
    queryClient,
    capturePendingMove,
    markPendingMoveSent,
    failPendingMove,
    recordOptimisticSos,
    clearOptimisticSos,
    recordOptimisticDestroy,
    clearOptimisticDestroy,
    calculateDamageForShip,
    getShipAttributes,
    clearProposal,
    refetchGame,
    refetch,
  ]);

  // Optimistic last-move: mirrors GameDisplay.tsx's own local
  // A sent move landed in server data (usePendingMove resolved it). Still my
  // turn after it (a same-turn multi-move sequence): play the cue directly,
  // since isCurrentPlayerTurn's false->true flip as the pending move clears
  // would otherwise be the hook's only signal. Stamping the ref marks this as
  // handled so it isn't a double cue.
  onPendingMoveResolvedRef.current = () => {
    clearProposal();
    clearOptimisticSos();
    clearOptimisticDestroy();
    if (!readOnly && chainGame.turnState.currentTurn === userId) {
      playTurnAlertSound();
      prevTurnRef.current = true;
    }
  };

  // A submitted-but-unconfirmed move is already folded into `game`.
  const lastMove = isReplaying ? (replaySnapshotGame?.lastMove ?? undefined) : game.lastMove;
  const lastMoveShipId = lastMove?.shipId ?? null;
  const lastMoveOldPosition = useMemo(
    () => (lastMove ? { row: lastMove.oldRow, col: lastMove.oldCol } : null),
    [lastMove],
  );
  // Where the last mover ended up (a Ram ends on the victim's tile, not the
  // recorded one — see ramLastMove.ts).
  const lastMoveShipPositions = isReplaying ? replaySnapshotGame?.shipPositions : game.shipPositions;
  const lastMoveNewPosition = useMemo(
    () =>
      lastMove
        ? lastMove.newRow < 0 || lastMove.newCol < 0
          ? { row: lastMove.newRow, col: lastMove.newCol }
          : lastMoveEndPosition({
              lastMove,
              moverVariant: shipMap.get(lastMove.shipId)?.traits.variant,
              shipPositions: lastMoveShipPositions ?? [],
            })
        : null,
    [lastMove, shipMap, lastMoveShipPositions],
  );
  const lastMoveResolvedTo = useMemo(
    () =>
      lastMove && lastMoveNewPosition && lastMoveNewPosition.row >= 0 && lastMoveNewPosition.col >= 0
        ? { shipId: lastMove.shipId, row: lastMoveNewPosition.row, col: lastMoveNewPosition.col }
        : null,
    [lastMove, lastMoveNewPosition],
  );
  const lastMoveActionType = lastMove?.actionType ?? null;
  const lastMoveTargetShipId = lastMove?.targetShipId ?? null;
  const lastMoveIsCurrentPlayer = lastMove ? shipMap.get(lastMove.shipId)?.owner === userId : undefined;

  const gameEventsLastMove = useMemo<GameEventsLastMove | undefined>(
    () =>
      lastMove
        ? {
            shipId: String(lastMove.shipId),
            targetShipId: String(lastMove.targetShipId),
            oldRow: lastMove.oldRow,
            oldCol: lastMove.oldCol,
            newRow: lastMove.newRow,
            newCol: lastMove.newCol,
            actionType: lastMove.actionType,
          }
        : undefined,
    [lastMove],
  );

  const appendDestroyedTextToLastMove = useMemo(() => {
    if (!lastMove) return false;
    if (lastMove.targetShipId === 0) return false;
    const isTargetingAction =
      lastMove.actionType === ActionType.Shoot || lastMove.actionType === ActionType.Special;
    if (!isTargetingAction) return false;
    return !game.shipPositions.some((sp) => sp.shipId === lastMove.targetShipId);
  }, [lastMove, game.shipPositions]);

  const [isLastMovePanelMinimized, setIsLastMovePanelMinimized] = useState(false);
  const expandLastMovePanel = useCallback(
    () => setIsLastMovePanelMinimized(false),
    [],
  );
  const minimizeLastMovePanel = useCallback(
    () => setIsLastMovePanelMinimized(true),
    [],
  );

  const gameScoreData = useMemo(
    () => toGameScoreDataWeb2(game, userId),
    [
      game.creatorScore,
      game.joinerScore,
      game.maxScore,
      game.metadata.creator,
      userId,
    ],
  );
  const { myScore, opponentScore, maxScore } = gameScoreData;

  // End-of-game result screen (GameResultModal) — mirrors GameDisplay.tsx's
  // own isGameResultDismissed/missionLossReason/nodeId routing (isSinglePlayerGame/
  // isRoguelikeGame above). Also covers web2's tie outcome (WEB2_TIE_SENTINEL),
  // which web3's Game.sol can't produce at all.
  const { contentById: missionContentById, isLoading: missionContentLoading } =
    useNodeContentWeb2("CAMPAIGN");
  const missionLossReason: MissionLossReason | undefined =
    isVsAIGame && gameWinnerResult === "opponent"
      ? didFlee
        ? "fled"
        : opponentScore >= maxScore
        ? "enemyScore"
        : "fleetDestroyed"
      : undefined;
  const iAmCreatorForResult = game.metadata.creator === userId;
  const victoryReason =
    gameWinnerResult === "me"
      ? inferVictoryReason({
          myScore,
          maxScore,
          enemyShips: game.shipPositions
            .filter((p) => p.isCreator !== iAmCreatorForResult)
            .map((p) => ({
              status: p.status,
              hullPoints: getShipAttributes(p.shipId)?.hullPoints ?? null,
            })),
        })
      : undefined;
  const nodeIdForGame = game.metadata.campaignNodeId;
  const missionNodeContent =
    nodeIdForGame != null && nodeIdForGame > 0
      ? resolveNodeContent(missionContentById, nodeIdForGame, missionContentLoading)
      : undefined;
  const { contentById: roguelikeContentById, isLoading: roguelikeContentLoading } =
    useNodeContentWeb2("ROGUELIKE", roguelikeDialogNodeId > 0);
  // Campaign and roguelike missions show their title instead of the game
  // number — mirrors GameDisplay.tsx's gameTitleLabel.
  const gameTitleLabel = missionNodeContent
    ? missionNodeContent.title
    : roguelikeDialogNodeId > 0
      ? resolveNodeContent(roguelikeContentById, roguelikeDialogNodeId, roguelikeContentLoading).title
      : `Game ${game.metadata.gameId}`;
  const gameResultModalNode = isGameOver && !isGameResultDismissed && (
    <GameResultModal
      isVictory={gameWinnerResult === "me"}
      isTie={gameWinnerResult === "tie"}
      myScore={myScore}
      opponentScore={opponentScore}
      maxScore={maxScore}
      missionLossReason={missionLossReason}
      victoryReason={victoryReason}
      nodeId={
        isSinglePlayerGame && nodeIdForGame != null && nodeIdForGame > 0
          ? BigInt(nodeIdForGame)
          : undefined
      }
      nodeContent={missionNodeContent}
      comms={missionDebriefNode}
      rewardAction={
        // Mirrors GameDisplay.tsx: a won roguelike mission can mint the
        // node's reward ship, already constructed.
        isRoguelikeGame && gameWinnerResult === "me" && !readOnly ? (
          <RewardShipReceivedWeb2 lobbyId={game.metadata.lobbyId} nodeId={roguelikeDialogNodeId} />
        ) : undefined
      }
      onClose={() => setIsGameResultDismissed(true)}
      primaryActionLabel={
        isRoguelikeGame
          ? gameWinnerResult === "me"
            ? "Return to Run"
            : "Quit"
          : isSinglePlayerGame
            ? "Return to Campaign"
            : "Back to Games"
      }
      onPrimaryAction={() => {
        if (isRoguelikeGame) {
          // Any loss already ended the run; drop the cached run so the
          // Mission tab opens on the start-a-run screen.
          // A win refetches the run so the map shows the fleet's new hull.
          if (gameWinnerResult !== "me") resetRoguelikeRunQueriesWeb2(queryClient);
          else invalidateRoguelikeRunQueriesWeb2(queryClient);
          window.dispatchEvent(new CustomEvent("void-tactics-navigate-to-roguelike"));
          document.dispatchEvent(new CustomEvent("void-tactics-navigate-to-roguelike"));
        } else if (isSinglePlayerGame) {
          window.dispatchEvent(new CustomEvent("void-tactics-navigate-to-campaign"));
          document.dispatchEvent(new CustomEvent("void-tactics-navigate-to-campaign"));
        }
        onBack();
      }}
    />
  );

  const roundStartModalNode = roundStartInfo && !isGameOver && (
    <RoundStartModal
      key={roundStartInfo.round.toString()}
      round={roundStartInfo.round}
      isMyTurnFirst={roundStartInfo.isMyTurnFirst}
      myRoundScore={roundStartInfo.myRoundScore}
      opponentRoundScore={roundStartInfo.opponentRoundScore}
      myScore={roundStartInfo.myScore}
      opponentScore={roundStartInfo.opponentScore}
      maxScore={roundStartInfo.maxScore}
      note={openingReport.note}
      reporterId={openingReport.reporterId}
      onClose={openingReport.onClose}
    />
  );

  const turnTimeSec = game.turnState.turnTime;
  const turnStartTimeMs = game.turnState.turnStartTime;

  const [isClaimingTimeout, setIsClaimingTimeout] = useState(false);
  const handleClaimTimeout = useCallback(async () => {
    setIsClaimingTimeout(true);
    try {
      await apiMutate(`/api/games/${gameId}/timeout`, "POST");
      toast.success("Claimed win by timeout!");
      refetchGame();
      refetch?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setIsClaimingTimeout(false);
    }
  }, [gameId, refetchGame, refetch]);

  const renderShipCard = useCallback(
    (cell: GameGridTooltipHoveredCell) => {
      const ship = shipMap.get(cell.shipId);
      if (!ship) return null;
      const attrs = getShipAttributes(cell.shipId);
      return (
        <GameTooltipShipCard
          ship={toShipCardDataWeb2(ship)}
          shipImage={<ShipImageWeb2 ship={ship} className="h-full w-full" />}
          attributes={attrs || undefined}
          isCurrentPlayerShip={isShipOwnedByCurrentPlayer(cell.shipId)}
          flipShip={cell.isCreator}
          hasMoved={movedShipIdsSet.has(cell.shipId)}
          gridPosition={{ row: cell.row, col: cell.col }}
        />
      );
    },
    [shipMap, getShipAttributes, isShipOwnedByCurrentPlayer, movedShipIdsSet],
  );

  const renderFleetCard = (shipId: number, teamColor: string, flip: boolean) => {
    const ship = shipMap.get(shipId);
    const attrs = getShipAttributes(shipId);
    const shipPos = game.shipPositions.find((sp) => sp.shipId === shipId);
    return (
      <GameFleetStatusCard
        key={shipId}
        shipId={shipId}
        shipName={ship?.name ?? `#${shipId}`}
        attributes={attrs}
        hasMoved={movedShipIdsSet.has(shipId)}
        teamColor={teamColor}
        flip={flip}
        isSelected={selectedShipId === shipId}
        optimisticSos={optimisticSosShipIds.has(shipId)}
        shipImage={ship && <ShipImageWeb2 ship={ship} className="w-full h-full" showLoadingState={false} hideRankStars />}
        onClick={() => setSelectedShipIdForInput(shipId)}
        fleetHoverAnchor={
          shipPos
            ? {
                row: shipPos.position.row,
                col: shipPos.position.col,
                isCreator: shipPos.isCreator,
              }
            : null
        }
      />
    );
  };

  // Shared between the desktop/portrait render and the landscape-mobile
  // early return below — same grid, same props, only the surrounding layout
  // (side rail vs. narrow tabbed column) differs.
  const gameGridNode = (
    <GameGrid
      grid={displayGrid}
      allShipPositions={game.shipPositions}
      shipMap={shipMap}
      selectedShipId={selectedShipId}
      previewPosition={previewPosition}
      targetShipId={targetShipId}
      selectedWeaponType={selectedWeaponType}
      draggedShipId={draggedShipId}
      dragOverCell={dragOverCell}
      movementRange={movementRange}
      shootingRange={shootingRange}
      validTargets={validTargets}
      labelTargets={labelTargets}
      assistableTargets={assistableTargets}
      assistableTargetsFromStart={assistableTargetsFromStart}
      dragShootingRange={dragShootingRange}
      dragValidTargets={dragValidTargets}
      getHoverPreview={getHoverPreview}
      isCurrentPlayerTurn={isCurrentPlayerTurn}
      isShipOwnedByCurrentPlayer={isShipOwnedByCurrentPlayer}
      movedShipIdsSet={movedShipIdsSet}
      specialType={specialType}
      specialRange={specialRange}
      blockedGrid={blockedGrid}
      impassableGrid={impassableGrid}
      scoringGrid={scoringGrid}
      onlyOnceGrid={onlyOnceGrid}
      calculateDamage={calculateDamageForShip}
      getShipAttributes={getShipAttributes}
      optimisticSosShipIds={optimisticSosShipIds}
      optimisticDestroyShipIds={optimisticDestroyShipIds}
      isSubmitting={isSubmitting}
      disableTooltips={false}
      address={userId ?? undefined}
      currentTurn={game.turnState.currentTurn}
      lastMoveShipId={lastMoveShipId}
      lastMoveOldPosition={lastMoveOldPosition}
      lastMoveNewPosition={lastMoveNewPosition}
      lastMoveResolvedTo={lastMoveResolvedTo}
      lastMoveActionType={lastMoveActionType}
      lastMoveTargetShipId={lastMoveTargetShipId}
      lastMoveIsCurrentPlayer={lastMoveIsCurrentPlayer}
      isRammingMovePreview={isRammingMovePreview}
      isFactionAbilitySupported
      factionAbilityRange={selectedShipFactionAbility?.range}
      factionAbilityIsHeal={selectedShipFactionAbility?.isHeal === true}
      factionAbilityStrength={selectedShipFactionAbility?.strength}
      retreatPrepShipId={retreatPrepShipId}
      retreatPrepIsCreator={retreatPrepIsCreator}
      onGridRightClickDeselect={handleGridRightClickDeselect}
      setSelectedShipId={setSelectedShipIdForInput}
      setPreviewPosition={setPreviewPosition}
      setTargetShipId={setTargetShipId}
      setSelectedWeaponType={setSelectedWeaponType}
      setDraggedShipId={setDraggedShipIdForInput}
      setDragOverCell={setDragOverCell}
      showConfirmWidget={showConfirmWidget}
      confirmWidgetLabel={isSubmitting ? "[...]" : confirmWidgetLabel}
      onConfirmMove={handleSubmitMove}
      onCancelMove={handleCancelMove}
      renderShipCard={renderShipCard}
    />
  );

  // Battle-menu flee button overlaid on the grid corner — shown on its own
  // in landscape-mobile (no side header rail there to hold the flee switch)
  // and only when stacked/portrait in the main render (desktop side layout
  // already has FleeSafetySwitch in the header rail instead).
  const fleeMenuNode = !readOnly && !gameWinnerResult && canFlee && (
    <div className="pointer-events-none absolute right-1 top-1 z-[230]">
      <div className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setIsMobileFleeOpen((prev) => !prev)}
          className="flex h-7 w-7 items-center justify-center border border-solid text-xs font-bold"
          style={{
            borderColor: "var(--color-warning-red)",
            color: "var(--color-warning-red)",
            backgroundColor: "color-mix(in srgb, var(--color-near-black) 92%, transparent)",
            borderRadius: 0,
          }}
          title="Battle menu"
          aria-label="Open battle menu"
        >
          ⚑
        </button>
        {isMobileFleeOpen && (
          <div
            className="absolute right-0 top-[calc(100%+6px)] w-[13.25rem] border border-solid p-1"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-near-black) 98%, transparent)",
              borderColor: "var(--color-warning-red)",
              borderRadius: 0,
            }}
          >
            <FleeSafetySwitch
              consequence={fleeConsequence}
              onFlee={async () => {
                setDidFlee(true);
                setIsMobileFleeOpen(false);
                // Background sync only — the result screen is already showing.
                void Promise.resolve(refetchGame());
                void Promise.resolve(refetch?.());
              }}
              renderConfirmButton={(onSuccess) => (
                <FleeConfirmButtonWeb2 gameId={gameId} onSuccess={onSuccess} />
              )}
            />
          </div>
        )}
      </div>
    </div>
  );

  const isCreatorMe = game.metadata.creator === userId;
  const myIds = isCreatorMe ? game.creatorActiveShipIds : game.joinerActiveShipIds;
  const enemyIds = isCreatorMe ? game.joinerActiveShipIds : game.creatorActiveShipIds;

  const fleetDetailsModalNode = showFleetModal && (() => {
    const buildFleetDetailCards = (
      shipIds: readonly number[],
      isCurrentPlayerShip: boolean,
      flipShip: boolean,
    ) =>
      shipIds.map((shipId) => {
        const shipPosition = game.shipPositions.find((sp) => sp.shipId === shipId);
        const attrs = getShipAttributes(shipId);
        const ship = shipMap.get(shipId);
        if (!shipPosition || !attrs || !ship) return null;
        return (
          <GameFleetDetailShipCard
            key={shipId}
            shipId={String(shipId)}
            ship={toShipCardDataWeb2(ship)}
            shipImage={<ShipImageWeb2 ship={ship} className="h-full w-full" />}
            attributes={attrs}
            isCurrentPlayerShip={isCurrentPlayerShip}
            flipShip={flipShip}
            hasMoved={movedShipIdsSet.has(shipId)}
          />
        );
      });

    return (
      <GameFleetDetailsModal
        show={true}
        onClose={() => setShowFleetModal(false)}
        myFleetLabel={gameFleetPanelLabel({
          isMine: true,
          sideIsCreator: isCreatorMe,
          readOnly,
        })}
        enemyFleetLabel={gameFleetPanelLabel({
          isMine: false,
          sideIsCreator: !isCreatorMe,
          readOnly,
        })}
        myFleetCards={buildFleetDetailCards(myIds, true, isCreatorMe)}
        enemyFleetCards={buildFleetDetailCards(enemyIds, false, !isCreatorMe)}
      />
    );
  })();

  // Same rotate-to-landscape gate as GameDisplay.tsx: this battle view
  // needs landscape space on a phone-sized viewport to be usable at all.
  if (requiresLandscapeMode) {
    return (
      <RotateToLandscapePrompt
        title={gameTitleLabel}
        round={game.turnState.currentRound}
        turnLabel={rotatePromptTurnLabel(gameWinnerResult, isCurrentPlayerTurn)}
        turnTone={gameWinnerResult ? "over" : isCurrentPlayerTurn ? "mine" : "theirs"}
        clock={isVsAIGame ? undefined : { turnTimeSec, turnStartTimeMs }}
        onBack={onBack}
      />
    );
  }


  // Mirrors GameDisplay.tsx's own isLandscapeMobile early return: a narrow
  // scrollable left column (compact header + status/events tabs + Fleets
  // button) next to the grid, rather than the sticky-full-header layout the
  // unified render below uses for wider/portrait viewports. Landscape phones
  // don't have room for both a tall header rail and the grid at once.
  // Replay banner and controls over the board: desktop and landscape
  // (mirrors GameDisplay.tsx).
  const renderReplayOverlay = (): React.ReactNode => (
    <>
      {isReplaying && (
        <GameReplayBanner
          label={replayStep! < 0 ? "Replay · Start" : `Replay · Move ${replayStep! + 1}/${replayData!.turns.length}`}
        />
      )}
      {/* Replay controls (top-left, below the replay banner while it's
          showing). Same placement as GameDisplay.tsx; the bottom-left
          corner belongs to the comms panel. */}
      <div
        className={`absolute left-0 z-[225] pointer-events-none flex items-start ${
          showReplay ? "top-7" : "top-0"
        }`}
      >
        <div className="pointer-events-auto flex items-start gap-2 pt-1 pl-1">
          {!showReplay && (
            <button
              type="button"
              onClick={() => setShowReplay(true)}
              className="px-3 py-1 border-2 border-solid uppercase font-semibold tracking-wider text-xs transition-colors duration-150"
              style={{
                ...STYLE_LABEL,
                borderColor: "var(--color-steel)",
                color: "var(--color-text-secondary)",
                backgroundColor: "color-mix(in srgb, var(--color-near-black) 88%, transparent)",
                borderRadius: 0,
              }}
            >
              Replay
            </button>
          )}
          {showReplay && !replayData && (
            <div
              className="px-3 py-1 border-2 border-solid uppercase font-semibold tracking-wider text-xs"
              style={{
                ...STYLE_LABEL,
                borderColor: "var(--color-steel)",
                color: "var(--color-text-secondary)",
                backgroundColor: "color-mix(in srgb, var(--color-near-black) 88%, transparent)",
                borderRadius: 0,
              }}
            >
              Loading replay…
            </div>
          )}
          {showReplay && replayData && replayData.turns.length === 0 && (
            <div
              className="flex items-center gap-2 border-2 border-solid px-2 py-1 text-[11px]"
              style={{
                ...STYLE_LABEL,
                borderColor: "var(--color-warning-red)",
                color: "var(--color-warning-red)",
                backgroundColor: "color-mix(in srgb, var(--color-near-black) 88%, transparent)",
                borderRadius: 0,
              }}
            >
              <span>No moves recorded yet.</span>
              <button
                type="button"
                onClick={() => setShowReplay(false)}
                className="px-1.5 py-0.5 border border-solid"
                style={{ ...STYLE_LABEL, borderColor: "var(--color-warning-red)", color: "var(--color-warning-red)", backgroundColor: "transparent", borderRadius: 0 }}
              >
                ✕
              </button>
            </div>
          )}
          {showReplay && replayData && replayData.turns.length > 0 && (
            <GameReplayControls
              stepLabel={
                replayStep! < 0
                  ? "Start"
                  : `Move ${replayStep! + 1}/${replayData.turns.length} · Rd ${replayData.turns[replayStep!]?.round ?? ""}`
              }
              onPrev={() => setReplayStep((s) => (s === null ? null : Math.max(-1, s - 1)))}
              canPrev={(replayStep ?? -1) > -1}
              onNext={() => setReplayStep((s) => (s === null ? null : Math.min(replayData.turns.length - 1, s + 1)))}
              canNext={(replayStep ?? -1) < replayData.turns.length - 1}
              isPlaying={replayAutoPlay}
              onTogglePlay={() => setReplayAutoPlay((p) => !p)}
              onExit={() => setShowReplay(false)}
              extraInfo={
                replaySnapshotGame && (
                  <div className="w-full font-mono text-xs text-text-muted">
                    Score: {replaySnapshotGame.creatorScore} - {replaySnapshotGame.joinerScore} · Round{" "}
                    {replaySnapshotGame.turnState.currentRound}
                  </div>
                )
              }
            />
          )}
        </div>
      </div>
    </>
  );

  // Turn countdown and "Claim win (timeout)": the desktop header and the
  // landscape Status tab (mirrors GameDisplay.tsx).
  const renderTurnTimerPanel = (): React.ReactNode => {
    const isParticipant = !readOnly && (isCreatorMe || game.metadata.joiner === userId);
    // No timeout-claim vs AI: the AI turn loop is still actively
    // driving moves server-side even if it runs long, and racing a
    // forfeit-claim against an in-flight ai-turn call isn't worth
    // the complexity (mirrors GameDisplay.tsx's isVsAIGame
    // exclusion).
    // Mirrors GameDisplay.tsx: vs-AI turns are unlimited, so don't
    // show the "opponent can claim victory" warning for them.
    const timeoutEnabled = isParticipant && !isVsAIGame;
    return (
      <GameTurnTimerPanel
        timeoutEnabled={timeoutEnabled}
        showCountdown={!isVsAIGame}
        isMyTurn={isCurrentPlayerTurn}
        onResync={() => refetchGame()}
        claimTimeoutButton={
          <button
            type="button"
            onClick={handleClaimTimeout}
            disabled={isClaimingTimeout}
            className="px-3 py-1 uppercase font-semibold tracking-wider transition-colors duration-150 w-full h-full animate-timeout-soft"
          >
            {isClaimingTimeout ? "Claiming..." : "Claim win (timeout)"}
          </button>
        }
      />
    );
  };

  // The ship sheet over the landscape rail (shared with GameDisplay and the
  // tutorial): the ship, its staged move and targets, Retreat in its ⋯
  // menu and Cancel/Submit pinned at the bottom. The board's confirm popup
  // stays too, as in web3.
  const landscapeShipSheet = (() => {
    if (selectedShipId == null || !selectedShip) return null;
    const attrs = getShipAttributes(selectedShipId);
    const position = game.shipPositions.find((sp) => sp.shipId === selectedShipId);
    const from = { row: position?.position.row ?? 0, col: position?.position.col ?? 0 };
    const isOwn = isShipOwnedByCurrentPlayer(selectedShipId);
    const isDisabled = attrs?.hullPoints === 0;
    const isRetreating = isDisabled || computedActionType === ActionType.Retreat;
    const weaponLabel =
      selectedWeaponType === "ram"
        ? selectedShipFactionAbility?.isHeal
          ? "Repair"
          : "Ram"
        : selectedWeaponType === "special"
          ? getSpecialName(selectedShip.equipment.special, selectedShip.traits.variant)
          : getMainWeaponName(selectedShip.equipment.mainWeapon, selectedShip.traits.variant);
    const showMove = isOwn && isShowingProposedMove;
    return (
      <LandscapeShipSheet
        shipImage={<ShipImageWeb2 ship={selectedShip} className="h-full w-full" />}
        shipName={selectedShip.name || `Ship #${selectedShipId}`}
        hullPercent={attrs && attrs.maxHullPoints > 0 ? (attrs.hullPoints / attrs.maxHullPoints) * 100 : undefined}
        menuItems={
          showMove && !isRetreating
            ? [{ label: "Retreat", onClick: handleRetreatClick, tone: "danger" }]
            : []
        }
        onClose={() => setSelectedShipIdForInput(null)}
        footer={
          showMove ? (
            <div className="flex w-full min-w-0 flex-row gap-2">
              <button
                type="button"
                onClick={handleCancelMove}
                disabled={isSubmitting}
                className="min-w-0 flex-[1] border-2 border-solid px-1 py-1.5 text-xs font-semibold uppercase disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  ...STYLE_LABEL,
                  borderColor: "var(--color-gunmetal)",
                  borderTopColor: "var(--color-steel)",
                  borderLeftColor: "var(--color-steel)",
                  color: "var(--color-text-secondary)",
                  backgroundColor: "var(--color-slate)",
                  borderRadius: 0,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitMove}
                disabled={isSubmitting}
                className="min-w-0 flex-[2] border-2 border-solid px-1 py-1.5 text-xs font-semibold uppercase disabled:cursor-not-allowed"
                style={{
                  ...STYLE_LABEL,
                  borderColor: "var(--color-phosphor-green)",
                  color: "var(--color-phosphor-green)",
                  backgroundColor: "var(--color-steel)",
                  borderRadius: 0,
                }}
              >
                {isSubmitting ? "[...]" : confirmWidgetLabel}
              </button>
            </div>
          ) : null
        }
      >
        <div className="space-y-1">
          {showMove && (
            <LandscapeStagedMove
              from={from}
              to={previewPosition ?? from}
              retreating={isRetreating}
              weaponLabel={weaponLabel}
              targets={validTargets.map((target) => ({
                id: String(target.shipId),
                name: shipMap.get(target.shipId)?.name || `#${target.shipId}`,
              }))}
              selectedTargetId={targetShipId != null ? String(targetShipId) : null}
              repair={
                selectedWeaponType === "special" &&
                isRepairDronesSpecial(Number(selectedShip.traits.variant), specialType)
              }
              onSelectTarget={(id) => setTargetShipId(Number(id))}
            />
          )}
          {attrs && (
            <GameFleetDetailShipCard
              shipId={String(selectedShipId)}
              ship={toShipCardDataWeb2(selectedShip)}
              shipImage={<ShipImageWeb2 ship={selectedShip} className="h-full w-full" />}
              attributes={attrs}
              isCurrentPlayerShip={isOwn}
              flipShip={Boolean(position?.isCreator)}
              hasMoved={movedShipIdsSet.has(selectedShipId)}
            />
          )}
        </div>
      </LandscapeShipSheet>
    );
  })();

  if (isLandscapeMobile) {
    return (
      <TurnCountdownProvider turnTimeSec={turnTimeSec} turnStartTimeMs={turnStartTimeMs}>
      <GridHoverProvider>
      <div className="mx-auto h-full w-full overflow-hidden" style={{ height: "100dvh" }}>
        <div className="flex h-full min-h-0 items-stretch gap-2 overflow-hidden">
          <div className="flex h-full min-h-0 min-w-[12rem] flex-1 items-center justify-center">
            <div className="relative flex h-[min(100%,39rem)] min-h-0 w-full max-w-[18rem] flex-col pl-1 pr-2 py-2">
              <LandscapeBattleHeader
                onBack={onBack}
                round={game.turnState.currentRound}
                turnLabel={rotatePromptTurnLabel(gameWinnerResult, isCurrentPlayerTurn, true)}
                turnTone={gameWinnerResult ? "over" : isCurrentPlayerTurn ? "mine" : "theirs"}
                showClock={!isVsAIGame}
                myScore={Number(myScore)}
                opponentScore={Number(opponentScore)}
                maxScore={Number(maxScore)}
                menuItems={[{ label: "Sync", onClick: () => refetchGame() }]}
              />

              <LandscapeRailTabs
                tabs={["status", "actions", "events", "fleets"]}
                active={mobileLeftPanelTab}
                onSelect={(tab) => {
                  if (tab === "fleets") setShowFleetModal(true);
                  else if (tab === "status" || tab === "actions" || tab === "events") setMobileLeftPanelTab(tab);
                }}
              />

              <div className="min-h-0 flex-1 overflow-y-auto">
                {mobileLeftPanelTab === "status" ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="border border-solid px-1.5 py-1 text-xs" style={{ borderColor: "var(--color-gunmetal)", backgroundColor: "var(--color-near-black)" }}>
                        <span className="text-text-muted">Me </span>
                        <span className="font-mono text-white">{myScore}/{maxScore}</span>
                      </div>
                      <div className="border border-solid px-1.5 py-1 text-xs" style={{ borderColor: "var(--color-gunmetal)", backgroundColor: "var(--color-near-black)" }}>
                        <span className="text-text-muted">Opp </span>
                        <span className="font-mono text-white">{opponentScore}/{maxScore}</span>
                      </div>
                    </div>
                    {!isGameOver && renderTurnTimerPanel()}
                  </div>
                ) : null}
                {mobileLeftPanelTab === "actions" ? (
                  // A selected ship's orders open in the ship sheet below.
                  <div className="text-sm text-text-secondary">
                    Select a ship and choose a destination to open actions.
                  </div>
                ) : null}
                {mobileLeftPanelTab === "events" ? (
                  <GameEvents
                    lastMove={selectedShipId !== null ? undefined : gameEventsLastMove}
                    shipMap={gameEventsShipMap}
                    address={userId ?? undefined}
                    appendDestroyedText={appendDestroyedTextToLastMove}
                  />
                ) : null}
              </div>

              {landscapeShipSheet}
            </div>
          </div>

          <div
            // The board gives up width before the left column drops below
            // 12rem (small phones), shrinking to fit; see GameDisplay.
            className="relative min-h-0 shrink-0 self-center overflow-hidden"
            style={{ aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}`, paddingRight: "2px", paddingTop: "2px", height: LANDSCAPE_BOARD_HEIGHT }}
          >
            <div className="h-full max-h-full" style={{ height: "calc(100% - 2px)", width: "auto", aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}` }}>
              <GameBoardLayout isCurrentPlayerTurn={isCurrentPlayerTurn} containerRef={gridContainerRef} onBoardChromeMouseDown={handleCancelMove} overlay={missionDialogOverlay}>
                <div className="relative h-full [contain:layout]" style={{ aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}` }}>
                  <div className="absolute inset-0 min-h-0 overflow-hidden">
                    {gameGridNode}
                  </div>
                  {(isReplaying || isGameOver) && renderReplayOverlay()}
                  {fleeMenuNode}
                </div>
              </GameBoardLayout>
            </div>
          </div>
        </div>

        {fleetDetailsModalNode}
        {roundStartModalNode}
        {gameResultModalNode}
      </div>
      </GridHoverProvider>
      </TurnCountdownProvider>
    );
  }

  return (
    <TurnCountdownProvider turnTimeSec={turnTimeSec} turnStartTimeMs={turnStartTimeMs}>
    <GridHoverProvider>
    <div
      ref={gameViewRootRef}
      className={`flex flex-col gap-6 ${useSideLayout ? GAME_VIEW_SIDE_ROOT_CLASS : "mx-auto w-full"}`}
      style={useSideLayout ? { marginLeft: "8px" } : undefined}
    >
      <div
        className={
          useSideLayout
            ? sideChrome.row
            : "flex flex-col gap-4 pt-3"
        }
      >
        {/* Header rail (side layout) / header block (stacked mobile layout) — landscape-mobile never reaches here, see the early return above. */}
        <div
          className={
            useSideLayout
              ? sideChrome.rail
              : "flex flex-col gap-3 px-2"
          }
        >
          <div className="flex shrink-0 flex-col items-stretch gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex min-h-0 items-center justify-center px-4 py-2 border-2 border-solid uppercase font-semibold tracking-wider transition-colors duration-150"
              style={{ ...STYLE_LABEL, borderColor: "var(--color-gunmetal)", color: "var(--color-text-secondary)", backgroundColor: "var(--color-steel)", borderRadius: 0 }}
            >
              ← Back
            </button>
            <h1 className="text-2xl font-mono text-white flex items-center gap-3">
              <span>{gameTitleLabel}</span>
              <span className="text-text-muted text-base">Round {game.turnState.currentRound}</span>
            </h1>
            {!isGameOver && renderTurnTimerPanel()}
            <GameScoreBox score={gameScoreData} />
            {gameWinnerResult ? (
              <div
                className="border-2 border-solid px-3 py-2 text-center uppercase font-bold tracking-wider"
                style={{
                  ...STYLE_LABEL,
                  borderColor: gameWinnerResult === "me" ? "var(--color-phosphor-green)" : "var(--color-warning-red)",
                  color: gameWinnerResult === "me" ? "var(--color-phosphor-green)" : "var(--color-warning-red)",
                  borderRadius: 0,
                }}
              >
                {gameWinnerResult === "tie" ? "TIE" : gameWinnerResult === "me" ? "VICTORY" : "DEFEAT"}
              </div>
            ) : (
              !readOnly &&
              canFlee && (
                <FleeSafetySwitch
                  consequence={fleeConsequence}
                  onFlee={async () => {
                    setDidFlee(true);
                    // Background sync only — the result screen is already showing.
                    void Promise.resolve(refetchGame());
                    void Promise.resolve(refetch?.());
                  }}
                  renderConfirmButton={(onSuccess) => (
                    <FleeConfirmButtonWeb2 gameId={gameId} onSuccess={onSuccess} />
                  )}
                />
              )
            )}
          </div>

          {/* Fleet status panel */}
          <GameFleetStatusPanel
            myCount={myIds.length}
            enemyCount={enemyIds.length}
            onShowDetails={() => setShowFleetModal(true)}
            myCards={myIds.map((id) => renderFleetCard(id, "var(--color-cyan)", isCreatorMe))}
            enemyCards={enemyIds.map((id) => renderFleetCard(id, "var(--color-warning-red)", !isCreatorMe))}
            footer={
              <>
                {selectedShipId != null && isShipOwnedByCurrentPlayer(selectedShipId) && computedActionType !== ActionType.Retreat && (
                  <button
                    type="button"
                    onClick={handleRetreatClick}
                    className="mt-2 px-3 py-1.5 text-xs uppercase font-bold tracking-wider border-2 border-solid"
                    style={{ ...STYLE_LABEL, borderColor: "var(--color-warning-red)", color: "var(--color-warning-red)", backgroundColor: "transparent", borderRadius: 0 }}
                  >
                    Retreat
                  </button>
                )}
                {computedActionType === ActionType.Retreat && selectedShipId != null && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={handleSubmitMove}
                      disabled={isSubmitting}
                      className="flex-1 px-3 py-1.5 text-xs uppercase font-bold tracking-wider border-2 border-solid"
                      style={{ ...STYLE_LABEL, borderColor: "var(--color-warning-red)", color: "var(--color-warning-red)", backgroundColor: "color-mix(in srgb, var(--color-warning-red) 10%, transparent)", borderRadius: 0 }}
                    >
                      {isSubmitting ? "[...]" : "Confirm Retreat"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelMove}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 text-xs uppercase font-bold tracking-wider border-2 border-solid"
                      style={{ ...STYLE_LABEL, borderColor: "var(--color-gunmetal)", color: "var(--color-text-secondary)", borderRadius: 0 }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            }
          />

          {/* Fuller "Last Move" description — GameDisplay.tsx only surfaces
              this on mobile (a desktop-side-rail user has GameLastMovePanel's
              compact overlay instead); mirrored here the same way, gated on
              the stacked mobile layout. */}
          {!useSideLayout && (
            <GameEvents
              lastMove={selectedShipId !== null ? undefined : gameEventsLastMove}
              shipMap={gameEventsShipMap}
              address={userId ?? undefined}
              appendDestroyedText={appendDestroyedTextToLastMove}
            />
          )}
        </div>

        {/* Game grid */}
        <div className={useSideLayout ? sideChrome.board : "relative min-h-0 min-w-0 flex-1"}>
          <GameBoardLayout isCurrentPlayerTurn={isCurrentPlayerTurn} containerRef={gridContainerRef} onBoardChromeMouseDown={handleCancelMove} overlay={missionDialogOverlay}>
            <div className="relative w-full [contain:layout]" style={{ aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}` }}>
              <div className="absolute inset-0 min-h-0 overflow-hidden">
                {gameGridNode}
              </div>
              {!useSideLayout && fleeMenuNode}
            </div>
          </GameBoardLayout>
          <GameLastMovePanel
            isMinimized={isLastMovePanelMinimized}
            onExpand={expandLastMovePanel}
            onMinimize={minimizeLastMovePanel}
            lastMove={selectedShipId !== null ? undefined : gameEventsLastMove}
            shipMap={gameEventsShipMap}
            address={userId ?? undefined}
            appendDestroyedText={appendDestroyedTextToLastMove}
          />
          {renderReplayOverlay()}
        </div>
      </div>

      {fleetDetailsModalNode}
      {roundStartModalNode}
      {gameResultModalNode}
    </div>
    </GridHoverProvider>
    </TurnCountdownProvider>
  );
}

export default React.memo(GameDisplayWeb2);
