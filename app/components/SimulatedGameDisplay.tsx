"use client";
import { useOpenWalletSignIn } from "../hooks/useOpenWalletSignIn";
import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import defaultMap from "../../public/default_map.json";
import {
  TutorialContextValue,
  TutorialShipId,
  TutorialAction,
} from "../types/onboarding";
import {
  ALL_TUTORIAL_SHIPS,
  TUTORIAL_PLAYER_ADDRESS,
} from "../data/tutorialShips";
import {
  buildMapGridsFromDefaultMap,
  type DefaultMapShape,
} from "../utils/mapGridUtils";
import { toast } from "react-hot-toast";
import {
  ActionType,
  Attributes,
  Ship,
  LastMove,
  getMainWeaponName,
  getSpecialName,
  canonicalSpecialSlot,
  GRID_DIMENSIONS,
} from "../types/types";
import { GameGrid } from "./GameGrid";
import { GameGridTooltipHoveredCell } from "./GameGridTooltip";
import {
  toGridShipMap,
  toGridShipPositions,
  toGridTargets,
  toGridIdSet,
  displayIdToBigint,
} from "../utils/toGridDisplay";
import { TutorialGridTaskPanel } from "./TutorialGridTaskPanel";
import { RotateToLandscapePrompt, rotatePromptTurnLabel } from "./RotateToLandscapePrompt";
import {
  buildDisplayGrid,
  computeActionType,
  computeConfirmWidgetLabel,
  computeIsShowingProposedMove,
} from "../utils/gameplayDerived";
import {
  LandscapeBattleHeader,
  LandscapeRailTabs,
  LandscapeShipSheet,
  LandscapeStagedMove,
} from "./LandscapeBattleRail";
import { TutorialTarget } from "./TutorialTarget";
import { useConstructAfterMint } from "../hooks/useConstructAfterMint";
import {
  clearTutorialClaimCompletedCacheEntry,
  isTutorialClaimCompletedCached,
  persistTutorialClaimCompleted,
} from "../utils/tutorialCompletion";
import { GameBoardLayout } from "./GameBoardLayout";
import { MissionDialogPanel } from "./MissionDialogPanel";
import { useMissionDialog } from "../hooks/useMissionDialog";
import { buildDialogSnapshot } from "../utils/missionDialog";
import { lastMoveEndPosition } from "../utils/ramLastMove";
import type { DialogMission } from "../types/dialog";
import {
  GameEvents,
  type GameEventsLastMove,
  type GameEventsShipInfo,
} from "./GameEvents";
import {
  getScriptedStateForStepIndex,
  getScriptedStateForTutorialStepId,
} from "../data/tutorialScriptedStates";
import { FleeSafetySwitch } from "./FleeSafetySwitch";
import ShipCard from "./ShipCard";
import { ShipImage } from "./ShipImage";
import { toShipCardData } from "../utils/toShipCardData";
import { GameFleetStatusCard } from "./GameFleetStatusCard";
import { GridHoverProvider } from "./GridHover";
import { GameFleetStatusPanel } from "./GameFleetStatusPanel";
import { GameFleetDetailsModal } from "./GameFleetDetailsModal";
import { GameFleetDetailShipCard } from "./GameFleetDetailShipCard";
import {
  GAME_VIEW_SIDE_ROOT_CLASS,
  useGameViewChromeLayout,
  gameViewSideChrome,
} from "../hooks/useGameViewChromeLayout";
import { useSpecialRange } from "../hooks/useSpecialRange";
import {
  useSpecialData,
} from "../hooks/useShipAttributesContract";
import { buildEnemyOccupiedGrid } from "../utils/gameGridRanges";
import {
  computeMovementRange,
  computeShootingRange,
  computeValidTargets,
  computeLabelTargets,
  computeHoverValidTargets,
  computeHoverShootingRange,
} from "../utils/gameGridRangesWeb2";
import { isRepairDronesSpecial, shipHasActivatableSpecial } from "../utils/specialConfigWeb2";
import { useDamageCalculation } from "../hooks/useDamageCalculation";
import { STYLE_LABEL, STYLE_MONO } from "../styles/fontStyles";
import { useLandscapeMode } from "../hooks/useLandscapeMode";
import { useResetSelectionOnTurnChange } from "../hooks/useResetSelectionOnTurnChange";
import { useRetreatModeCancellation } from "../hooks/useRetreatModeCancellation";
import { RoundStartModal } from "./RoundStartModal";
import { useRoundStartAnnouncement } from "../hooks/useRoundStartAnnouncement";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import type { Abi } from "viem";
import { CONTRACT_ABIS, getContractAddresses } from "../config/contracts";
import { useSelectedChainId } from "../hooks/useSelectedChainId";
import { useAppMode } from "../hooks/useAppMode";
import {
  TUTORIAL_COMPLETION_CARD,
  TUTORIAL_NOT_ALLOWED,
  TUTORIAL_PANELS,
  isReportOnlyStep,
} from "../data/dialog/tutorial";
import { useSelfieCheckEligibility } from "../hooks/useSelfieCheckEligibility";
import { useSelfieCheckVerifyFlow } from "./SelfieCheckVerifyButton";
import { useSwitchToSelectedChainIfNeeded } from "../hooks/useSwitchToSelectedChainIfNeeded";
import { getLegacyGasPriceOverridesForWrite } from "../utils/legacyGasPriceForWrite";
import posthog from "posthog-js";
import {
  getTutorialGridPanelConfig,
  renderTutorialParagraphs,
  TUTORIAL_COMPLETION_SNIPER_PRIMARY_CTA_SUPPORTING,
  TUTORIAL_COMPLETION_RETREAT_PRIMARY_CTA_SUPPORTING,
  TUTORIAL_COMPLETION_CONTINUE_PRIMARY_CTA_SUPPORTING,
} from "./TutorialGridPanelConfigs";
import { LANDSCAPE_BOARD_HEIGHT } from "../utils/landscapeBoard";

const TUTORIAL_DIALOG_MISSION: DialogMission = { kind: "tutorial" };

interface SimulatedGameDisplayProps {
  tutorialContext: TutorialContextValue;
  /** Called when user clicks back; exits tutorial and returns to Info tab. */
  onBack?: () => void;
  /**
   * Opened as the first mission on the Operations map: after the reward,
   * the completion button closes the tutorial into fleet selection (via
   * onBack) instead of the hangar.
   */
  continueToFleetSelection?: boolean;
  /** The exit button's label: "Quit", or "Sign in" for a signed-out player. */
  exitLabel?: string;
}

function toMobileTouchCopy(text: string): string {
  return text
    .replace(/\bHover\b/g, "Tap")
    .replace(/\bhover\b/g, "tap")
    .replace(/\bClick\b/g, "Tap")
    .replace(/\bclick\b/g, "tap");
}

function mapNodeToMobileTouchCopy(node: React.ReactNode): React.ReactNode {
  if (typeof node === "string") {
    return toMobileTouchCopy(node);
  }
  if (Array.isArray(node)) {
    return node.map((child, idx) => {
      const key =
        React.isValidElement(child) && child.key != null
          ? String(child.key)
          : String(idx);
      return (
        <React.Fragment key={key}>{mapNodeToMobileTouchCopy(child)}</React.Fragment>
      );
    });
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    if (props.children === undefined) return node;
    return React.cloneElement(
      node as React.ReactElement,
      undefined,
      mapNodeToMobileTouchCopy(props.children),
    );
  }
  return node;
}

const GRID_WIDTH = GRID_DIMENSIONS.WIDTH;
const GRID_HEIGHT = GRID_DIMENSIONS.HEIGHT;
const EMPTY_HOVER_RANGE: Array<{ row: number; col: number }> = [];
const EMPTY_TUTORIAL_TARGETS: Array<{
  shipId: TutorialShipId;
  position: { row: number; col: number };
}> = [];
const EMPTY_HOVER_TARGETS: Array<{
  shipId: number;
  position: { row: number; col: number };
}> = [];

/**
 * Player ships whose cells get the **tutorial highlight** on step 3 (select-ship)
 * until the player selects a ship.
 */
const TUTORIAL_SELECT_SHIP_HIGHLIGHT_SHIP_IDS: readonly bigint[] = [
  1001n,
  1002n,
  1003n,
];

/** Enemy ships for tutorial highlight on step 4 (view-enemy) until one is selected. */
const TUTORIAL_VIEW_ENEMY_HIGHLIGHT_SHIP_IDS: readonly bigint[] = [
  2001n,
  2002n,
  2003n,
];

/** Sentinel (step 5 move-ship) until any ship is selected. */
const TUTORIAL_MOVE_SHIP_HIGHLIGHT_SHIP_IDS: readonly bigint[] = [1003n];

/** Resolute (step 7 score-points) until selected; allowed-move cells use step config. */
const TUTORIAL_SCORE_POINTS_HIGHLIGHT_SHIP_IDS: readonly bigint[] = [1001n];

/** Vigilant (step 8 shoot) until a ship is selected. */
const TUTORIAL_SHOOT_HIGHLIGHT_SHIP_IDS: readonly bigint[] = [1002n];

/** Hammer (step 8 shoot) after Vigilant's move is staged, until a shot target is chosen. */
const TUTORIAL_SHOOT_HIGHLIGHT_ENEMY_SHIP_IDS: readonly bigint[] = [2001n];

/** Resolute (step 10 special-emp) until a ship is selected. */
const TUTORIAL_SPECIAL_EMP_HIGHLIGHT_SHIP_IDS: readonly bigint[] = [1001n];

/** Anvil (step 10): pulse while arming with weapon first, or after Special if target cleared. */
const TUTORIAL_SPECIAL_EMP_HIGHLIGHT_TARGET_SHIP_IDS: readonly bigint[] = [
  2002n,
];

/** Resolute + Vigilant (step 12 rescue): both cells pulse for the whole step. */
const TUTORIAL_RESCUE_CHOICE_HIGHLIGHT_SHIP_IDS: readonly bigint[] = [
  1001n,
  1002n,
];

/** Hammer (step 12 rescue): pulse while Vigilant is selected and no shot target yet. */
const TUTORIAL_RESCUE_SNIPER_TARGET_HIGHLIGHT_SHIP_IDS: readonly bigint[] = [
  2001n,
];

/** Step 13 (rescue-outcome-sniper): Sentinel until selected; Hammer after center move is staged, optional shot. */
const TUTORIAL_RESCUE_OUTCOME_SNIPER_FIGHTER_HIGHLIGHT_SHIP_IDS: readonly bigint[] =
  [1003n];
const TUTORIAL_RESCUE_OUTCOME_SNIPER_ENEMY_HIGHLIGHT_SHIP_IDS: readonly bigint[] =
  [2001n];

function isTutorialEnemyFleetShipId(shipId: bigint): boolean {
  return TUTORIAL_VIEW_ENEMY_HIGHLIGHT_SHIP_IDS.some((id) => id === shipId);
}

export function SimulatedGameDisplay({
  tutorialContext,
  onBack,
  continueToFleetSelection = false,
  exitLabel = "Quit",
}: SimulatedGameDisplayProps) {
  // Web2 has no tutorial reward claim (that's TutorialClaim, web3), so from
  // the Operations map its completion button just continues.
  const continuesWithoutClaim = useAppMode() === "web2" && continueToFleetSelection;
  const { address } = useAccount();
  const openWalletSignIn = useOpenWalletSignIn();
  const activeChainId = useSelectedChainId();
  const publicClient = usePublicClient({ chainId: activeChainId });
  const switchToSelectedChainIfNeeded = useSwitchToSelectedChainIfNeeded();
  const contractAddresses = useMemo(
    () => getContractAddresses(activeChainId),
    [activeChainId],
  );
  const [pendingTutorialClaimPath, setPendingTutorialClaimPath] = useState<
    "win" | "loss" | null
  >(null);
  const {
    writeContract: writeTutorialClaim,
    isPending: isTutorialClaimPending,
    data: tutorialClaimHash,
    error: tutorialClaimWriteError,
  } = useWriteContract();

  // Gates completeTutorialWinPath/completeTutorialLossPath on Selfie Check
  // verification when TutorialClaim.eligibilityProvider is set. Already live:
  // that pointer is address(0), so tutorial claims stay fully open
  // (2026-09-26 combat-blocking doc §3). Checked before submitting.
  const tutorialSelfieCheckEligibility = useSelfieCheckEligibility("tutorialClaim", address);
  const isTutorialSelfieCheckBlocking =
    tutorialSelfieCheckEligibility.isEligible === false;
  const {
    openWidget: openSelfieCheckWidget,
    widgetElement: selfieCheckWidgetElement,
    isBusy: isSelfieCheckVerifying,
  } = useSelfieCheckVerifyFlow(address, () => {
    void tutorialSelfieCheckEligibility.refetchIsEligible();
  });

  const {
    gameState,
    currentStep,
    currentStepIndex,
    displayStepNumber,
    displayTotalSteps,
    isVisibleLastStep,
    isStepComplete,
    validateAction,
    executeAction,
    isStepHydrated,
    isConfirmingMove,
    pendingAction,
    nextStep,
    previousStep,
    resetTutorial,
  } = tutorialContext;

  const [claimCompleteCached, setClaimCompleteCached] = useState(false);

  useEffect(() => {
    if (!address) {
      setClaimCompleteCached(false);
      return;
    }
    setClaimCompleteCached(
      isTutorialClaimCompletedCached(activeChainId, address),
    );
  }, [activeChainId, address]);

  const isTutorialCompletionStep =
    currentStep?.id === "completion-retreat" ||
    currentStep?.id === "completion-sniper";

  const handleClearTutorialRewardCache = useCallback(() => {
    if (!address) {
      toast.error("Connect a wallet to clear the reward cache");
      return;
    }
    clearTutorialClaimCompletedCacheEntry(activeChainId, address);
    setClaimCompleteCached(false);
    toast.success("Cleared local tutorial reward / claim cache for this wallet");
  }, [activeChainId, address]);

  const tutorialClaimContractReady =
    !!contractAddresses.TUTORIAL_CLAIM &&
    contractAddresses.TUTORIAL_CLAIM !==
      "0x0000000000000000000000000000000000000000";

  const shouldReadTutorialCompletedFromChain = useMemo(
    () =>
      isTutorialCompletionStep &&
      !!address &&
      tutorialClaimContractReady &&
      !claimCompleteCached,
    [
      address,
      claimCompleteCached,
      isTutorialCompletionStep,
      tutorialClaimContractReady,
    ],
  );

  const tutorialCompletedReadConfig = useMemo(
    () => ({
      address: contractAddresses.TUTORIAL_CLAIM as `0x${string}`,
      abi: CONTRACT_ABIS.TUTORIAL_CLAIM as Abi,
      functionName: "tutorialCompleted" as const,
      args: address ? [address] : undefined,
      chainId: activeChainId,
      query: {
        enabled: shouldReadTutorialCompletedFromChain,
      },
    }),
    [
      activeChainId,
      address,
      contractAddresses.TUTORIAL_CLAIM,
      shouldReadTutorialCompletedFromChain,
    ],
  );

  const { data: tutorialCompletedOnChain } = useReadContract(
    tutorialCompletedReadConfig,
  );

  useEffect(() => {
    if (tutorialCompletedOnChain !== true) return;
    if (!address) return;
    persistTutorialClaimCompleted(activeChainId, address);
    setClaimCompleteCached(true);
  }, [tutorialCompletedOnChain, activeChainId, address]);

  const isTutorialRewardAlreadyClaimed =
    claimCompleteCached || tutorialCompletedOnChain === true;

  const tutorialClaimReceiptConfig = useMemo(
    () => ({
      hash: tutorialClaimHash,
      chainId: activeChainId,
    }),
    [tutorialClaimHash, activeChainId],
  );
  const {
    isLoading: isTutorialClaimConfirming,
    isSuccess: isTutorialClaimConfirmed,
    error: tutorialClaimReceiptError,
    data: tutorialClaimReceipt,
  } = useWaitForTransactionReceipt(tutorialClaimReceiptConfig);
  const constructAfterMint = useConstructAfterMint();

  useEffect(() => {
    if (!tutorialClaimWriteError) return;
    const message = tutorialClaimWriteError.message || "Transaction failed";
    if (
      message.includes("User rejected") ||
      message.includes("User denied") ||
      message.includes("rejected")
    ) {
      toast.error("Transaction declined by user");
    } else {
      toast.error("Tutorial claim failed");
    }
    setPendingTutorialClaimPath(null);
  }, [tutorialClaimWriteError]);

  useEffect(() => {
    if (!tutorialClaimReceiptError) return;
    toast.error("Tutorial claim transaction failed");
    setPendingTutorialClaimPath(null);
  }, [tutorialClaimReceiptError]);

  useEffect(() => {
    if (!isTutorialClaimConfirmed || !address) return;
    persistTutorialClaimCompleted(activeChainId, address);
    setClaimCompleteCached(true);
    toast.success("Tutorial reward claimed");
    setPendingTutorialClaimPath(null);
    // Build the reward ships now, while their construction window is open.
    if (tutorialClaimReceipt?.status === "success") void constructAfterMint(tutorialClaimReceipt);
    // Once per confirmed claim; constructAfterMint is stable per address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTutorialClaimConfirmed, activeChainId, address]);

  const runTutorialClaimTx = useCallback(
    async (
      path: "win" | "loss",
      functionName: "completeTutorialWinPath" | "completeTutorialLossPath",
    ) => {
      if (!address) {
        void openWalletSignIn();
        return;
      }
      if (isTutorialRewardAlreadyClaimed) {
        onBack?.();
        if (!continueToFleetSelection) {
          queueMicrotask(() =>
            window.dispatchEvent(
              new CustomEvent("void-tactics-navigate-to-manage-navy"),
            ),
          );
        }
        return;
      }
      if (
        !contractAddresses.TUTORIAL_CLAIM ||
        contractAddresses.TUTORIAL_CLAIM ===
          "0x0000000000000000000000000000000000000000"
      ) {
        toast.error("Tutorial claim is unavailable on this network");
        return;
      }
      if (isTutorialSelfieCheckBlocking) {
        toast.error("Verify with Selfie Check to claim this reward");
        return;
      }
      if (isTutorialClaimPending || isTutorialClaimConfirming) {
        return;
      }
      try {
        await switchToSelectedChainIfNeeded();
        setPendingTutorialClaimPath(path);
        posthog.capture("tutorial_reward_claim_submitted", {
          claim_path: path,
          reward_path:
            path === "win" ? "two_ships_win" : "three_ships_loss",
          completion_step_id: currentStep?.id,
          contract_function: functionName,
          chain_id: activeChainId,
        });
        writeTutorialClaim({
          address: contractAddresses.TUTORIAL_CLAIM as `0x${string}`,
          abi: CONTRACT_ABIS.TUTORIAL_CLAIM as Abi,
          functionName,
          chainId: activeChainId,
          ...(await getLegacyGasPriceOverridesForWrite(
            activeChainId,
            publicClient,
          )),
        });
      } catch {
        toast.error("Could not switch network or send transaction");
      }
    },
    [
      address,
      activeChainId,
      contractAddresses.TUTORIAL_CLAIM,
      continueToFleetSelection,
      currentStep?.id,
      isTutorialClaimPending,
      isTutorialClaimConfirming,
      isTutorialRewardAlreadyClaimed,
      isTutorialSelfieCheckBlocking,
      onBack,
      publicClient,
      switchToSelectedChainIfNeeded,
      writeTutorialClaim,
    ],
  );

  // For display we follow the main game and keep the selected ship ID as bigint
  // (so GameGrid behavior and animations are identical). When we need to talk
  // to tutorial state, we convert to/from TutorialShipId (string) at the edges.
  const [selectedShipId, setSelectedShipId] = useState<bigint | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [targetShipId, setTargetShipId] = useState<bigint | null>(null);
  const [selectedWeaponType, setSelectedWeaponType] = useState<
    "weapon" | "special" | "ram"
  >("weapon");
  const [weaponPreferenceByShipId, setWeaponPreferenceByShipId] = useState<
    Record<string, "weapon" | "special">
  >({});
  const [actionOverride, setActionOverride] = useState<ActionType | null>(null);
  const [retreatExplicitByShipId, setRetreatExplicitByShipId] = useState<
    Record<string, true>
  >({});

  // A submitted move just confirmed: clear its staging (the step usually
  // advances too, which clears it below anyway).
  const wasConfirmingRef = useRef(false);
  useEffect(() => {
    if (wasConfirmingRef.current && !isConfirmingMove) {
      setPreviewPosition(null);
      setTargetShipId(null);
      setSelectedShipId(null);
    }
    wasConfirmingRef.current = isConfirmingMove;
  }, [isConfirmingMove]);

  // Deselect all ships when moving between steps. Use layout effect so that
  // selection and previews are cleared before the new step is painted, which
  // avoids a single-frame flicker of the previous step's selection state.
  useLayoutEffect(() => {
    setSelectedShipId(null);
    setPreviewPosition(null);
    setTargetShipId(null);
    setWeaponPreferenceByShipId({});
    setRetreatExplicitByShipId({});
    setActionOverride(null);
  }, [currentStepIndex]);
  const [draggedShipId, setDraggedShipId] = useState<bigint | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [showFleetModal, setShowFleetModal] = useState(false);
  const [isLastMovePanelMinimized, setIsLastMovePanelMinimized] =
    useState(true);
  const [mobileLeftPanelTab, setMobileLeftPanelTab] = useState<
    "tutorial" | "status" | "actions" | "events"
  >("tutorial");
  const [isMobileFleetModalOpen, setIsMobileFleetModalOpen] = useState(false);
  const [isMobileFleeOpen, setIsMobileFleeOpen] = useState(false);
  const mobileTutorialScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileTutorialContentRef = useRef<HTMLDivElement | null>(null);
  const [mobileTutorialMoreBelow, setMobileTutorialMoreBelow] = useState(false);
  useEffect(() => {
    // Keep mobile tutorial chrome aligned with desktop: each step starts on the
    // tutorial briefing tab to avoid stale tab-specific highlights/copy.
    setMobileLeftPanelTab("tutorial");
  }, [currentStepIndex]);

  const gameViewRootRef = React.useRef<HTMLDivElement | null>(null);
  const gridContainerRef = React.useRef<HTMLDivElement | null>(null);
  const chromeLayout = useGameViewChromeLayout(
    gameViewRootRef,
    gridContainerRef,
  );
  const chromeOnSide = chromeLayout === "side";
  const { isLandscapeMobile, requiresLandscapeMode, isPortraitTablet } = useLandscapeMode();

  React.useEffect(() => {
    if (!isLandscapeMobile) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isLandscapeMobile]);

  const useSideLayout = chromeOnSide && !isLandscapeMobile;
  const sideChrome = gameViewSideChrome(isPortraitTablet);
  const proposedMoveTargetListClass = useSideLayout
    ? "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
    : "flex flex-wrap gap-2 min-h-[5rem]";
  const proposedMoveTargetBtnClass = useSideLayout
    ? "h-9 px-3 py-0 text-sm uppercase font-semibold tracking-wider transition-colors duration-150 flex w-full shrink-0 items-center justify-center"
    : "h-9 px-3 py-0 text-sm uppercase font-semibold tracking-wider transition-colors duration-150 flex items-center shrink-0";

  useRetreatModeCancellation({
    actionOverride,
    targetShipId: targetShipId != null ? Number(targetShipId) : null,
    previewPosition,
    selectedShipId: selectedShipId != null ? Number(selectedShipId) : null,
    setActionOverride,
    setRetreatExplicitByShipId,
  });

  // Mirror live game: whose turn it is comes from simulated state (e.g. after
  // end of round, opponent may go first).
  const isMyTurn =
    gameState.turnState.currentTurn.toLowerCase() ===
    TUTORIAL_PLAYER_ADDRESS.toLowerCase();

  const resetSelection = React.useCallback(() => {
    setSelectedShipId(null);
    setPreviewPosition(null);
    setTargetShipId(null);
    setActionOverride(null);
    setDraggedShipId(null);
    setDragOverCell(null);
    setRetreatExplicitByShipId({});
  }, []);
  useResetSelectionOnTurnChange(gameState.turnState.currentTurn, resetSelection);

  // Round-start announcement — mirrors GameDisplay.tsx's roundStartInfo:
  // fires on the very first render (game start) and again whenever
  // currentRound changes (new round). Also captures each side's round-only
  // score gain by diffing against a snapshot taken the last time a round
  // started — undefined on the very first showing (game start).
  const prevRoundScoreRef = React.useRef<{ myScore: number; opponentScore: number } | undefined>(
    undefined,
  );
  const { roundStartInfo, handleCloseRoundStart } = useRoundStartAnnouncement(
    "tutorial",
    gameState.turnState.currentRound,
    // The battle's over on the completion steps: no round report over the
    // result, same as a finished live game.
    currentStep?.id === "completion-retreat" || currentStep?.id === "completion-sniper",
    () => {
      const isCreatorNow =
        gameState.metadata.creator.toLowerCase() === TUTORIAL_PLAYER_ADDRESS.toLowerCase();
      const myScoreNow = isCreatorNow ? gameState.creatorScore : gameState.joinerScore;
      const opponentScoreNow = isCreatorNow ? gameState.joinerScore : gameState.creatorScore;
      const prevScores = prevRoundScoreRef.current;
      prevRoundScoreRef.current = { myScore: myScoreNow, opponentScore: opponentScoreNow };
      return {
        isMyTurnFirst:
          gameState.turnState.currentTurn.toLowerCase() === TUTORIAL_PLAYER_ADDRESS.toLowerCase(),
        myRoundScore: prevScores ? myScoreNow - prevScores.myScore : undefined,
        opponentRoundScore: prevScores ? opponentScoreNow - prevScores.opponentScore : undefined,
        myScore: myScoreNow,
        opponentScore: opponentScoreNow,
        maxScore: gameState.maxScore,
      };
    },
  );

  // A step with Bosch's words for the round report (data/dialog/tutorial.ts
  // roundReport, e.g. End of round) opens the report every time it's
  // entered, by Next or Prev, built from that step's board. It stands in for
  // the round-change report above, which only fires once per round per tab.
  const stepRoundReport =
    currentStep?.id && Object.hasOwn(TUTORIAL_PANELS, currentStep.id)
      ? TUTORIAL_PANELS[currentStep.id].roundReport
      : undefined;
  const [isStepReportOpen, setIsStepReportOpen] = useState(false);
  useEffect(() => {
    setIsStepReportOpen(!!stepRoundReport);
    // Only on entering a step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep?.id]);
  useEffect(() => {
    if (isStepReportOpen && roundStartInfo) handleCloseRoundStart();
  }, [isStepReportOpen, roundStartInfo, handleCloseRoundStart]);
  const stepReportNote = useMemo(
    () => (stepRoundReport ? renderTutorialParagraphs(stepRoundReport) : undefined),
    [stepRoundReport],
  );
  const stepReportInfo = useMemo(() => {
    if (!stepRoundReport) return null;
    const isCreatorNow =
      gameState.metadata.creator.toLowerCase() === TUTORIAL_PLAYER_ADDRESS.toLowerCase();
    const scoresOf = (state: { creatorScore: number | bigint; joinerScore: number | bigint }) => ({
      mine: Number(isCreatorNow ? state.creatorScore : state.joinerScore),
      theirs: Number(isCreatorNow ? state.joinerScore : state.creatorScore),
    });
    const round = Number(gameState.turnState.currentRound);
    // Scores when the previous round began: the earliest step before this
    // one that's still in that round.
    let roundStart: { mine: number; theirs: number } | undefined;
    for (let i = currentStepIndex - 1; i >= 0; i--) {
      const earlier = getScriptedStateForStepIndex(i);
      const earlierRound = Number(earlier.turnState.currentRound);
      if (earlierRound === round - 1) roundStart = scoresOf(earlier);
      else if (earlierRound < round - 1) break;
    }
    const now = scoresOf(gameState);
    return {
      round,
      isMyTurnFirst:
        gameState.turnState.currentTurn.toLowerCase() === TUTORIAL_PLAYER_ADDRESS.toLowerCase(),
      myRoundScore: roundStart ? now.mine - roundStart.mine : undefined,
      opponentRoundScore: roundStart ? now.theirs - roundStart.theirs : undefined,
      myScore: now.mine,
      opponentScore: now.theirs,
      maxScore: Number(gameState.maxScore),
    };
  }, [stepRoundReport, gameState, currentStepIndex]);

  // Map of onchain ship ID (bigint) to ship object. Tutorial IDs are strings;
  // when we need a ship we convert TutorialShipId -> bigint for this map only.
  // Fingerprint `tutorialShips.ts` content so HMR updates ship objects; `useMemo([])`
  // previously froze the first snapshot and hid equipment changes in ShipImage.
  const tutorialShipsFingerprint = JSON.stringify(
    ALL_TUTORIAL_SHIPS,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
  );
  /* eslint-disable react-hooks/exhaustive-deps -- fingerprint busts stale map when `tutorialShips.ts` HMRs */
  const shipMap = useMemo(() => {
    return new Map<bigint, Ship>(
      ALL_TUTORIAL_SHIPS.map((ship) => [ship.id, ship]),
    );
  }, [tutorialShipsFingerprint]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // GameEvents.tsx is number/string-native (shared with web2) — build a
  // string-keyed view of shipMap for it here rather than changing the
  // bigint-keyed shipMap used everywhere else.
  const gameEventsShipMap = useMemo(() => {
    const map = new Map<string, GameEventsShipInfo>();
    shipMap.forEach((ship, id) => {
      map.set(id.toString(), {
        name: ship.name,
        owner: ship.owner,
        equipment: { special: ship.equipment.special },
      });
    });
    return map;
  }, [shipMap]);

  const toGameEventsLastMove = useCallback(
    (lm: LastMove | undefined): GameEventsLastMove | undefined =>
      lm
        ? {
            shipId: lm.shipId.toString(),
            targetShipId: lm.targetShipId.toString(),
            oldRow: lm.oldRow,
            oldCol: lm.oldCol,
            newRow: lm.newRow,
            newCol: lm.newCol,
            actionType: lm.actionType,
          }
        : undefined,
    [],
  );

  // Create grids from default map (same format as real game map grids)
  const { blockedGrid, scoringGrid, onlyOnceGrid } = useMemo(
    () =>
      buildMapGridsFromDefaultMap(
        defaultMap as DefaultMapShape,
        GRID_WIDTH,
        GRID_HEIGHT,
      ),
    [],
  );

  // Get ship attributes by ship ID from game state (tutorial IDs are strings)
  const getShipAttributes = useCallback(
    (shipId: TutorialShipId | bigint): Attributes | null => {
      const idString = typeof shipId === "bigint" ? shipId.toString() : shipId;
      const shipIndex = gameState.shipIds?.findIndex((id) => id === idString);
      if (
        shipIndex === -1 ||
        !gameState.shipAttributes ||
        !gameState.shipAttributes[shipIndex]
      ) {
        return null;
      }
      return gameState.shipAttributes[shipIndex];
    },
    [gameState.shipAttributes, gameState.shipIds],
  );

  const allShipPositionsForGrid = useMemo(
    () =>
      gameState.shipPositions.map((shipPosition) => ({
        shipId: BigInt(shipPosition.shipId),
        position: shipPosition.position,
        isCreator: shipPosition.isCreator,
        isPreview: shipPosition.isPreview,
        status: shipPosition.status,
      })),
    [gameState.shipPositions],
  );

  const aliveShipPositions = useMemo(
    () =>
      gameState.shipPositions.filter(
        (shipPosition) => (shipPosition.status ?? 0) === 0,
      ),
    [gameState.shipPositions],
  );

  // Number-id views for the shared range functions (gameGridRangesWeb2.ts),
  // which the live games use too, so the tutorial's moves, ranges and
  // targets follow the same rules as a real battle.
  const rangeShipMap = useMemo(() => {
    const map = new Map<number, { owner: string }>();
    shipMap.forEach((ship, id) => map.set(Number(id), { owner: ship.owner }));
    return map;
  }, [shipMap]);
  const rangeAlivePositions = useMemo(
    () =>
      aliveShipPositions.map((p) => ({
        shipId: Number(p.shipId),
        position: p.position,
        isCreator: p.isCreator,
        status: p.status,
      })),
    [aliveShipPositions],
  );
  const getRangeAttributes = useCallback(
    (shipId: number) => getShipAttributes(BigInt(shipId)),
    [getShipAttributes],
  );
  // Enemy ships block the selected ship's line of sight (as in
  // useGameplayInteraction); disabled ones don't.
  const selectedEnemyOccupiedGrid = useMemo(() => {
    if (selectedShipId == null) return undefined;
    const acting = rangeAlivePositions.find((p) => p.shipId === Number(selectedShipId));
    if (!acting) return undefined;
    return buildEnemyOccupiedGrid(
      GRID_WIDTH,
      GRID_HEIGHT,
      rangeAlivePositions,
      acting.shipId,
      acting.isCreator,
      (id) => getRangeAttributes(Number(id))?.hullPoints === 0,
    );
  }, [selectedShipId, rangeAlivePositions, getRangeAttributes]);

  // Canonical lastMove when the live gameState might not match the scripted step.
  // destroy-disabled: a bad persisted snapshot can omit lastMove; fall back.
  const tutorialDisplayLastMove = useMemo(() => {
    if (currentStep?.id === "ship-destruction") {
      return (
        getScriptedStateForTutorialStepId("ship-destruction")?.lastMove ??
        gameState.lastMove
      );
    }
    if (currentStep?.id === "rescue") {
      return (
        getScriptedStateForTutorialStepId("rescue")?.lastMove ??
        gameState.lastMove
      );
    }
    if (currentStep?.id === "destroy-disabled" && !gameState.lastMove) {
      return (
        getScriptedStateForTutorialStepId("destroy-disabled")?.lastMove ??
        gameState.lastMove
      );
    }
    return gameState.lastMove;
  }, [currentStep?.id, gameState.lastMove]);

  // Get special range data for the selected ship
  const selectedShip = selectedShipId ? shipMap.get(selectedShipId) : null;
  const selectedShipVariant = selectedShip?.traits.variant ?? 0;
  const specialType = selectedShip
    ? canonicalSpecialSlot(selectedShipVariant, selectedShip.equipment.special)
    : 0;
  const { specialRange } = useSpecialRange(specialType, selectedShipVariant);
  const { data: specialData } = useSpecialData(specialType, selectedShipVariant);

  // Check if a ship belongs to the tutorial player. GameGrid passes bigint IDs,
  // so this matches the main game's signature and uses the bigint-based map.
  const isShipOwnedByCurrentPlayer = useCallback(
    (shipId: bigint): boolean => {
      const ship = shipMap.get(shipId);
      return ship ? ship.owner === TUTORIAL_PLAYER_ADDRESS : false;
    },
    [shipMap],
  );

  // Build a set of shipIds that have already moved this round (string IDs)
  const movedShipIdsSet = useMemo(() => {
    const set = new Set<TutorialShipId>();
    if (gameState.creatorMovedShipIds) {
      gameState.creatorMovedShipIds.forEach((id) => set.add(id));
    }
    if (gameState.joinerMovedShipIds) {
      gameState.joinerMovedShipIds.forEach((id) => set.add(id));
    }
    return set;
  }, [gameState.creatorMovedShipIds, gameState.joinerMovedShipIds]);

  // Track when we should show the proposed move / top action UI, mirroring the
  // main game's behavior: it appears as soon as you select one of your ships
  // that can act this round, even before choosing a destination.
  const isShowingProposedMove = useMemo(() => {
    const idString = selectedShipId?.toString() as TutorialShipId | undefined;
    return computeIsShowingProposedMove({
      hasSelection: selectedShipId !== null,
      isOwnShip: selectedShipId !== null && isShipOwnedByCurrentPlayer(selectedShipId),
      // Keep the panel visible while a submitted move confirms ([...]).
      isSubmitting: isConfirmingMove,
      isMyTurn,
      hasMoved: idString != null && movedShipIdsSet.has(idString),
      isDisabled: idString != null && getShipAttributes(idString)?.hullPoints === 0,
    });
  }, [
    selectedShipId,
    isMyTurn,
    isConfirmingMove,
    isShipOwnedByCurrentPlayer,
    movedShipIdsSet,
    getShipAttributes,
  ]);

  const isSelectedShipDisabled = useMemo(() => {
    if (!selectedShipId) return false;
    const attrs = getShipAttributes(selectedShipId);
    return !!attrs && attrs.hullPoints === 0;
  }, [selectedShipId, getShipAttributes]);

  const tutorialLastMoveGhostVisible = useMemo(
    () =>
      selectedShipId === null &&
      tutorialDisplayLastMove != null &&
      tutorialDisplayLastMove.shipId !== undefined,
    [selectedShipId, tutorialDisplayLastMove],
  );

  const setWeaponTypeFromGrid = useCallback(
    (type: "weapon" | "special" | "ram") => {
      if (selectedShipId != null && type !== "ram") {
        const idKey = selectedShipId.toString();
        setWeaponPreferenceByShipId((prev) => ({ ...prev, [idKey]: type }));
      }
      setSelectedWeaponType(type);
    },
    [selectedShipId],
  );

  useLayoutEffect(() => {
    if (selectedShipId === null) {
      if (!tutorialLastMoveGhostVisible) {
        setSelectedWeaponType("weapon");
      }
      return;
    }

    const idKey = selectedShipId.toString();
    const ship = shipMap.get(selectedShipId);
    const attrs = getShipAttributes(selectedShipId);
    if (attrs && attrs.hullPoints === 0) {
      setWeaponPreferenceByShipId((prev) => {
        if (prev[idKey] === "weapon") return prev;
        return { ...prev, [idKey]: "weapon" };
      });
      setSelectedWeaponType("weapon");
      return;
    }

    const canSpecial = shipHasActivatableSpecial(ship);
    const saved = weaponPreferenceByShipId[idKey] ?? "weapon";
    if (saved === "special" && !canSpecial) {
      setWeaponPreferenceByShipId((prev) => ({ ...prev, [idKey]: "weapon" }));
      setSelectedWeaponType("weapon");
      return;
    }
    setSelectedWeaponType(saved);
    // Restore only when the selected ship changes. Re-running on
    // shipMap / getShipAttributes / preference identity would overwrite a
    // ram/special switch as soon as the player locked a target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShipId, tutorialLastMoveGhostVisible]);

  /**
   * Pulse the Submit / Submit Retreat button (same idea as tutorial highlight)
   * when a tx step is ready to confirm: staged inputs present, dialog not open.
   */
  const shouldPulseSubmitMoveButton = useMemo(() => {
    if (
      !currentStep?.requiresTransaction ||
      !isShowingProposedMove ||
      isConfirmingMove
    ) {
      return false;
    }

    const stepId = currentStep.id;

    if (stepId === "special-emp") {
      const allowed =
        currentStep.allowedActions.useSpecial?.allowedTargets ?? [];
      return (
        selectedWeaponType === "special" &&
        targetShipId !== null &&
        allowed.includes(targetShipId.toString() as TutorialShipId)
      );
    }

    if (stepId === "shoot") {
      return previewPosition !== null && targetShipId !== null;
    }

    if (stepId === "rescue-outcome-sniper") {
      return (
        previewPosition !== null &&
        previewPosition.row === 5 &&
        previewPosition.col === 8
      );
    }

    if (stepId === "rescue") {
      if (!selectedShipId) return false;
      const sid = selectedShipId.toString() as TutorialShipId;
      if (sid === "1001") {
        return isSelectedShipDisabled;
      }
      if (sid === "1002") {
        return targetShipId !== null;
      }
      return false;
    }

    return previewPosition !== null;
  }, [
    currentStep,
    isShowingProposedMove,
    isConfirmingMove,
    previewPosition,
    targetShipId,
    selectedWeaponType,
    selectedShipId,
    isSelectedShipDisabled,
  ]);

  /** special-emp: after Anvil is targeted under Weapons, pulse the weapon/special dropdown. */
  const shouldHighlightSpecialEmpWeaponDropdown = useMemo(
    () =>
      currentStep?.id === "special-emp" &&
      selectedShipId?.toString() === "1001" &&
      selectedWeaponType === "weapon" &&
      targetShipId?.toString() === "2002",
    [currentStep?.id, selectedShipId, selectedWeaponType, targetShipId],
  );

  const isEnemyDisabledTutorialShipId = useCallback(
    (shipId: TutorialShipId): boolean => {
      const ship = shipMap.get(BigInt(shipId));
      if (!ship) return false;
      if (ship.owner === TUTORIAL_PLAYER_ADDRESS) return false;
      const attrs = getShipAttributes(shipId);
      if (!attrs) return false;
      return attrs.hullPoints === 0;
    },
    [shipMap, getShipAttributes],
  );

  // Mirror live-game retreat prep visual: when a disabled ship is selected on
  // the player's turn, show the in-cell retreat effect (flip + engine glow).
  // It stays on while a submitted Retreat confirms (the live game keeps its
  // selection until the turn changes), so the ship doesn't drop back to its
  // disabled art before the flee animation plays.
  const pendingRetreatShipId =
    isConfirmingMove &&
    pendingAction?.type === "moveShip" &&
    pendingAction.actionType === ActionType.Retreat &&
    pendingAction.shipId != null
      ? BigInt(pendingAction.shipId)
      : null;
  const retreatPrepShipId =
    pendingRetreatShipId ??
    (selectedShipId != null &&
    actionOverride === ActionType.Retreat &&
    isShipOwnedByCurrentPlayer(selectedShipId)
      ? selectedShipId
      : null);

  const retreatPrepIsCreator = useMemo(() => {
    if (retreatPrepShipId == null) return null;
    const ship = shipMap.get(retreatPrepShipId);
    return ship ? ship.owner === TUTORIAL_PLAYER_ADDRESS : null;
  }, [retreatPrepShipId, shipMap]);

  // Disabled ships: always Retreat. Healthy ships: Retreat only if the player chose it for that ship.
  useEffect(() => {
    if (selectedShipId === null) return;
    const attrs = getShipAttributes(selectedShipId);
    if (attrs && attrs.hullPoints === 0) {
      setActionOverride(ActionType.Retreat);
      setTargetShipId(null);
      setPreviewPosition(null);
      return;
    }
    setActionOverride(
      retreatExplicitByShipId[selectedShipId.toString()]
        ? ActionType.Retreat
        : null,
    );
  }, [selectedShipId, getShipAttributes, retreatExplicitByShipId]);

  // Check line of sight between two positions
  // Create a 2D array to represent the grid
  // The board's cells (shared with the live games' useGameplayInteraction).
  // The last move shows whenever no ship is selected.
  const grid = useMemo(() => {
    const lm = tutorialDisplayLastMove;
    const allPositions = gameState.shipPositions.map((p) => ({
      shipId: Number(p.shipId),
      position: p.position,
      isCreator: p.isCreator,
      isPreview: p.isPreview,
      status: p.status,
    }));
    // A stale persisted state can omit the Anvil's destroyed status at the
    // ship-destruction step; the scripted state still places it so the EMP
    // aftermath reads.
    const lmTarget = lm?.targetShipId ? Number(lm.targetShipId) : 0;
    if (
      currentStep?.id === "ship-destruction" &&
      lmTarget !== 0 &&
      !allPositions.some((p) => p.shipId === lmTarget && p.status === 1)
    ) {
      const scripted = getScriptedStateForTutorialStepId("ship-destruction")?.shipPositions.find(
        (p) => Number(p.shipId) === lmTarget,
      );
      if (scripted) {
        allPositions.push({
          shipId: lmTarget,
          position: scripted.position,
          isCreator: scripted.isCreator,
          isPreview: scripted.isPreview,
          status: 1,
        });
      }
    }
    return buildDisplayGrid({
      gridWidth: GRID_WIDTH,
      gridHeight: GRID_HEIGHT,
      aliveShipPositions: rangeAlivePositions,
      allShipPositions: allPositions,
      selectedShipId: selectedShipId != null ? Number(selectedShipId) : null,
      previewPosition,
      hidePreview: false,
      lastMove: lm
        ? {
            shipId: Number(lm.shipId),
            oldRow: lm.oldRow,
            oldCol: lm.oldCol,
            actionType: Number(lm.actionType) as ActionType,
            targetShipId: lmTarget,
          }
        : null,
      showLastMove: selectedShipId === null && lm != null && lm.shipId !== undefined,
    });
  }, [
    rangeAlivePositions,
    gameState.shipPositions,
    tutorialDisplayLastMove,
    selectedShipId,
    previewPosition,
    currentStep?.id,
  ]);

  // Calculate movement range for selected ship.
  // Mirrors the main GameDisplay logic, then applies tutorial step constraints.
  // Moving onto a disabled enemy is the tutorial's ram (the legacy rule the
  // shared hook keeps for chains without the FactionAbility system).
  const movementRange = useMemo(
    () =>
      computeMovementRange({
        gridWidth: GRID_WIDTH,
        gridHeight: GRID_HEIGHT,
        selectedShipId: selectedShipId != null ? Number(selectedShipId) : null,
        hasShips: rangeShipMap.size > 0,
        shipMap: rangeShipMap,
        getShipAttributes: getRangeAttributes,
        shipPositions: rangeAlivePositions,
        previewPosition,
        canEnterOccupiedCell: (_row, _col, occupyingShipId) =>
          BigInt(occupyingShipId) !== selectedShipId &&
          isEnemyDisabledTutorialShipId(String(occupyingShipId) as TutorialShipId),
      }),
    [selectedShipId, rangeShipMap, getRangeAttributes, rangeAlivePositions, previewPosition, isEnemyDisabledTutorialShipId],
  );

  const isRammingMovePreview = useMemo(() => {
    if (!selectedShipId || !previewPosition) return false;
    const occupyingShip = gameState.shipPositions.find(
      (pos) =>
        (pos.status ?? 0) === 0 &&
        pos.position.row === previewPosition.row &&
        pos.position.col === previewPosition.col &&
        pos.shipId !== selectedShipId.toString(),
    );
    if (!occupyingShip) return false;
    return isEnemyDisabledTutorialShipId(occupyingShip.shipId);
  }, [
    selectedShipId,
    previewPosition,
    gameState.shipPositions,
    isEnemyDisabledTutorialShipId,
  ]);

  useEffect(() => {
    if (!isRammingMovePreview) return;
    if (targetShipId === null) return;
    setTargetShipId(null);
  }, [isRammingMovePreview, targetShipId]);

  // In-grid confirm widget label — mirrors GameDisplay.tsx's computedActionType/
  // confirmWidgetLabel exactly (wide-layout parity; label only, does not
  // affect handleSubmitMove's own per-step branching below).
  const computedActionType = useMemo(
    () =>
      computeActionType({
        actionOverride,
        isRammingMovePreview,
        targetShipId: targetShipId != null ? Number(targetShipId) : null,
        selectedWeaponType,
        specialType,
        isFactionAbilitySupported: false,
      }),
    [actionOverride, isRammingMovePreview, targetShipId, selectedWeaponType, specialType],
  );

  // While a submitted move confirms (isConfirmingMove), its button shows
  // [...] like the live game's pending move.
  const confirmWidgetLabel = useMemo(
    () =>
      isConfirmingMove
        ? "[...]"
        : computeConfirmWidgetLabel({
            actionType: computedActionType,
            selectedWeaponType,
            shipVariant: Number(selectedShip?.traits.variant ?? 1),
            specialType,
            targetShipId: targetShipId != null ? Number(targetShipId) : null,
            factionAbilityIsHeal: false,
          }),
    [isConfirmingMove, computedActionType, selectedWeaponType, specialType, targetShipId, selectedShip],
  );

  // Last-move new position pulse on the grid when no ship is selected (in-game parity).
  const highlightedMovePosition = useMemo(() => {
    // When showing last move (no ship selected), highlight the new position (same as in-game)
    if (
      selectedShipId === null &&
      tutorialDisplayLastMove &&
      tutorialDisplayLastMove.actionType !== ActionType.Retreat &&
      tutorialDisplayLastMove.newRow >= 0 &&
      tutorialDisplayLastMove.newCol >= 0
    ) {
      return {
        row: tutorialDisplayLastMove.newRow,
        col: tutorialDisplayLastMove.newCol,
      };
    }
    return null;
  }, [selectedShipId, tutorialDisplayLastMove]);

  /**
   * Grid positions for the tutorial highlight (yellow pulse): step 3 on player
   * fleet until a ship is selected; step 4 on enemy fleet until an enemy ship is selected;
   * step 5 on the Sentinel until a ship is selected; step 7 on the Resolute
   * until a ship is selected, then on allowed scoring-zone move destinations until
   * the move is staged; step 8 on the Vigilant until a ship is selected, then on
   * allowed move destinations until the move is staged, then on the Hammer after
   * the move is staged until a target is chosen;
   * step 10 (special-emp): Resolute until selected; then Anvil while Resolute
   * is on Weapons until Anvil is targeted; then weapon/special dropdown pulses instead; after
   * switching to Special, Anvil again if no target (target usually carries over from Weapons);
   * step 12 (rescue): Resolute and Vigilant both pulse until one is selected; then only
   * the selected ship pulses (Hammer is added while Vigilant is selected and no shot target yet);
   * step 13 (rescue-outcome-sniper): Sentinel until selected; allowed center cell(s) pulse
   * like other move steps; Hammer after center move is staged until a target is chosen;
   * step 13 (rescue-outcome-retreat): no grid tutorial highlight (narrative only).
   */
  // Select a ship / Inspect enemy ships: once the player has picked one of
  // the highlighted ships, the highlight stays off for the rest of the step,
  // even after they deselect it.
  const [highlightDoneStepId, setHighlightDoneStepId] = useState<string | null>(null);
  useEffect(() => {
    setHighlightDoneStepId(null);
  }, [currentStep?.id]);
  useEffect(() => {
    if (selectedShipId === null) return;
    const stepId = currentStep?.id;
    const pickedEnemy = isTutorialEnemyFleetShipId(selectedShipId);
    if ((stepId === "select-ship" && !pickedEnemy) || (stepId === "view-enemy" && pickedEnemy)) {
      setHighlightDoneStepId(stepId);
    }
  }, [currentStep?.id, selectedShipId]);

  const tutorialHighlightCells = useMemo(() => {
    const stepId = currentStep?.id;
    const positions = gameState.shipPositions;

    const cellsForIds = (ids: readonly bigint[]) => {
      const cells: { row: number; col: number }[] = [];
      for (const shipId of ids) {
        const idStr = shipId.toString() as TutorialShipId;
        const sp = positions.find((p) => p.shipId === idStr);
        if (sp) {
          cells.push({ row: sp.position.row, col: sp.position.col });
        }
      }
      return cells.length > 0 ? cells : undefined;
    };

    if (stepId === "goals") {
      const resourceCells: { row: number; col: number; hideLabel: true }[] = [];
      for (let row = 0; row < scoringGrid.length; row++) {
        const cols = scoringGrid[row];
        for (let col = 0; col < cols.length; col++) {
          if ((cols[col] ?? 0) > 0) {
            resourceCells.push({ row, col, hideLabel: true });
          }
        }
      }
      return resourceCells.length > 0 ? resourceCells : undefined;
    }

    if (stepId === "select-ship") {
      if (selectedShipId !== null || highlightDoneStepId === stepId) return undefined;
      return cellsForIds(TUTORIAL_SELECT_SHIP_HIGHLIGHT_SHIP_IDS);
    }

    if (stepId === "view-enemy") {
      if (
        highlightDoneStepId === stepId ||
        (selectedShipId !== null && isTutorialEnemyFleetShipId(selectedShipId))
      ) {
        return undefined;
      }
      return cellsForIds(TUTORIAL_VIEW_ENEMY_HIGHLIGHT_SHIP_IDS);
    }

    if (stepId === "move-ship") {
      if (selectedShipId === null) {
        return cellsForIds(TUTORIAL_MOVE_SHIP_HIGHLIGHT_SHIP_IDS);
      }
      const moveCfg = currentStep?.allowedActions.moveShip;
      if (
        moveCfg &&
        selectedShipId.toString() === moveCfg.shipId &&
        moveCfg.allowedPositions.length > 0
      ) {
        const isMoveStaged =
          previewPosition !== null &&
          moveCfg.allowedPositions.some(
            (p) =>
              p.row === previewPosition.row && p.col === previewPosition.col,
          );
        if (isMoveStaged) {
          return undefined;
        }
        return moveCfg.allowedPositions.map((p) => ({
          row: p.row,
          col: p.col,
        }));
      }
      return undefined;
    }

    if (stepId === "score-points") {
      if (selectedShipId === null) {
        return cellsForIds(TUTORIAL_SCORE_POINTS_HIGHLIGHT_SHIP_IDS);
      }
      const moveCfg = currentStep?.allowedActions.moveShip;
      if (
        moveCfg &&
        selectedShipId.toString() === moveCfg.shipId &&
        moveCfg.allowedPositions.length > 0
      ) {
        const isMoveStaged =
          previewPosition !== null &&
          moveCfg.allowedPositions.some(
            (p) =>
              p.row === previewPosition.row && p.col === previewPosition.col,
          );
        if (isMoveStaged) {
          return undefined;
        }
        return moveCfg.allowedPositions.map((p) => ({
          row: p.row,
          col: p.col,
        }));
      }
      return undefined;
    }

    if (stepId === "shoot") {
      if (selectedShipId === null) {
        return cellsForIds(TUTORIAL_SHOOT_HIGHLIGHT_SHIP_IDS);
      }
      const moveCfg = currentStep?.allowedActions.moveShip;
      if (
        moveCfg &&
        selectedShipId.toString() === moveCfg.shipId &&
        moveCfg.allowedPositions.length > 0
      ) {
        const isMoveStaged =
          previewPosition !== null &&
          moveCfg.allowedPositions.some(
            (p) =>
              p.row === previewPosition.row && p.col === previewPosition.col,
          );
        if (isMoveStaged && targetShipId === null) {
          return cellsForIds(TUTORIAL_SHOOT_HIGHLIGHT_ENEMY_SHIP_IDS);
        }
        if (!isMoveStaged) {
          return moveCfg.allowedPositions.map((p) => ({
            row: p.row,
            col: p.col,
          }));
        }
      }
      return undefined;
    }

    if (stepId === "special-emp") {
      if (selectedShipId === null) {
        return cellsForIds(TUTORIAL_SPECIAL_EMP_HIGHLIGHT_SHIP_IDS);
      }
      if (selectedShipId.toString() !== "1001") {
        return undefined;
      }
      // Weapons + Anvil targeted: the cue moves to the EMP choice itself —
      // the Proposed Move panel's dropdown on the narrow layout, the confirm
      // widget's EMP button on the wide one and the board's weapon picker on
      // a phone held sideways (tutorialWeaponOption below).
      if (
        selectedWeaponType === "weapon" &&
        targetShipId?.toString() === "2002"
      ) {
        return undefined;
      }
      // Weapons, not yet targeting Anvil: pulse Anvil so they open with the gun first.
      if (selectedWeaponType === "weapon") {
        return cellsForIds(TUTORIAL_SPECIAL_EMP_HIGHLIGHT_TARGET_SHIP_IDS);
      }
      // Special armed, no target yet: pulse Anvil for EMP targeting.
      if (selectedWeaponType === "special" && targetShipId === null) {
        return cellsForIds(TUTORIAL_SPECIAL_EMP_HIGHLIGHT_TARGET_SHIP_IDS);
      }
      return undefined;
    }

    if (stepId === "rescue") {
      const selectedId = selectedShipId?.toString();
      const playerCells: {
        row: number;
        col: number;
        label?: string;
        hideLabel?: boolean;
      }[] = [];
      for (const shipId of TUTORIAL_RESCUE_CHOICE_HIGHLIGHT_SHIP_IDS) {
        const idStr = shipId.toString() as TutorialShipId;
        // Hard choice: only pulse the ship the player is choosing; hide the other once one is selected.
        if (selectedId === "1001" && idStr === "1002") continue;
        if (selectedId === "1002" && idStr === "1001") continue;
        const sp = positions.find((p) => p.shipId === idStr);
        if (sp) {
          const resoluteSelectedPulseOnly =
            selectedId === "1001" && idStr === "1001";
          playerCells.push({
            row: sp.position.row,
            col: sp.position.col,
            ...(resoluteSelectedPulseOnly
              ? { hideLabel: true as const }
              : {
                  label:
                    idStr === "1001"
                      ? "Save Ship"
                      : idStr === "1002"
                        ? "Win Game"
                        : undefined,
                }),
          });
        }
      }
      const enemyCells =
        selectedShipId?.toString() === "1002" && targetShipId === null
          ? (cellsForIds(TUTORIAL_RESCUE_SNIPER_TARGET_HIGHLIGHT_SHIP_IDS) ??
            [])
          : [];
      const seen = new Set<string>();
      const merged: {
        row: number;
        col: number;
        label?: string;
        hideLabel?: boolean;
      }[] = [];
      for (const c of [...playerCells, ...enemyCells]) {
        const key = `${c.row},${c.col}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(c);
        }
      }
      return merged.length > 0 ? merged : undefined;
    }

    if (stepId === "rescue-outcome-retreat") {
      return undefined;
    }

    if (stepId === "rescue-outcome-sniper") {
      if (selectedShipId === null) {
        return cellsForIds(
          TUTORIAL_RESCUE_OUTCOME_SNIPER_FIGHTER_HIGHLIGHT_SHIP_IDS,
        );
      }
      const moveCfg = currentStep?.allowedActions.moveShip;
      if (
        moveCfg &&
        selectedShipId.toString() === moveCfg.shipId &&
        moveCfg.allowedPositions.length > 0
      ) {
        const isMoveStaged =
          previewPosition !== null &&
          moveCfg.allowedPositions.some(
            (p) =>
              p.row === previewPosition.row && p.col === previewPosition.col,
          );
        if (!isMoveStaged) {
          return moveCfg.allowedPositions.map((p) => ({
            row: p.row,
            col: p.col,
          }));
        }
        if (isMoveStaged && targetShipId === null) {
          return cellsForIds(
            TUTORIAL_RESCUE_OUTCOME_SNIPER_ENEMY_HIGHLIGHT_SHIP_IDS,
          );
        }
      }
      return undefined;
    }

    return undefined;
  }, [
    currentStep,
    selectedShipId,
    previewPosition,
    targetShipId,
    selectedWeaponType,
    gameState.shipPositions,
    scoringGrid,
    useSideLayout,
    highlightDoneStepId,
  ]);

  // Where the last mover ended up (a Ram ends on the victim's tile, not the
  // recorded one — see ramLastMove.ts). Same as the live views.
  const tutorialLastMoveEnd = useMemo(() => {
    const lm = tutorialDisplayLastMove;
    if (!lm || lm.newRow < 0 || lm.newCol < 0) return null;
    return lastMoveEndPosition({
      lastMove: lm,
      moverVariant: shipMap.get(BigInt(lm.shipId))?.traits.variant,
      shipPositions: gameState.shipPositions,
    });
  }, [tutorialDisplayLastMove, shipMap, gameState.shipPositions]);

  // Last move UI props for GameGrid (same as in-game: ghost at old position, pulse at new)
  const lastMoveProps = useMemo(() => {
    if (selectedShipId !== null) {
      return {
        lastMoveShipId: null as bigint | null,
        lastMoveOldPosition: null as { row: number; col: number } | null,
        lastMoveNewPosition: null as { row: number; col: number } | null,
        lastMoveActionType: null as ActionType | null,
        lastMoveTargetShipId: null as bigint | null,
        lastMoveIsCurrentPlayer: undefined as boolean | undefined,
      };
    }
    if (!tutorialDisplayLastMove) {
      return {
        lastMoveShipId: null as bigint | null,
        lastMoveOldPosition: null as { row: number; col: number } | null,
        lastMoveNewPosition: null as { row: number; col: number } | null,
        lastMoveActionType: null as ActionType | null,
        lastMoveTargetShipId: null as bigint | null,
        lastMoveIsCurrentPlayer: undefined as boolean | undefined,
      };
    }
    const lm = tutorialDisplayLastMove;
    const ship = shipMap.get(BigInt(lm.shipId));
    const lmAction = Number(lm.actionType);
    return {
      lastMoveShipId: BigInt(lm.shipId),
      lastMoveOldPosition: { row: lm.oldRow, col: lm.oldCol },
      lastMoveNewPosition: tutorialLastMoveEnd ?? { row: lm.newRow, col: lm.newCol },
      // Coerce so GameGrid strict checks (e.g. EMP) match after JSON or mixed types
      lastMoveActionType: lmAction as ActionType,
      lastMoveTargetShipId:
        (lmAction === ActionType.Shoot ||
          lmAction === ActionType.Special ||
          lmAction === ActionType.FactionAbility) &&
        lm.targetShipId &&
        lm.targetShipId !== "0"
          ? BigInt(lm.targetShipId)
          : null,
      lastMoveIsCurrentPlayer: ship
        ? ship.owner === TUTORIAL_PLAYER_ADDRESS
        : undefined,
    };
  }, [tutorialDisplayLastMove, shipMap, selectedShipId, tutorialLastMoveEnd]);

  const lastMoveResolvedTo = useMemo(() => {
    const lm = tutorialDisplayLastMove;
    if (!lm || !tutorialLastMoveEnd) return null;
    return { shipId: Number(lm.shipId), row: tutorialLastMoveEnd.row, col: tutorialLastMoveEnd.col };
  }, [tutorialDisplayLastMove, tutorialLastMoveEnd]);

  // Last move object for GameEvents panel (adapt tutorial lastMove to onchain LastMove shape).
  // Hidden while any ship is selected (matches live game); proposed moves use the submit panel.
  const lastMoveForEvents: LastMove | undefined = useMemo(() => {
    if (selectedShipId !== null) {
      return undefined;
    }
    if (!tutorialDisplayLastMove) return undefined;
    const lm = tutorialDisplayLastMove;
    return {
      shipId: BigInt(lm.shipId),
      oldRow: lm.oldRow,
      oldCol: lm.oldCol,
      newRow: lm.newRow,
      newCol: lm.newCol,
      actionType: Number(lm.actionType) as ActionType,
      targetShipId: lm.targetShipId ? BigInt(lm.targetShipId) : 0n,
      timestamp: 0n,
    };
  }, [selectedShipId, tutorialDisplayLastMove]);

  const calculateDamageForDisplay = useDamageCalculation({
    selectedShipId: selectedShipId != null ? Number(selectedShipId) : null,
    getShipAttributes: getRangeAttributes,
    selectedWeaponType,
    specialData,
    specialType,
    shipVariant: selectedShipId != null ? Number(shipMap.get(selectedShipId)?.traits.variant) : undefined,
  });

  // Get valid targets
  // Show full range for viewing, but filter by tutorial constraints if step requires specific targets
  // The shared targeting rules, narrowed to what the current step allows.
  // In the shoot step the allowed target always counts (out of range or
  // not), so clicking it targets it rather than selecting it.
  const validTargets = useMemo(() => {
    if (!selectedShipId) return [];
    const shipKey = selectedShipId.toString();
    const allowedActions = currentStep?.allowedActions;
    const allowedTargets =
      allowedActions?.shoot?.shipId === shipKey
        ? allowedActions.shoot.allowedTargets
        : allowedActions?.useSpecial?.shipId === shipKey
          ? allowedActions.useSpecial.allowedTargets
          : null;
    const allowedSet = allowedTargets ? new Set<string>(allowedTargets) : null;

    const shared = computeValidTargets({
      selectedShipId: Number(selectedShipId),
      previewPosition,
      isRammingMovePreview,
      shipPositions: rangeAlivePositions,
      shipMap: rangeShipMap,
      playerAddress: TUTORIAL_PLAYER_ADDRESS,
      getShipAttributes: getRangeAttributes,
      selectedWeaponType,
      specialRange,
      specialType,
      shipVariant: Number(selectedShip?.traits.variant ?? 1),
      isFactionAbilitySupported: false,
      blockedGrid,
      enemyOccupiedGrid: selectedEnemyOccupiedGrid,
    });
    const targets = shared
      .filter((t) => !allowedSet || allowedSet.has(String(t.shipId)))
      .map((t) => ({ shipId: String(t.shipId) as TutorialShipId, position: t.position }));

    if (currentStep?.id === "shoot" && allowedSet && !isRammingMovePreview) {
      const from =
        previewPosition ??
        rangeAlivePositions.find((p) => p.shipId === Number(selectedShipId))?.position;
      rangeAlivePositions.forEach((p) => {
        const id = String(p.shipId) as TutorialShipId;
        if (!allowedSet.has(id) || targets.some((t) => t.shipId === id) || !from) return;
        const distance = Math.abs(p.position.row - from.row) + Math.abs(p.position.col - from.col);
        if (distance > 0) targets.push({ shipId: id, position: p.position });
      });
    }
    return targets;
  }, [
    selectedShipId,
    currentStep,
    previewPosition,
    isRammingMovePreview,
    rangeAlivePositions,
    rangeShipMap,
    getRangeAttributes,
    selectedWeaponType,
    specialRange,
    specialType,
    selectedShip,
    blockedGrid,
    selectedEnemyOccupiedGrid,
  ]);

  // Assist isn't in the game any more (the live games pass empty lists too).
  const assistableTargets = EMPTY_TUTORIAL_TARGETS;
  const assistableTargetsFromStart = EMPTY_TUTORIAL_TARGETS;

  const shootingRange = useMemo(
    () =>
      isRammingMovePreview
        ? EMPTY_HOVER_RANGE
        : computeShootingRange({
            gridWidth: GRID_WIDTH,
            gridHeight: GRID_HEIGHT,
            selectedShipId: selectedShipId != null ? Number(selectedShipId) : null,
            hasShips: rangeShipMap.size > 0,
            shipMap: rangeShipMap,
            getShipAttributes: getRangeAttributes,
            shipPositions: rangeAlivePositions,
            previewPosition,
            selectedWeaponType,
            specialRange,
            specialType,
            blockedGrid,
          }),
    [isRammingMovePreview, selectedShipId, rangeShipMap, getRangeAttributes, rangeAlivePositions, previewPosition, selectedWeaponType, specialRange, specialType, blockedGrid],
  );

  // Drag shooting range and valid targets (simplified for tutorial)
  const dragShootingRange = useMemo(() => {
    if (!draggedShipId || !dragOverCell) return [];
    // For tutorial, we can reuse the same logic but from drag position
    return [];
  }, [draggedShipId, dragOverCell]);

  const dragValidTargets = useMemo(() => {
    if (!draggedShipId || !dragOverCell) return [];
    // For tutorial, we can reuse the same logic but from drag position
    return [];
  }, [draggedShipId, dragOverCell]);

  const labelTargets = useMemo(
    () =>
      computeLabelTargets({
        selectedShipId: selectedShipId != null ? Number(selectedShipId) : null,
        previewPosition,
        isRammingMovePreview,
        shipPositions: rangeAlivePositions,
        shipMap: rangeShipMap,
        playerAddress: TUTORIAL_PLAYER_ADDRESS,
        getShipAttributes: getRangeAttributes,
        selectedWeaponType,
        specialRange,
        specialType,
        shipVariant: Number(selectedShip?.traits.variant ?? 1),
        blockedGrid,
        gridWidth: GRID_WIDTH,
        gridHeight: GRID_HEIGHT,
      }),
    [selectedShipId, previewPosition, isRammingMovePreview, rangeAlivePositions, rangeShipMap,
     getRangeAttributes, selectedWeaponType, specialRange, specialType, selectedShip, blockedGrid],
  );

  // Called by GameGrid's dest-hover overlay with the hovered movement tile.
  // Hover state lives in GridHover context so pointer moves do not
  // re-render this component (same contract as useGameplayInteraction).
  const getHoverPreview = useCallback(
    (hoverPreviewPosition: { row: number; col: number } | null) => {
      if (!hoverPreviewPosition) {
        return { shootingRange: EMPTY_HOVER_RANGE, validTargets: EMPTY_HOVER_TARGETS };
      }
      const rangeShipId = selectedShipId != null ? Number(selectedShipId) : null;
      return {
        shootingRange: computeHoverShootingRange({
          selectedShipId: rangeShipId,
          hoverPreviewPosition,
          hasShips: rangeShipMap.size > 0,
          shipPositions: rangeAlivePositions,
          getShipAttributes: getRangeAttributes,
          selectedWeaponType,
          specialRange,
          specialType,
          blockedGrid,
          gridWidth: GRID_WIDTH,
          gridHeight: GRID_HEIGHT,
        }),
        validTargets: computeHoverValidTargets({
          selectedShipId: rangeShipId,
          hoverPreviewPosition,
          hasShips: rangeShipMap.size > 0,
          shipPositions: rangeAlivePositions,
          shipMap: rangeShipMap,
          playerAddress: TUTORIAL_PLAYER_ADDRESS,
          getShipAttributes: getRangeAttributes,
          selectedWeaponType,
          specialRange,
          specialType,
          shipVariant: Number(selectedShip?.traits.variant ?? 1),
          blockedGrid,
        }),
      };
    },
    [selectedShipId, rangeShipMap, rangeAlivePositions, getRangeAttributes,
     selectedWeaponType, specialType, specialRange, blockedGrid, selectedShip],
  );

  // Convert tutorial string ids to bigint ids for GameGrid targeting logic.
  const gridValidTargets = useMemo(
    () =>
      validTargets.map((t) => ({
        shipId: BigInt(t.shipId),
        position: t.position,
      })),
    [validTargets],
  );

  const gridAssistableTargets = useMemo(
    () =>
      assistableTargets.map((t) => ({
        shipId: BigInt(t.shipId),
        position: t.position,
      })),
    [assistableTargets],
  );

  const gridAssistableTargetsFromStart = useMemo(
    () =>
      assistableTargetsFromStart.map((t) => ({
        shipId: BigInt(t.shipId),
        position: t.position,
      })),
    [assistableTargetsFromStart],
  );

  // GameGrid expects Set<bigint> for movedShipIdsSet; tutorial state uses string IDs.
  const gridMovedShipIdsSet = useMemo(() => {
    const set = new Set<bigint>();
    if (gameState.creatorMovedShipIds) {
      gameState.creatorMovedShipIds.forEach((id) => set.add(BigInt(id)));
    }
    if (gameState.joinerMovedShipIds) {
      gameState.joinerMovedShipIds.forEach((id) => set.add(BigInt(id)));
    }
    return set;
  }, [gameState.creatorMovedShipIds, gameState.joinerMovedShipIds]);

  const wrappedSetSelectedShipId = useCallback(
    (shipId: bigint | null) => {
      if (shipId === null) {
        setSelectedShipId(null);
        setPreviewPosition(null);
        setTargetShipId(null);
        return;
      }

      // In the shooting tutorial step, if the Vigilant is already selected
      // and the user clicks Hammer, always treat that click as
      // targeting the enemy for the staged move+shoot, not as a selection
      // change. This prevents the proposed move from being cleared.
      if (
        currentStep?.id === "shoot" &&
        selectedShipId !== null &&
        shipId !== selectedShipId
      ) {
        const idString = shipId.toString() as TutorialShipId;
        if (
          currentStep.allowedActions.shoot &&
          currentStep.allowedActions.shoot.allowedTargets.includes(idString)
        ) {
          setTargetShipId(shipId);
          return;
        }
      }

      const idString = shipId.toString() as TutorialShipId;

      // Validate ship selection
      const validation = validateAction({
        type: "selectShip",
        shipId: idString,
      });
      if (!validation.valid) {
        toast.error(validation.message || TUTORIAL_NOT_ALLOWED.select);
        return;
      }

      // When changing selection to a different ship, clear any existing preview so
      // the new selection starts in the movement + threat state (same as main game).
      setSelectedShipId(shipId);
      setPreviewPosition(null);
      executeAction({ type: "selectShip", shipId: idString });
      setTargetShipId(null);
    },
    [
      currentStep,
      selectedShipId,
      previewPosition,
      validateAction,
      executeAction,
    ],
  );

  /** Match GameDisplay `handleCancelMove`: clear staged move, target, and selection. */
  const handleCancelMove = useCallback(() => {
    wrappedSetSelectedShipId(null);
    setActionOverride(null);
    setDraggedShipId(null);
    setDragOverCell(null);
  }, [wrappedSetSelectedShipId]);

  /** Board frame clicks (padding) do not hit GameGrid; clear selection and target like empty-cell deselect. */
  const handleBoardChromeMouseDown = useCallback(() => {
    wrappedSetSelectedShipId(null);
    setDraggedShipId(null);
    setDragOverCell(null);
  }, [wrappedSetSelectedShipId]);

  /** GameGrid clears selection on context menu; clear retreat override here (matches handleCancelMove). */
  const handleGridRightClickDeselect = useCallback(() => {
    setActionOverride(null);
  }, []);

  const wrappedSetPreviewPosition = useCallback(
    (position: { row: number; col: number } | null) => {
      if (!position) {
        setPreviewPosition(null);
        return;
      }

      // Select a ship is for inspecting: the range shows, but no move yet.
      if (currentStep?.id === "select-ship") {
        toast.error(TUTORIAL_NOT_ALLOWED.move);
        return;
      }

      // Hard choice (rescue): Vigilant is shoot-only and cannot stage moves to a new square.
      // Clicking a target still sets preview to the Vigilant's current cell first (stay-in-place + fire);
      // only block when the player tries to move to a different cell.
      if (
        currentStep?.id === "rescue" &&
        selectedShipId?.toString() === "1002"
      ) {
        const currentPos = gameState.shipPositions.find(
          (p) => p.shipId === selectedShipId.toString(),
        )?.position;
        if (
          currentPos &&
          (position.row !== currentPos.row || position.col !== currentPos.col)
        ) {
          toast.error("Vigilant cannot move in this step.");
          return;
        }
      }

      // Validate move action
      if (
        selectedShipId &&
        currentStep?.allowedActions.moveShip &&
        selectedShipId.toString() === currentStep.allowedActions.moveShip.shipId
      ) {
        const allowedPositions =
          currentStep.allowedActions.moveShip.allowedPositions;
        const isValidMove = allowedPositions.some(
          (pos) => pos.row === position.row && pos.col === position.col,
        );

        if (!isValidMove) {
          toast.error(TUTORIAL_NOT_ALLOWED.moveToMarked);
          return;
        }

        const moveValidation = validateAction({
          type: "moveShip",
          shipId: selectedShipId.toString() as TutorialShipId,
          position,
        });
        if (!moveValidation.valid) {
          toast.error(moveValidation.message || TUTORIAL_NOT_ALLOWED.move);
          return;
        }

        // Stage the preview only. The actual move is submitted via the
        // top action UI (Submit button), matching the live game flow.
        setPreviewPosition(position);
      } else {
        setPreviewPosition(position);
      }
    },
    [
      selectedShipId,
      currentStep,
      gameState.shipPositions,
      validateAction,
      executeAction,
    ],
  );

  const wrappedSetTargetShipId = useCallback(
    (shipId: bigint | null) => {
      if (!shipId || shipId === 0n) {
        setTargetShipId(shipId);
        return;
      }

      if (!selectedShipId) {
        setTargetShipId(shipId);
        return;
      }

      const idString = shipId.toString() as TutorialShipId;

      // Check for shoot action
      if (
        currentStep?.allowedActions.shoot &&
        selectedShipId.toString() === currentStep.allowedActions.shoot.shipId &&
        currentStep.allowedActions.shoot.allowedTargets.includes(idString)
      ) {
        // In the shooting tutorial step, clicking an enemy in range should
        // only stage the target for the composite move+shoot action. The
        // actual shoot is executed when the user clicks Submit, just like
        // in the main game.
        if (
          currentStep.id === "shoot" ||
          currentStep.id === "rescue-outcome-sniper"
        ) {
          if (currentStep.id === "shoot") {
            // Require a proposed move to (1, 3) before allowing the shot.
            if (
              !previewPosition ||
              previewPosition.row !== 1 ||
              previewPosition.col !== 3
            ) {
              toast.error(
                "Move the Vigilant to (1, 3) before firing on the enemy.",
              );
              return;
            }
          } else if (currentStep.id === "rescue-outcome-sniper") {
            // Require the fighter to stage the center move before optional shot.
            if (
              !previewPosition ||
              previewPosition.row !== 5 ||
              previewPosition.col !== 8
            ) {
              toast.error(
                "Move the Sentinel to (5, 8) before firing on the enemy.",
              );
              return;
            }
          }

          // Stage the target only; Submit will call executeAction for the
          // actual shoot.
          setTargetShipId(shipId);
          return;
        }

        // In rescue, the sniper shot is staged (target selection) and is only
        // executed when the player clicks Submit.
        if (
          currentStep.id === "rescue" &&
          selectedShipId.toString() === "1002"
        ) {
          const currentPos = gameState.shipPositions.find(
            (pos) => pos.shipId === selectedShipId.toString(),
          )?.position;
          if (currentPos) {
            // Keep sniper stationary but provide an explicit firing origin so
            // railgun animation/effects can render when target is selected.
            setPreviewPosition({ row: currentPos.row, col: currentPos.col });
          }
          setTargetShipId(shipId);
          return;
        }

        const shootValidation = validateAction({
          type: "shoot",
          shipId: selectedShipId.toString() as TutorialShipId,
          targetShipId: idString,
        });
        if (shootValidation.valid) {
          executeAction({
            type: "shoot",
            shipId: selectedShipId.toString() as TutorialShipId,
            targetShipId: idString,
            actionType: ActionType.Shoot,
          });
          setSelectedShipId(null);
          setTargetShipId(null);
          setPreviewPosition(null);
          return;
        } else {
          toast.error(shootValidation.message || TUTORIAL_NOT_ALLOWED.shoot);
          return;
        }
      }

      // Check for useSpecial action
      if (
        currentStep?.allowedActions.useSpecial &&
        selectedShipId.toString() ===
          currentStep.allowedActions.useSpecial.shipId &&
        currentStep.allowedActions.useSpecial.allowedTargets.includes(idString)
      ) {
        const specialValidation = validateAction({
          type: "useSpecial",
          shipId: selectedShipId.toString() as TutorialShipId,
          targetShipId: idString,
          specialType: currentStep.allowedActions.useSpecial.specialType,
        });
        if (specialValidation.valid) {
          // Stage the target only; Submit will call executeAction for the
          // actual special use.
          setTargetShipId(shipId);
          return;
        } else {
          toast.error(
            specialValidation.message || TUTORIAL_NOT_ALLOWED.special,
          );
          return;
        }
      }

      // Check for assist action
      if (
        currentStep?.allowedActions.assist &&
        selectedShipId.toString() ===
          currentStep.allowedActions.assist.shipId &&
        currentStep.allowedActions.assist.allowedTargets.includes(idString)
      ) {
        const assistValidation = validateAction({
          type: "assist",
          shipId: selectedShipId.toString() as TutorialShipId,
          targetShipId: idString,
        });
        if (assistValidation.valid) {
          executeAction({
            type: "assist",
            shipId: selectedShipId.toString() as TutorialShipId,
            targetShipId: idString,
            actionType: ActionType.Assist,
          });
          setSelectedShipId(null);
          setTargetShipId(null);
          setPreviewPosition(null);
          return;
        } else {
          toast.error(assistValidation.message || TUTORIAL_NOT_ALLOWED.assist);
          return;
        }
      }

      // If no matching action, just set the target (for display purposes)
      setTargetShipId(shipId);
    },
    [
      selectedShipId,
      currentStep,
      previewPosition,
      validateAction,
      executeAction,
      gameState.shipPositions,
    ],
  );

  // Submit handler for staged move (selected ship + preview position). This mirrors
  // the live game flow where the player first stages a move on the grid, then
  // confirms it via the action panel, which may trigger a (simulated) transaction.
  const handleSubmitMove = useCallback(() => {
    if (!selectedShipId || isConfirmingMove) {
      return;
    }

    if (actionOverride === ActionType.Retreat) {
      const currentPos = gameState.shipPositions.find(
        (p) => p.shipId === selectedShipId.toString(),
      )?.position;
      if (!currentPos) return;
      executeAction({
        type: "moveShip",
        shipId: selectedShipId.toString() as TutorialShipId,
        position: currentPos,
        actionType: ActionType.Retreat,
      });
      setActionOverride(null);
      return;
    }

    // For the shooting tutorial step, Submit should execute the composite
    // move+shoot action in one go: apply the staged move, then open the
    // simulated transaction for the shot.
    if (currentStep?.id === "shoot") {
      if (!previewPosition) {
        return;
      }
      if (!currentStep.allowedActions.moveShip) {
        toast.error(TUTORIAL_NOT_ALLOWED.move);
        return;
      }

      if (!targetShipId) {
        toast.error("Select an enemy ship to target before submitting.");
        return;
      }

      const moveAction: TutorialAction = {
        type: "moveShip",
        shipId: selectedShipId.toString() as TutorialShipId,
        position: previewPosition,
        actionType: ActionType.Pass,
      };

      // Apply the move immediately (no tx). Validation has already run earlier.
      executeAction(moveAction);

      const shootAction: TutorialAction = {
        type: "shoot",
        shipId: selectedShipId.toString() as TutorialShipId,
        targetShipId: targetShipId.toString() as TutorialShipId,
        actionType: ActionType.Shoot,
      };

      executeAction(shootAction);
      // For the shooting step, keep selection and preview/target state while
      // a submitted move confirms so the player continues to
      // see the staged move+shoot in the UI. State will be cleared when the
      // step advances once it confirms.
      return;
    }

    // Sniper branch step: submit move-to-center, optionally with a shot target.
    if (currentStep?.id === "rescue-outcome-sniper") {
      if (!previewPosition) {
        toast.error("Move the Sentinel to (5, 8) before submitting.");
        return;
      }
      if (previewPosition.row !== 5 || previewPosition.col !== 8) {
        toast.error("Move the Sentinel to (5, 8) before submitting.");
        return;
      }

      const moveAction: TutorialAction = {
        type: "moveShip",
        shipId: selectedShipId.toString() as TutorialShipId,
        position: previewPosition,
        actionType: ActionType.Pass,
        // If the player selected a target, we'll perform the optional shot
        // after the tx is approved (handled in useOnboardingTutorial).
        targetShipId: targetShipId
          ? (targetShipId.toString() as TutorialShipId)
          : undefined,
      };
      executeAction(moveAction);
      return;
    }

    // Rescue step has two valid submit paths:
    // 1) Select disabled EMP and submit retreat.
    // 2) Select sniper, keep position, stage target, then submit shoot.
    if (currentStep?.id === "rescue") {
      const selectedId = selectedShipId.toString() as TutorialShipId;

      if (selectedId === "1001") {
        const currentPos = gameState.shipPositions.find(
          (pos) => pos.shipId === selectedId,
        )?.position;
        if (!currentPos) return;

        executeAction({
          type: "moveShip",
          shipId: selectedId,
          position: currentPos,
          actionType: ActionType.Retreat,
        });
      } else if (selectedId === "1002") {
        if (!targetShipId) {
          toast.error("Select Hammer as target before submitting.");
          return;
        }
        executeAction({
          type: "shoot",
          shipId: selectedId,
          targetShipId: targetShipId.toString() as TutorialShipId,
          actionType: ActionType.Shoot,
        });
      } else {
        toast.error("Select Resolute or Vigilant.");
        return;
      }
    } else if (currentStep?.id === "special-emp") {
      // Special EMP step: no movement, just fire the special at the staged target.
      const isEmpSelected = selectedWeaponType === "special";
      const hasTarget = !!targetShipId;
      const allowedTargets =
        currentStep.allowedActions.useSpecial?.allowedTargets ?? [];
      const isAllowedTarget =
        hasTarget &&
        allowedTargets.includes(targetShipId!.toString() as TutorialShipId);

      // Only requirement for submit in this step:
      // - EMP is selected in the dropdown
      // - Target is one of the allowed useSpecial targets (Anvil)
      if (!isEmpSelected || !isAllowedTarget) {
        toast.error(
          "Select Anvil as your target and switch to EMP before submitting.",
        );
        return;
      }

      const action: TutorialAction = {
        type: "useSpecial",
        shipId: selectedShipId.toString() as TutorialShipId,
        targetShipId: targetShipId.toString() as TutorialShipId,
        actionType: ActionType.Special,
      };

      executeAction(action);
    } else {
      if (!previewPosition) {
        return;
      }
      if (
        !currentStep?.allowedActions.moveShip ||
        selectedShipId.toString() !== currentStep.allowedActions.moveShip.shipId
      ) {
        toast.error(TUTORIAL_NOT_ALLOWED.move);
        return;
      }

      const action: TutorialAction = {
        type: "moveShip",
        shipId: selectedShipId.toString() as TutorialShipId,
        position: previewPosition,
        actionType: ActionType.Pass,
      };

      executeAction(action);
    }

    // Steps without a transaction land at once, so clear the staging now.
    // Steps with one keep it on screen, its button showing [...], until the
    // move confirms (cleared below), like a live game's pending move.
    if (!currentStep?.requiresTransaction) {
      setPreviewPosition(null);
      setTargetShipId(null);
      setSelectedShipId(null);
    }
  }, [
    selectedShipId,
    previewPosition,
    targetShipId,
    gameState.shipPositions,
    currentStep,
    isSelectedShipDisabled,
    selectedWeaponType,
    executeAction,
    actionOverride,
    isConfirmingMove,
  ]);

  const tutorialGridPanelConfig = useMemo(() => {
    if (!currentStep?.id) return null;
    const base = getTutorialGridPanelConfig(currentStep.id);
    if (!base) return null;
    // A report-only step (End of round) is just its round report: no panel.
    if (isReportOnlyStep(currentStep.id)) return null;
    if (currentStep.id === "completion-sniper") {
      return {
        ...base,
        primaryCta: {
          headline: continuesWithoutClaim
            ? TUTORIAL_COMPLETION_CARD.continueHeadline
            : TUTORIAL_COMPLETION_CARD.headline,
          supporting: continuesWithoutClaim
            ? TUTORIAL_COMPLETION_CONTINUE_PRIMARY_CTA_SUPPORTING
            : TUTORIAL_COMPLETION_SNIPER_PRIMARY_CTA_SUPPORTING,
          buttonLabel: continuesWithoutClaim
            ? TUTORIAL_COMPLETION_CARD.buttons.continueToFleet
            : isTutorialRewardAlreadyClaimed
            ? continueToFleetSelection
              ? TUTORIAL_COMPLETION_CARD.buttons.continueToFleet
              : TUTORIAL_COMPLETION_CARD.buttons.rewardClaimed
            : !address
              ? TUTORIAL_COMPLETION_CARD.buttons.signIn
              : isTutorialSelfieCheckBlocking
                ? isSelfieCheckVerifying
                  ? TUTORIAL_COMPLETION_CARD.buttons.verifying
                  : TUTORIAL_COMPLETION_CARD.buttons.verify
                : pendingTutorialClaimPath === "win" &&
                    (isTutorialClaimPending || isTutorialClaimConfirming)
                  ? TUTORIAL_COMPLETION_CARD.buttons.claiming
                  : TUTORIAL_COMPLETION_CARD.buttons.claimWin,
          onClick: continuesWithoutClaim
            ? () => onBack?.()
            : isTutorialSelfieCheckBlocking
            ? openSelfieCheckWidget
            : () => void runTutorialClaimTx("win", "completeTutorialWinPath"),
        },
      };
    }
    if (currentStep.id === "completion-retreat") {
      return {
        ...base,
        primaryCta: {
          headline: continuesWithoutClaim
            ? TUTORIAL_COMPLETION_CARD.continueHeadline
            : TUTORIAL_COMPLETION_CARD.headline,
          supporting: continuesWithoutClaim
            ? TUTORIAL_COMPLETION_CONTINUE_PRIMARY_CTA_SUPPORTING
            : TUTORIAL_COMPLETION_RETREAT_PRIMARY_CTA_SUPPORTING,
          buttonLabel: continuesWithoutClaim
            ? TUTORIAL_COMPLETION_CARD.buttons.continueToFleet
            : isTutorialRewardAlreadyClaimed
            ? continueToFleetSelection
              ? TUTORIAL_COMPLETION_CARD.buttons.continueToFleet
              : TUTORIAL_COMPLETION_CARD.buttons.rewardClaimed
            : !address
              ? TUTORIAL_COMPLETION_CARD.buttons.signIn
              : isTutorialSelfieCheckBlocking
                ? isSelfieCheckVerifying
                  ? TUTORIAL_COMPLETION_CARD.buttons.verifying
                  : TUTORIAL_COMPLETION_CARD.buttons.verify
                : pendingTutorialClaimPath === "loss" &&
                    (isTutorialClaimPending || isTutorialClaimConfirming)
                  ? TUTORIAL_COMPLETION_CARD.buttons.claiming
                  : TUTORIAL_COMPLETION_CARD.buttons.claimLoss,
          onClick: continuesWithoutClaim
            ? () => onBack?.()
            : isTutorialSelfieCheckBlocking
            ? openSelfieCheckWidget
            : () => void runTutorialClaimTx("loss", "completeTutorialLossPath"),
        },
      };
    }
    return base;
  }, [
    address,
    continueToFleetSelection,
    continuesWithoutClaim,
    currentStep?.id,
    isTutorialRewardAlreadyClaimed,
    onBack,
    isTutorialClaimConfirming,
    isTutorialClaimPending,
    isTutorialSelfieCheckBlocking,
    isSelfieCheckVerifying,
    openSelfieCheckWidget,
    pendingTutorialClaimPath,
    runTutorialClaimTx,
  ]);

  // The round report: a step's own (stepReportInfo, with Bosch's note) or
  // the round-change one. Mounted in both layouts below.
  const roundReportModal =
    isStepReportOpen && stepReportInfo ? (
      <RoundStartModal
        key={`step-report-${currentStep?.id}`}
        round={stepReportInfo.round}
        isMyTurnFirst={stepReportInfo.isMyTurnFirst}
        myRoundScore={stepReportInfo.myRoundScore}
        opponentRoundScore={stepReportInfo.opponentRoundScore}
        myScore={stepReportInfo.myScore}
        opponentScore={stepReportInfo.opponentScore}
        maxScore={stepReportInfo.maxScore}
        note={stepReportNote}
        onClose={() => {
          setIsStepReportOpen(false);
          // A report-only step has nothing else to show: Acknowledged moves on.
          if (isReportOnlyStep(currentStep?.id)) nextStep();
        }}
      />
    ) : roundStartInfo ? (
      <RoundStartModal
        key={roundStartInfo.round.toString()}
        round={roundStartInfo.round}
        isMyTurnFirst={roundStartInfo.isMyTurnFirst}
        myRoundScore={roundStartInfo.myRoundScore}
        opponentRoundScore={roundStartInfo.opponentRoundScore}
        myScore={roundStartInfo.myScore}
        opponentScore={roundStartInfo.opponentScore}
        maxScore={roundStartInfo.maxScore}
        onClose={handleCloseRoundStart}
      />
    ) : null;

  const isMobileJoiner =
    gameState.metadata.joiner.toLowerCase() ===
    TUTORIAL_PLAYER_ADDRESS.toLowerCase();
  const myScore = isMobileJoiner
    ? gameState.joinerScore.toString()
    : gameState.creatorScore.toString();
  const opponentScore = isMobileJoiner
    ? gameState.creatorScore.toString()
    : gameState.joinerScore.toString();
  const maxScore = gameState.maxScore.toString();
  const mobileSelectedShipAttributes =
    selectedShip ? getShipAttributes(selectedShip.id) : null;
  const mobileSelectedShipPosition =
    selectedShip
      ? gameState.shipPositions.find(
          (position) => position.shipId === selectedShip.id.toString(),
        )
      : undefined;
  const mobileReactorCriticalStatus: "none" | "warning" | "critical" =
    mobileSelectedShipAttributes &&
    mobileSelectedShipAttributes.reactorCriticalTimer > 0 &&
    mobileSelectedShipAttributes.hullPoints === 0
      ? "critical"
      : mobileSelectedShipAttributes &&
          mobileSelectedShipAttributes.reactorCriticalTimer > 0
        ? "warning"
        : "none";
  const mobileWeaponDisplayName =
    selectedWeaponType === "special" && selectedShip
      ? getSpecialName(selectedShip.equipment.special, selectedShipVariant)
      : selectedShip
        ? getMainWeaponName(selectedShip.equipment.mainWeapon, selectedShipVariant)
        : "Weapon";
  const tutorialTaskPanelAnchor: "left" | "right" =
    currentStep?.id === "rescue" ||
    currentStep?.id === "goals" ||
    currentStep?.id === "view-enemy" ||
    currentStep?.id === "move-ship" ||
    currentStep?.id === "score-points" ||
    currentStep?.id === "special-emp"
      ? "left"
      : "right";

  // In-mission dialog — same hook and panel as GameDisplay.tsx. Tutorial-only
  // difference: the panel moves to the side away from the task panel, and
  // state isn't persisted (the tutorial starts over on every visit).
  const dialogSnapshot = useMemo(() => {
    const isCreatorNow =
      gameState.metadata.creator.toLowerCase() === TUTORIAL_PLAYER_ADDRESS.toLowerCase();
    return buildDialogSnapshot({
      round: Number(gameState.turnState.currentRound),
      myScore: Number(isCreatorNow ? gameState.creatorScore : gameState.joinerScore),
      enemyScore: Number(isCreatorNow ? gameState.joinerScore : gameState.creatorScore),
      ships: gameState.shipPositions.map((p) => ({
        id: String(p.shipId),
        isMine: p.isCreator === isCreatorNow,
        status: p.status,
        hullPoints: getShipAttributes(p.shipId)?.hullPoints ?? null,
        reactorLevel: getShipAttributes(p.shipId)?.reactorCriticalTimer ?? null,
        position: p.position,
      })),
      scoringGrid,
    });
  }, [
    gameState.metadata.creator,
    gameState.turnState.currentRound,
    gameState.creatorScore,
    gameState.joinerScore,
    gameState.shipPositions,
    getShipAttributes,
    scoringGrid,
  ]);
  const missionDialog = useMissionDialog({
    gameId: "tutorial",
    mission: TUTORIAL_DIALOG_MISSION,
    snapshot: dialogSnapshot,
    enabled: true,
    paused: roundStartInfo != null || isStepReportOpen,
    // New lines wait for the player's turn, when they're looking at the board.
    holdNewLines: !isMyTurn,
    persist: false,
  });
  // Tablets held upright dock the tutorial card in the rail under the score
  // (gameViewSideChrome stacks the rail under the board there), so it
  // doesn't cover the top of the map.
  const dockTutorialPanel = isPortraitTablet && useSideLayout;
  const renderTutorialTaskPanel = (docked: boolean) =>
    tutorialGridPanelConfig ? (
      <TutorialGridTaskPanel
        docked={docked}
        title={tutorialGridPanelConfig.title}
        brief={tutorialGridPanelConfig.brief}
        tasks={tutorialGridPanelConfig.tasks}
        tasksSectionLabel={tutorialGridPanelConfig.tasksSectionLabel}
        primaryCta={tutorialGridPanelConfig.primaryCta}
        panelAnchor={tutorialTaskPanelAnchor}
        panelVerticalAnchor={
          currentStep?.id === "rescue" ? "bottom" : "top"
        }
        panelBottomRowExclusive={
          tutorialGridPanelConfig.panelBottomRowExclusive
        }
        panelFitToContent={tutorialGridPanelConfig.panelFitToContent}
        compactPreset={currentStep?.id === "welcome" ? "welcome" : undefined}
        displayStepNumber={displayStepNumber}
        displayTotalSteps={displayTotalSteps}
        currentStepIndex={currentStepIndex}
        isVisibleLastStep={isVisibleLastStep}
        isStepComplete={isStepComplete}
        onNext={() => nextStep()}
        onPrevious={() => previousStep()}
        onReset={() => resetTutorial()}
        onQuit={onBack}
        quitLabel={exitLabel}
        tutorialRewardCacheDebug={
          isTutorialCompletionStep
            ? {
                onClear: handleClearTutorialRewardCache,
                disabled: !address,
              }
            : undefined
        }
      />
    ) : null;
  const missionDialogOverlay =
    missionDialog.current || missionDialog.log.length > 0 ? (
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
        className={
          tutorialGridPanelConfig && !dockTutorialPanel && tutorialTaskPanelAnchor === "left"
            ? "ml-auto"
            : ""
        }
      />
    ) : null;

  // ── GameGrid boundary adapter ───────────────────────────────────────────
  // GameGrid and its subtree render on plain `number` ids (GridShip /
  // GridShipPosition); this component stays bigint internally (tutorial
  // ship ids round-trip through TutorialShipId strings). Convert only at
  // this boundary — see app/types/gridDisplay.ts. Mirrors GameDisplay.tsx
  // per the Game Display Parity Rule.
  const gridForDisplay = grid;
  const allShipPositionsForDisplay = useMemo(
    () => toGridShipPositions(allShipPositionsForGrid),
    [allShipPositionsForGrid],
  );
  const shipMapForDisplay = useMemo(() => toGridShipMap(shipMap), [shipMap]);
  const selectedShipIdForDisplay = selectedShipId != null ? Number(selectedShipId) : null;
  const targetShipIdForDisplay = targetShipId != null ? Number(targetShipId) : null;
  const draggedShipIdForDisplay = draggedShipId != null ? Number(draggedShipId) : null;
  const gridValidTargetsForDisplay = useMemo(
    () => toGridTargets(gridValidTargets),
    [gridValidTargets],
  );
  // Already number ids (computeLabelTargets is the shared number-native one).
  const labelTargetsForDisplay = labelTargets;
  const gridAssistableTargetsForDisplay = useMemo(
    () => toGridTargets(gridAssistableTargets),
    [gridAssistableTargets],
  );
  const gridAssistableTargetsFromStartForDisplay = useMemo(
    () => toGridTargets(gridAssistableTargetsFromStart),
    [gridAssistableTargetsFromStart],
  );
  const dragValidTargetsForDisplay = useMemo(
    () => toGridTargets(dragValidTargets),
    [dragValidTargets],
  );
  const gridMovedShipIdsSetForDisplay = useMemo(
    () => toGridIdSet(gridMovedShipIdsSet),
    [gridMovedShipIdsSet],
  );
  const lastMoveShipIdForDisplay =
    lastMoveProps.lastMoveShipId != null ? Number(lastMoveProps.lastMoveShipId) : null;
  const lastMoveTargetShipIdForDisplay =
    lastMoveProps.lastMoveTargetShipId != null
      ? Number(lastMoveProps.lastMoveTargetShipId)
      : null;
  const retreatPrepShipIdForDisplay =
    retreatPrepShipId != null ? Number(retreatPrepShipId) : null;

  const isShipOwnedByCurrentPlayerForDisplay = useCallback(
    (shipId: number) => isShipOwnedByCurrentPlayer(BigInt(shipId)),
    [isShipOwnedByCurrentPlayer],
  );
  const getShipAttributesForDisplay = useCallback(
    (shipId: number) => getShipAttributes(BigInt(shipId)),
    [getShipAttributes],
  );

  const setSelectedShipIdForDisplay = useCallback(
    (shipId: number | null) => wrappedSetSelectedShipId(displayIdToBigint(shipId)),
    [wrappedSetSelectedShipId],
  );
  const setTargetShipIdForDisplay = useCallback(
    (shipId: number | null) => wrappedSetTargetShipId(displayIdToBigint(shipId)),
    [wrappedSetTargetShipId],
  );
  const setDraggedShipIdForDisplay = useCallback(
    (shipId: number | null) => setDraggedShipId(displayIdToBigint(shipId)),
    [setDraggedShipId],
  );

  const renderShipCard = useCallback(
    (cell: GameGridTooltipHoveredCell): React.ReactNode | null => {
      const ship = shipMap.get(BigInt(cell.shipId));
      if (!ship) return null;
      const attributes = getShipAttributes(BigInt(cell.shipId));
      return (
        <ShipCard
          ship={toShipCardData(ship)}
          shipImage={<ShipImage ship={ship} className="h-full w-full" />}
          isStarred={false}
          onToggleStar={() => {}}
          isSelected={false}
          onToggleSelection={() => {}}
          onRecycleClick={() => {}}
          showInGameProperties={true}
          inGameAttributes={attributes || undefined}
          attributesLoading={!attributes}
          hideRecycle={true}
          hideCheckbox={true}
          tooltipMode={true}
          isCurrentPlayerShip={isShipOwnedByCurrentPlayer(BigInt(cell.shipId))}
          flipShip={cell.isCreator}
          hasMoved={gridMovedShipIdsSet.has(BigInt(cell.shipId))}
          gameViewMode={true}
          tooltipGridPosition={{ row: cell.row, col: cell.col }}
        />
      );
    },
    [shipMap, getShipAttributes, isShipOwnedByCurrentPlayer, gridMovedShipIdsSet],
  );

  const shouldHighlightMobileCloseButton =
    isLandscapeMobile &&
    selectedShip !== null &&
    (currentStep?.id === "select-ship" || currentStep?.id === "view-enemy");

  const updateMobileTutorialScrollHint = useCallback(() => {
    const el = mobileTutorialScrollRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const canScrollDown = el.scrollHeight > el.clientHeight + 8 && remaining > 16;
    setMobileTutorialMoreBelow((prev) =>
      prev === canScrollDown ? prev : canScrollDown,
    );
  }, []);

  useEffect(() => {
    if (mobileLeftPanelTab !== "tutorial") return;
    const el = mobileTutorialScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setMobileTutorialMoreBelow(false);
    requestAnimationFrame(updateMobileTutorialScrollHint);
  }, [
    mobileLeftPanelTab,
    currentStepIndex,
    updateMobileTutorialScrollHint,
  ]);

  useEffect(() => {
    if (mobileLeftPanelTab !== "tutorial") return;
    const scrollEl = mobileTutorialScrollRef.current;
    const contentEl = mobileTutorialContentRef.current;
    if (!scrollEl) return;
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(updateMobileTutorialScrollHint);
    });
    if (contentEl) ro.observe(contentEl);
    window.addEventListener("resize", updateMobileTutorialScrollHint);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateMobileTutorialScrollHint);
    };
  }, [mobileLeftPanelTab, updateMobileTutorialScrollHint]);

  if (requiresLandscapeMode) {
    return (
      <RotateToLandscapePrompt
        title="First Contact"
        round={gameState.turnState.currentRound}
        turnLabel={rotatePromptTurnLabel(null, isMyTurn)}
        turnTone={isMyTurn ? "mine" : "theirs"}
        onBack={onBack}
      />
    );
  }

  // The staged move's panel (Submit/Cancel, weapon, targets, Retreat) in
  // the stacked and side layouts (matches GameDisplay's
  // renderProposedMoveActivePanel). The landscape ship sheet uses
  // LandscapeStagedMove instead, with this Submit/Cancel row in its footer.
  const proposedMoveButtonSize = isLandscapeMobile
    ? "px-1 py-1.5 text-xs tracking-normal"
    : "px-4 py-1.5 text-sm tracking-wider";
  const handleChooseRetreat = () => {
    if (selectedShipId != null) {
      setRetreatExplicitByShipId((prev) => ({
        ...prev,
        [selectedShipId.toString()]: true,
      }));
    }
    setTargetShipId(null);
    setPreviewPosition(null);
  };
  // The landscape ship sheet's staged move (shared LandscapeStagedMove, as
  // in GameDisplay); the Hammer target keeps its tutorial frame.
  const renderLandscapeStagedMove = (): React.ReactNode => {
    if (selectedShipId == null) return null;
    const currentPos = gameState.shipPositions.find(
      (pos) => pos.shipId === selectedShipId.toString(),
    );
    const from = { row: currentPos?.position.row ?? 0, col: currentPos?.position.col ?? 0 };
    return (
      <LandscapeStagedMove
        from={from}
        to={previewPosition ?? from}
        retreating={isSelectedShipDisabled || actionOverride === ActionType.Retreat}
        weaponLabel={mobileWeaponDisplayName}
        targets={validTargets.map((target) => ({
          id: BigInt(target.shipId).toString(),
          name: shipMap.get(BigInt(target.shipId))?.name || `#${BigInt(target.shipId).toString()}`,
        }))}
        selectedTargetId={targetShipId != null ? targetShipId.toString() : null}
        repair={
          selectedWeaponType === "special" &&
          isRepairDronesSpecial(Number(selectedShip?.traits.variant ?? 1), specialType)
        }
        onSelectTarget={(id) => setTargetShipId(BigInt(id))}
        wrapTarget={(id, button) => (
          <TutorialTarget
            active={
              currentStep?.id === "shoot" &&
              previewPosition !== null &&
              targetShipId === null &&
              id === "2001"
            }
            pointer="inline"
            inside
          >
            {button}
          </TutorialTarget>
        )}
      />
    );
  };
  const renderProposedMoveSubmitRow = (): React.ReactNode => (
    <>
        {/* The top padding leaves room for the Submit pointer, which the
            scrolling landscape panel would clip; there it's only added
            while the pointer shows. */}
        <div
          className={`relative flex w-full min-w-0 shrink-0 flex-row gap-2 ${
            !isLandscapeMobile ? "pt-8" : ""
          }`}
        >
          <TutorialTarget active={shouldPulseSubmitMoveButton} className="min-w-0 flex-[2]">
            <button
              type="button"
              onClick={handleSubmitMove}
              disabled={isConfirmingMove}
              className={`w-full ${proposedMoveButtonSize} uppercase font-semibold transition-colors duration-150 min-w-0 `}
              style={{
                ...STYLE_LABEL,
                borderColor: "var(--color-phosphor-green)",
                borderTopColor: "var(--color-phosphor-green)",
                borderLeftColor: "var(--color-phosphor-green)",
                color: "var(--color-phosphor-green)",
                backgroundColor: "var(--color-steel)",
                borderWidth: "2px",
                borderStyle: "solid",
                borderRadius: 0,
              }}
            >
              {isConfirmingMove ? "[...]" : isSelectedShipDisabled ? "Submit Retreat" : "Submit"}
            </button>
          </TutorialTarget>
          <button
            type="button"
            onClick={handleCancelMove}
            className={`min-w-0 flex-[1] ${proposedMoveButtonSize} uppercase font-semibold transition-colors duration-150`}
            style={{
              ...STYLE_LABEL,
              borderColor: "var(--color-gunmetal)",
              borderTopColor: "var(--color-steel)",
              borderLeftColor: "var(--color-steel)",
              color: "var(--color-text-secondary)",
              backgroundColor: "var(--color-slate)",
              borderWidth: "2px",
              borderStyle: "solid",
              borderRadius: 0,
            }}
          >
            Cancel
          </button>
        </div>
    </>
  );
  const renderProposedMovePanel = (): React.ReactNode => (
    <div
      className={
        isLandscapeMobile
          ? "flex min-h-0 min-w-0 flex-1 flex-col border border-solid p-1"
          : chromeOnSide
          ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto border border-solid p-3"
          : "min-h-0 flex-1 border border-solid p-3"
      }
      style={{
        backgroundColor: "var(--color-near-black)",
        borderColor: "var(--color-gunmetal)",
        borderTopColor: "var(--color-steel)",
        borderLeftColor: "var(--color-steel)",
        borderRadius: 0,
      }}
    >
      <div
        className={
          isLandscapeMobile
            ? "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2 p-1"
            : "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 p-4"
        }
      >
        {renderProposedMoveSubmitRow()}
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${isLandscapeMobile ? "gap-2" : "gap-4"}`}>
          <div
            className={
              isLandscapeMobile
                ? "flex min-h-0 min-w-0 flex-1 flex-col gap-2"
                : chromeOnSide
                ? "flex min-h-0 min-w-0 flex-1 flex-col gap-4"
                : "flex min-h-0 min-w-0 flex-1 flex-row items-stretch gap-6"
            }
          >
            <div className="flex min-w-0 flex-shrink-0 flex-col gap-1">
              {(() => {
                const ship = shipMap.get(selectedShipId!);
                const name =
                  ship?.name || `Ship #${selectedShipId?.toString()}`;
                const currentPos = gameState.shipPositions.find(
                  (pos) => pos.shipId === selectedShipId?.toString(),
                );
                const fromRow = currentPos?.position.row ?? 0;
                const fromCol = currentPos?.position.col ?? 0;
                const toRow = previewPosition
                  ? previewPosition.row
                  : fromRow;
                const toCol = previewPosition
                  ? previewPosition.col
                  : fromCol;
                return (
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="text-sm font-semibold text-white">
                      {name}
                    </div>
                    <div className={`font-mono text-text-secondary ${isLandscapeMobile ? "text-xs" : "text-sm"}`}>
                      ({fromRow}, {fromCol}) → ({toRow}, {toCol})
                    </div>
                  </div>
                );
              })()}
              {/* Weapon / Special selector, mirroring main game UI */}
              {(() => {
                if (isSelectedShipDisabled || isLandscapeMobile) return null;
                if (!selectedShipId) return null;
                const ship = shipMap.get(selectedShipId);
                if (!ship || !shipHasActivatableSpecial(ship)) return null;
                return (
                  <TutorialTarget active={shouldHighlightSpecialEmpWeaponDropdown} className="mt-1 w-full">
                    <div>
                      <select
                        value={selectedWeaponType}
                        onChange={(e) => {
                          const newWeaponType = e.target.value as
                            | "weapon"
                            | "special";
                          setWeaponTypeFromGrid(newWeaponType);
                          // In tutorial we do not have a boarding special; keep target as-is.
                        }}
                        className="w-full px-3 py-1.5 text-sm uppercase font-semibold tracking-wider"
                        style={{
                          ...STYLE_MONO,
                          borderRadius: 0,
                          backgroundColor: "var(--color-slate)",
                          color: "var(--color-text-primary)",
                        }}
                      >
                        <option value="weapon">
                          {getMainWeaponName(ship.equipment.mainWeapon, ship.traits.variant)}
                        </option>
                        <option value="special">
                          {getSpecialName(ship.equipment.special, ship.traits.variant)}
                        </option>
                      </select>
                    </div>
                  </TutorialTarget>
                );
              })()}
            </div>

            {/* Center: Target selection, mirroring main game UI */}
            {!isSelectedShipDisabled && validTargets.length > 0 && (
              <div
                className={
                  chromeOnSide
                    ? "flex min-h-0 min-w-0 flex-1 flex-col"
                    : "min-h-0 flex-1"
                }
              >
                <div
                  className={
                    chromeOnSide
                      ? "flex min-h-0 min-w-0 flex-1 flex-col border border-solid p-3"
                      : "min-h-[7.5rem] border border-solid p-3"
                  }
                  style={{
                    backgroundColor: "var(--color-near-black)",
                    borderColor: "var(--color-gunmetal)",
                    borderTopColor: "var(--color-steel)",
                    borderLeftColor: "var(--color-steel)",
                    borderRadius: 0,
                  }}
                >
                  <div
                    className="shrink-0 text-xs mb-2 uppercase tracking-wide"
                    style={{
                      ...STYLE_MONO,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    Select Target (Optional)
                  </div>
                  <div className={proposedMoveTargetListClass}>
                    {validTargets.map((target) => {
                      const targetShip = shipMap.get(
                        BigInt(target.shipId),
                      );
                      const isHammerTargetTutorialHighlight =
                        currentStep?.id === "shoot" &&
                        previewPosition !== null &&
                        targetShipId === null &&
                        BigInt(target.shipId) === 2001n;
                      const isSelectedTarget =
                        targetShipId !== null &&
                        targetShipId === BigInt(target.shipId);
                      const isRepair =
                        selectedWeaponType === "special" &&
                        isRepairDronesSpecial(
                          Number(selectedShip?.traits.variant ?? 1),
                          specialType,
                        );
                      const accentColor = isRepair
                        ? "var(--color-cyan)"
                        : "var(--color-warning-red)";
                      const targetButtonStyle: React.CSSProperties = {
                        ...STYLE_LABEL,
                        borderColor: isSelectedTarget
                          ? accentColor
                          : "var(--color-gunmetal)",
                        borderTopColor: isSelectedTarget
                          ? accentColor
                          : "var(--color-steel)",
                        borderLeftColor: isSelectedTarget
                          ? accentColor
                          : "var(--color-steel)",
                        color: accentColor,
                        backgroundColor: isSelectedTarget
                          ? "var(--color-steel)"
                          : "var(--color-slate)",
                        borderWidth: "2px",
                        borderStyle: "solid",
                        borderRadius: 0,
                      };
                      const targetButton = (
                        <button
                          onClick={() =>
                            setTargetShipId(BigInt(target.shipId))
                          }
                          className={proposedMoveTargetBtnClass}
                          style={targetButtonStyle}
                        >
                          {`[>] `}
                          {targetShip?.name ||
                            `#${BigInt(target.shipId).toString()}`}
                        </button>
                      );
                      return (
                        <TutorialTarget
                          key={target.shipId}
                          active={isHammerTargetTutorialHighlight}
                          pointer="inline"
                          inside
                        >
                          {targetButton}
                        </TutorialTarget>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {chromeOnSide &&
              (validTargets.length === 0 || isSelectedShipDisabled) && (
                <div className="min-h-0 min-w-0 flex-1" aria-hidden />
              )}
          </div>
          <button
            type="button"
            onClick={handleChooseRetreat}
            className="w-full shrink-0 px-3 py-1.5 text-sm uppercase font-semibold tracking-wider transition-colors duration-150"
            style={{
              ...STYLE_LABEL,
              borderColor:
                actionOverride === ActionType.Retreat
                  ? "var(--color-warning-red)"
                  : "var(--color-gunmetal)",
              borderTopColor:
                actionOverride === ActionType.Retreat
                  ? "var(--color-warning-red)"
                  : "var(--color-steel)",
              borderLeftColor:
                actionOverride === ActionType.Retreat
                  ? "var(--color-warning-red)"
                  : "var(--color-steel)",
              color:
                actionOverride === ActionType.Retreat
                  ? "var(--color-warning-red)"
                  : "var(--color-text-secondary)",
              backgroundColor:
                actionOverride === ActionType.Retreat
                  ? "color-mix(in srgb, var(--color-warning-red) 15%, transparent)"
                  : "var(--color-slate)",
              borderWidth: "2px",
              borderStyle: "solid",
              borderRadius: 0,
            }}
            onMouseEnter={(e) => {
              if (actionOverride !== ActionType.Retreat) {
                e.currentTarget.style.borderColor =
                  "var(--color-warning-red)";
                e.currentTarget.style.color =
                  "var(--color-warning-red)";
                e.currentTarget.style.backgroundColor =
                  "color-mix(in srgb, var(--color-warning-red) 12%, transparent)";
              }
            }}
            onMouseLeave={(e) => {
              if (actionOverride !== ActionType.Retreat) {
                e.currentTarget.style.borderColor =
                  "var(--color-gunmetal)";
                e.currentTarget.style.color =
                  "var(--color-text-secondary)";
                e.currentTarget.style.backgroundColor =
                  "var(--color-slate)";
              }
            }}
          >
            Retreat
          </button>
        </div>
      </div>
    </div>
  );

  if (isLandscapeMobile) {
    return (
      <GridHoverProvider>
      <div className="mx-auto h-full w-full overflow-hidden" style={{ height: "100dvh" }}>
        <div className="flex h-full min-h-0 items-stretch gap-2 overflow-hidden">
          <div
            className={`flex h-full min-h-0 min-w-[12rem] flex-1 items-center justify-center ${
              isMobileJoiner ? "order-2" : "order-1"
            }`}
          >
            <div className="relative flex h-[min(100%,39rem)] min-h-0 w-full max-w-[18rem] flex-col pl-1 pr-2 py-2">
              <LandscapeBattleHeader
                onBack={onBack}
                round={gameState.turnState.currentRound}
                turnLabel={rotatePromptTurnLabel(null, isMyTurn, true)}
                turnTone={isMyTurn ? "mine" : "theirs"}
                myScore={Number(myScore)}
                opponentScore={Number(opponentScore)}
                maxScore={Number(maxScore)}
                menuItems={[
                  { label: "Reset tutorial", onClick: () => resetTutorial(), tone: "warn" },
                  ...(onBack ? [{ label: exitLabel, onClick: onBack }] : []),
                ]}
              />

              <LandscapeRailTabs
                tabs={["tutorial", "status", "actions", "events", "fleets"]}
                active={mobileLeftPanelTab}
                onSelect={(tab) => {
                  if (tab === "fleets") setIsMobileFleetModalOpen(true);
                  else setMobileLeftPanelTab(tab);
                }}
              />

              <div
                className={`min-h-0 flex-1 ${
                  mobileLeftPanelTab === "tutorial"
                    ? "overflow-hidden"
                    : "overflow-y-auto"
                }`}
              >
                {mobileLeftPanelTab === "tutorial" ? (
                  tutorialGridPanelConfig ? (
                    <div
                      className="flex h-full min-h-0 flex-col border border-solid p-2"
                      style={{
                        borderColor: "var(--color-gunmetal)",
                        backgroundColor: "color-mix(in srgb, var(--color-near-black) 85%, transparent)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          className="min-w-0 text-sm font-bold uppercase tracking-wide text-cyan leading-tight"
                          style={{
                            ...STYLE_LABEL,
                          }}
                        >
                          {tutorialGridPanelConfig.title}
                        </h3>
                        <span className="shrink-0 text-[10px] font-mono text-text-muted">
                          {displayStepNumber}/{displayTotalSteps}
                        </span>
                      </div>

                      <div className="h-1 w-full bg-gunmetal">
                        <div
                          className="h-1 bg-cyan transition-all duration-300"
                          style={{
                            width: `${(displayStepNumber / displayTotalSteps) * 100}%`,
                          }}
                        />
                      </div>

                      <div className="relative mt-2 min-h-0 flex-1">
                        <div
                          ref={mobileTutorialScrollRef}
                          onScroll={updateMobileTutorialScrollHint}
                          className="h-full overflow-y-auto overscroll-contain pr-0.5 [touch-action:pan-y]"
                        >
                          <div
                            ref={mobileTutorialContentRef}
                            className="space-y-2.5"
                          >
                            {typeof tutorialGridPanelConfig.brief === "string" ? (
                              <p
                                className="text-[11px] leading-relaxed whitespace-pre-line text-text-primary"
                                style={{
                                  ...STYLE_MONO,
                                }}
                              >
                                {toMobileTouchCopy(tutorialGridPanelConfig.brief)}
                              </p>
                            ) : (
                              <div
                                className="space-y-1 text-[11px] leading-relaxed text-text-primary"
                                style={{
                                  ...STYLE_MONO,
                                }}
                              >
                                {mapNodeToMobileTouchCopy(tutorialGridPanelConfig.brief)}
                              </div>
                            )}

                            {tutorialGridPanelConfig.tasks &&
                            tutorialGridPanelConfig.tasks.length > 0 ? (
                              <div className="space-y-1">
                                <p
                                  className="text-[10px] uppercase tracking-wider text-cyan/90"
                                  style={{
                                    ...STYLE_MONO,
                                  }}
                                >
                                  {mapNodeToMobileTouchCopy(
                                    tutorialGridPanelConfig.tasksSectionLabel ?? "Orders",
                                  )}
                                </p>
                                <ol
                                  className="list-decimal list-outside pl-4 space-y-0.5 text-[11px] leading-snug text-text-primary"
                                  style={{
                                    ...STYLE_MONO,
                                  }}
                                >
                                  {tutorialGridPanelConfig.tasks.map((task, idx) => {
                                    const key =
                                      React.isValidElement(task) && task.key != null
                                        ? String(task.key)
                                        : String(idx);
                                    return (
                                      <li key={key}>{mapNodeToMobileTouchCopy(task)}</li>
                                    );
                                  })}
                                </ol>
                              </div>
                            ) : null}

                            {tutorialGridPanelConfig.primaryCta ? (
                              <div className="space-y-1.5 border border-solid p-2" style={{ borderColor: "var(--color-cyan)", backgroundColor: "rgba(0, 38, 54, 0.35)" }}>
                                <p
                                  className="text-sm font-bold uppercase tracking-wide text-cyan"
                                  style={{
                                    ...STYLE_LABEL,
                                  }}
                                >
                                  {tutorialGridPanelConfig.primaryCta.headline}
                                </p>
                                <div
                                  className="text-[11px] leading-relaxed text-text-primary"
                                  style={{
                                    ...STYLE_MONO,
                                  }}
                                >
                                  {tutorialGridPanelConfig.primaryCta.supporting}
                                </div>
                                <button
                                  type="button"
                                  onClick={tutorialGridPanelConfig.primaryCta.onClick}
                                  className="w-full border border-solid px-2 py-1 text-xs uppercase tracking-wider"
                                  style={{
                                    borderColor: "var(--color-cyan)",
                                    color: "var(--color-cyan)",
                                    backgroundColor: "var(--color-near-black)",
                                    borderRadius: 0,
                                  }}
                                >
                                  {tutorialGridPanelConfig.primaryCta.buttonLabel}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {mobileTutorialMoreBelow ? (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-10 items-end justify-center bg-gradient-to-t from-near-black from-30% via-near-black/75 to-transparent pb-1">
                            <span className="border border-cyan/40 bg-near-black/95 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-cyan">
                              Scroll for more
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid shrink-0 grid-cols-2 gap-1.5 pt-2">
                        <button
                          type="button"
                          onClick={() => previousStep()}
                          disabled={currentStepIndex === 0}
                          className="h-10 px-2 border border-solid text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            borderColor: "var(--color-gunmetal)",
                            color: "var(--color-text-secondary)",
                            backgroundColor: "var(--color-steel)",
                            borderRadius: 0,
                          }}
                        >
                          ← Prev
                        </button>
                        {!isVisibleLastStep ? (
                          // Same as the task panel's Next (TutorialGridTaskPanel).
                          <TutorialTarget active={isStepComplete} pointer="none">
                            <button
                              type="button"
                              onClick={() => nextStep()}
                              disabled={!isStepComplete}
                              className="h-10 w-full px-2 border border-solid text-xs uppercase tracking-wider disabled:cursor-not-allowed"
                              style={{
                                borderColor: isStepComplete ? "var(--color-phosphor-green)" : "var(--color-gunmetal)",
                                color: isStepComplete ? "var(--color-phosphor-green)" : "var(--color-text-muted)",
                                backgroundColor: "var(--color-near-black)",
                                borderRadius: 0,
                              }}
                            >
                              NEXT &gt;&gt;
                            </button>
                          </TutorialTarget>
                        ) : (
                          <div />
                        )}
                      </div>
                    </div>
                  ) : isReportOnlyStep(currentStep?.id) ? null : (
                    <div className="text-sm text-text-secondary">
                      Tutorial briefing unavailable for this step.
                    </div>
                  )
                ) : null}
                {mobileLeftPanelTab === "actions" ? (
                  isShowingProposedMove ? (
                    <div className="space-y-2">
                      <div className="text-sm text-text-secondary">
                        Submit your selected move or cancel and pick again.
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCancelMove}
                          className="flex-1 px-2 py-1 border border-solid text-xs uppercase tracking-wider"
                          style={{
                            borderColor: "var(--color-gunmetal)",
                            color: "var(--color-text-secondary)",
                            backgroundColor: "var(--color-steel)",
                            borderRadius: 0,
                          }}
                        >
                          Cancel
                        </button>
                        <TutorialTarget active={shouldPulseSubmitMoveButton} className="flex-1">
                          <button
                            type="button"
                            onClick={handleSubmitMove}
                            disabled={isConfirmingMove}
                            className={`w-full px-2 py-1 border border-solid text-xs uppercase tracking-wider `}
                            style={{
                              borderColor: "var(--color-phosphor-green)",
                              color: "var(--color-phosphor-green)",
                              backgroundColor: "var(--color-near-black)",
                              borderRadius: 0,
                            }}
                          >
                            {isConfirmingMove ? "[...]" : "Submit"}
                          </button>
                        </TutorialTarget>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-text-secondary">
                      Select a ship and choose a destination to open actions.
                    </div>
                  )
                ) : null}
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
                  </div>
                ) : null}
                {mobileLeftPanelTab === "events" ? (
                  <GameEvents
                    lastMove={toGameEventsLastMove(selectedShipId !== null ? undefined : lastMoveForEvents)}
                    shipMap={gameEventsShipMap}
                    address={TUTORIAL_PLAYER_ADDRESS}
                    appendDestroyedText={
                      currentStep?.id === "ship-destruction" ||
                      currentStep?.id === "rescue"
                    }
                  />
                ) : null}
              </div>

              {selectedShip ? (
                <LandscapeShipSheet
                  above={
                    // This sheet covers the tutorial card, so keep the step
                    // in view: its title and progress. Close returns to it.
                    tutorialGridPanelConfig ? (
                      <div className="mb-1.5 flex shrink-0 items-baseline justify-between gap-2 border-l-2 border-cyan pl-1.5 font-mono text-[11px] uppercase tracking-wide text-cyan">
                        <span className="truncate">{tutorialGridPanelConfig.title}</span>
                        <span className="shrink-0 text-text-muted">
                          {displayStepNumber}/{displayTotalSteps}
                        </span>
                      </div>
                    ) : null
                  }
                  shipImage={<ShipImage ship={selectedShip} className="h-full w-full" />}
                  shipName={selectedShip.name || `Ship #${selectedShip.id.toString()}`}
                  hullPercent={
                    mobileSelectedShipAttributes && mobileSelectedShipAttributes.maxHullPoints > 0
                      ? (mobileSelectedShipAttributes.hullPoints / mobileSelectedShipAttributes.maxHullPoints) * 100
                      : undefined
                  }
                  menuItems={
                    isShowingProposedMove && !isSelectedShipDisabled
                      ? [{ label: "Retreat", onClick: handleChooseRetreat, tone: "danger" }]
                      : []
                  }
                  onClose={() => setSelectedShipId(null)}
                  wrapClose={(button) => (
                    <TutorialTarget active={shouldHighlightMobileCloseButton} pointer="below">
                      {button}
                    </TutorialTarget>
                  )}
                  footer={isShowingProposedMove ? renderProposedMoveSubmitRow() : null}
                >
                  <div className="space-y-0.5">
                    {/* Same as GameDisplay: the staged move first. */}
                    {isShowingProposedMove ? renderLandscapeStagedMove() : null}
                    <div className="origin-top scale-[0.9] transform-gpu">
                      <ShipCard
                        ship={toShipCardData(selectedShip)}
                        shipImage={<ShipImage ship={selectedShip} className="h-full w-full" />}
                        isStarred={false}
                        onToggleStar={() => {}}
                        isSelected={true}
                        onToggleSelection={() => {}}
                        onRecycleClick={() => {}}
                        showInGameProperties={true}
                        inGameAttributes={mobileSelectedShipAttributes ?? undefined}
                        attributesLoading={false}
                        hideRecycle={true}
                        hideCheckbox={true}
                        isCurrentPlayerShip={isShipOwnedByCurrentPlayer(selectedShip.id)}
                        flipShip={Boolean(mobileSelectedShipPosition?.isCreator)}
                        reactorCriticalStatus={mobileReactorCriticalStatus}
                        hasMoved={movedShipIdsSet.has(selectedShip.id.toString() as TutorialShipId)}
                        gameViewMode={true}
                        hideRarityLabel={true}
                        hideRankLabel={true}
                        hideOuterFrame={true}
                        layoutShipId={selectedShip.id.toString()}
                      />
                    </div>
                  </div>
                </LandscapeShipSheet>
              ) : null}
            </div>
          </div>

          <div
            // The board gives up width before the left column drops below
            // 12rem (small phones): its height is capped so its 17:11 width
            // fits beside the column, and it centers vertically.
            className={`relative min-h-0 shrink-0 self-center overflow-hidden ${
              isMobileJoiner ? "order-1" : "order-2"
            }`}
            style={{
              aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}`,
              height: LANDSCAPE_BOARD_HEIGHT,
            }}
          >
            <div
              className="h-full max-h-full"
              style={{
                height: "100%",
                width: "auto",
                aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}`,
              }}
            >
              <GameBoardLayout
                isCurrentPlayerTurn={isMyTurn}
                containerRef={gridContainerRef}
                onBoardChromeMouseDown={handleBoardChromeMouseDown}
                overlay={missionDialogOverlay}
              >
                <div
                  className="relative h-full [contain:layout]"
                  style={{ aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}` }}
                >
                  <div className="absolute inset-0 min-h-0 overflow-hidden">
                    <GameGrid
                      grid={gridForDisplay}
                      allShipPositions={allShipPositionsForDisplay}
                      shipMap={shipMapForDisplay}
                      selectedShipId={selectedShipIdForDisplay}
                      previewPosition={previewPosition}
                      targetShipId={targetShipIdForDisplay}
                      selectedWeaponType={selectedWeaponType}
                      draggedShipId={draggedShipIdForDisplay}
                      dragOverCell={dragOverCell}
                      movementRange={movementRange}
                      shootingRange={shootingRange}
                      validTargets={gridValidTargetsForDisplay}
                      assistableTargets={gridAssistableTargetsForDisplay}
                      assistableTargetsFromStart={gridAssistableTargetsFromStartForDisplay}
                      dragShootingRange={dragShootingRange}
                      dragValidTargets={dragValidTargetsForDisplay}
                      labelTargets={labelTargetsForDisplay}
                      getHoverPreview={getHoverPreview}
                      isCurrentPlayerTurn={isMyTurn}
                      isShipOwnedByCurrentPlayer={isShipOwnedByCurrentPlayerForDisplay}
                      movedShipIdsSet={gridMovedShipIdsSetForDisplay}
                      specialType={specialType}
                      specialRange={specialRange}
                      blockedGrid={blockedGrid}
                      scoringGrid={scoringGrid}
                      onlyOnceGrid={onlyOnceGrid}
                      calculateDamage={calculateDamageForDisplay}
                      getShipAttributes={getShipAttributesForDisplay}
                      disableTooltips={true}
                      address={TUTORIAL_PLAYER_ADDRESS}
                      currentTurn={gameState.turnState.currentTurn}
                      highlightedMovePosition={highlightedMovePosition}
                      lastMoveShipId={lastMoveShipIdForDisplay}
                      lastMoveOldPosition={lastMoveProps.lastMoveOldPosition}
                      lastMoveNewPosition={lastMoveProps.lastMoveNewPosition}
                      lastMoveResolvedTo={lastMoveResolvedTo}
                      lastMoveActionType={lastMoveProps.lastMoveActionType}
                      lastMoveTargetShipId={lastMoveTargetShipIdForDisplay}
                      lastMoveIsCurrentPlayer={lastMoveProps.lastMoveIsCurrentPlayer}
                      showLastMoveEmpReplayWhenSelected={
                        currentStep?.id === "ship-destruction" ||
                        currentStep?.id === "destroy-disabled"
                      }
                      retreatPrepShipId={retreatPrepShipIdForDisplay}
                      retreatPrepIsCreator={retreatPrepIsCreator}
                      tutorialHighlightCells={tutorialHighlightCells}
                      tutorialWeaponOption={
                        // The board's weapon picker is the only one here.
                        shouldHighlightSpecialEmpWeaponDropdown ? "special" : undefined
                      }
                      onGridRightClickDeselect={handleGridRightClickDeselect}
                      setSelectedShipId={setSelectedShipIdForDisplay}
                      setPreviewPosition={wrappedSetPreviewPosition}
                      setTargetShipId={setTargetShipIdForDisplay}
                      setSelectedWeaponType={setWeaponTypeFromGrid}
                      setDraggedShipId={setDraggedShipIdForDisplay}
                      setDragOverCell={setDragOverCell}
                      renderShipCard={renderShipCard}
                    />
                  </div>
                  <div
                    className={`pointer-events-none absolute top-1 z-[230] ${
                      isMobileJoiner ? "left-1" : "right-1"
                    }`}
                  >
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
                      {isMobileFleeOpen ? (
                        <div
                          className={`absolute top-[calc(100%+6px)] w-[13.25rem] border border-solid p-1 ${
                            // Opens toward the board: the flag sits on the left for the joiner.
                            isMobileJoiner ? "left-0" : "right-0"
                          }`}
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--color-near-black) 98%, transparent)",
                            borderColor: "var(--color-warning-red)",
                            borderRadius: 0,
                          }}
                        >
                          <FleeSafetySwitch locked renderConfirmButton={() => null} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </GameBoardLayout>
            </div>
          </div>
        </div>

        {isMobileFleetModalOpen ? (
          <div className="fixed inset-0 z-[310] flex flex-col bg-near-black p-3">
            <div className="mb-3 flex items-center justify-between border border-solid px-3 py-2" style={{ borderColor: "var(--color-gunmetal)", backgroundColor: "var(--color-near-black)" }}>
              <h3 className="text-sm uppercase tracking-wider text-cyan">[FLEET INTEL]</h3>
              <button
                type="button"
                onClick={() => setIsMobileFleetModalOpen(false)}
                className="px-2 py-1 text-xs uppercase border border-solid"
                style={{
                  borderColor: "var(--color-gunmetal)",
                  color: "var(--color-text-secondary)",
                  backgroundColor: "var(--color-steel)",
                  borderRadius: 0,
                }}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto border border-solid p-3" style={{ borderColor: "var(--color-gunmetal)", backgroundColor: "var(--color-slate)" }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="mb-2 text-xs uppercase tracking-wider text-cyan">[MY FLEET]</h4>
                  <div className="space-y-2">
                    {gameState.creatorActiveShipIds
                      .filter(() => !isMobileJoiner)
                      .concat(gameState.joinerActiveShipIds.filter(() => isMobileJoiner))
                      .map((shipId) => {
                        const ship = shipMap.get(BigInt(shipId));
                        const attrs = getShipAttributes(shipId);
                        const hasMoved = movedShipIdsSet.has(shipId);
                        if (!ship || !attrs) return null;
                        return (
                          <ShipCard
                            key={`my-${shipId}`}
                            ship={toShipCardData(ship)}
                            shipImage={<ShipImage ship={ship} className="h-full w-full" />}
                            isStarred={false}
                            onToggleStar={() => {}}
                            isSelected={false}
                            onToggleSelection={() => {}}
                            onRecycleClick={() => {}}
                            showInGameProperties={true}
                            inGameAttributes={attrs}
                            attributesLoading={false}
                            hideRecycle={true}
                            hideCheckbox={true}
                            isCurrentPlayerShip={true}
                            flipShip={ship.owner === gameState.metadata.creator}
                            reactorCriticalStatus={
                              attrs.reactorCriticalTimer > 0 && attrs.hullPoints === 0
                                ? "critical"
                                : attrs.reactorCriticalTimer > 0
                                  ? "warning"
                                  : "none"
                            }
                            hasMoved={hasMoved}
                            gameViewMode={true}
                          />
                        );
                      })}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-xs uppercase tracking-wider text-warning-red">Opponent&apos;s Fleet</h4>
                  <div className="space-y-2">
                    {gameState.creatorActiveShipIds
                      .filter(() => isMobileJoiner)
                      .concat(gameState.joinerActiveShipIds.filter(() => !isMobileJoiner))
                      .map((shipId) => {
                        const ship = shipMap.get(BigInt(shipId));
                        const attrs = getShipAttributes(shipId);
                        const hasMoved = movedShipIdsSet.has(shipId);
                        if (!ship || !attrs) return null;
                        return (
                          <ShipCard
                            key={`opp-${shipId}`}
                            ship={toShipCardData(ship)}
                            shipImage={<ShipImage ship={ship} className="h-full w-full" />}
                            isStarred={false}
                            onToggleStar={() => {}}
                            isSelected={false}
                            onToggleSelection={() => {}}
                            onRecycleClick={() => {}}
                            showInGameProperties={true}
                            inGameAttributes={attrs}
                            attributesLoading={false}
                            hideRecycle={true}
                            hideCheckbox={true}
                            isCurrentPlayerShip={false}
                            flipShip={ship.owner === gameState.metadata.creator}
                            reactorCriticalStatus={
                              attrs.reactorCriticalTimer > 0 && attrs.hullPoints === 0
                                ? "critical"
                                : attrs.reactorCriticalTimer > 0
                                  ? "warning"
                                  : "none"
                            }
                            hasMoved={hasMoved}
                            gameViewMode={true}
                          />
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {roundReportModal}
      </div>
      </GridHoverProvider>
    );
  }

  return (
    <GridHoverProvider>
    <div
      ref={gameViewRootRef}
      className={`flex flex-col ${
        isLandscapeMobile ? "h-[100dvh] overflow-hidden" : ""
      } ${
        isLandscapeMobile ? "gap-2 pb-2" : "gap-6"
      } ${
        chromeOnSide ? GAME_VIEW_SIDE_ROOT_CLASS : "mx-auto w-full"
      }`}
      style={
        isLandscapeMobile
          ? {
              marginLeft: 0,
              width: "100%",
              maxWidth: "none",
            }
          : chromeOnSide
          ? {
              marginLeft: "8px",
            }
          : undefined
      }
    >
      {selfieCheckWidgetElement}
      <div
        className={
          chromeOnSide
            ? sideChrome.row
            : "flex flex-col gap-6 pt-3"
        }
      >
        {/* Header: back + game/round/turn + score + (optional) proposed move + Flee locked */}
        <div
          className={
            chromeOnSide
              ? sideChrome.rail
              : "flex items-start justify-between gap-6"
          }
          style={chromeOnSide ? sideChrome.railMaxHeight : undefined}
        >
          <div
            className={
              chromeOnSide
                ? "flex shrink-0 flex-col items-stretch gap-3"
                : "flex items-center gap-4"
            }
          >
            <div className="flex w-full min-w-0 items-stretch gap-2">
              <div className="flex w-1/5 min-h-0 shrink-0 justify-start">
                <button
                  onClick={onBack}
                  className="flex min-h-0 w-full items-center justify-center px-4 py-2 border-2 border-solid uppercase font-semibold tracking-wider transition-colors duration-150"
                  style={{
                    ...STYLE_LABEL,
                    borderColor: "var(--color-gunmetal)",
                    color: "var(--color-text-secondary)",
                    backgroundColor: "var(--color-steel)",
                    borderRadius: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--color-slate)";
                    e.currentTarget.style.borderColor = "var(--color-cyan)";
                    e.currentTarget.style.color = "var(--color-cyan)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--color-steel)";
                    e.currentTarget.style.borderColor = "var(--color-gunmetal)";
                    e.currentTarget.style.color = "var(--color-text-secondary)";
                  }}
                >
                  ←
                </button>
              </div>
              <div className="flex min-h-0 w-4/5 min-w-0 flex-col justify-center">
                <FleeSafetySwitch locked renderConfirmButton={() => null} />
              </div>
            </div>
            <div
              className={
                chromeOnSide ? "flex flex-col gap-2" : "flex items-start gap-6"
              }
            >
              <div className="flex flex-col">
                <h1 className="text-2xl font-mono text-white flex items-center gap-3">
                  <span>Game 0</span>
                  <span className="text-text-muted text-base">
                    Round {gameState.turnState.currentRound.toString()}
                  </span>
                </h1>
                {/* Turn indicator (no countdown in tutorial / PvE) */}
                <div className="flex flex-col gap-1.5">
                  <div
                    className="text-sm flex items-center gap-2 uppercase font-semibold tracking-wider"
                    style={{
                      ...STYLE_LABEL,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <span
                      style={{
                        color: isMyTurn
                          ? "var(--color-cyan)"
                          : "var(--color-warning-red)",
                      }}
                    >
                      {isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN"}
                    </span>
                  </div>
                </div>
              </div>
              {/* Score grouped with game/round (same conceptual row as in reference).
                  The goals step highlights it (TutorialTarget, outside the
                  panel's overflow clip). */}
              <TutorialTarget
                active={currentStep?.id === "goals"}
                variant="highlight"
                className={chromeOnSide ? "w-full shrink-0" : "w-48 shrink-0"}
              >
              <div
                className="w-full border border-solid overflow-hidden"
                style={{
                  backgroundColor: "var(--color-slate)",
                  borderColor: "var(--color-gunmetal)",
                  borderTopColor: "var(--color-steel)",
                  borderLeftColor: "var(--color-steel)",
                  borderRadius: 0,
                }}
              >
                <div className="flex items-stretch" style={{ ...STYLE_MONO, fontSize: "22px" }}>
                  <div className="flex flex-1 items-center justify-center gap-2 px-3 py-2">
                    <span style={{ ...STYLE_LABEL, fontSize: 11, color: "var(--color-cyan)" }}>[YOU]</span>
                    <span title="Scores update at end of round." style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{gameState.creatorScore.toString()}/{gameState.maxScore.toString()}</span>
                  </div>
                  <div style={{ width: 1, backgroundColor: "var(--color-gunmetal)", flexShrink: 0 }} />
                  <div className="flex flex-1 items-center justify-center gap-2 px-3 py-2">
                    <span style={{ ...STYLE_LABEL, fontSize: 11, color: "var(--color-warning-red)" }}>[OPP]</span>
                    <span title="Scores update at end of round." style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{gameState.joinerScore.toString()}/{gameState.maxScore.toString()}</span>
                  </div>
                </div>
              </div>
              </TutorialTarget>
            </div>
            {dockTutorialPanel && renderTutorialTaskPanel(true)}
          </div>

          {/* Proposed Move panel: Submit/Cancel on top; below that, ship + targets.
            Shown when an owned ship is selected and eligible to act this round.
            Wide layout uses GameGrid's in-grid confirm widget instead (parity
            with GameDisplay.tsx, which does the same — see its useSideLayout
            branch); this panel is for the narrow/stacked layout only. */}
          {isShowingProposedMove && !useSideLayout && renderProposedMovePanel()}

        {/* Fleet status panel */}
        {chromeOnSide && (() => {
            const myIds = gameState.creatorActiveShipIds;
            const enemyIds = gameState.joinerActiveShipIds;

            const renderCard = (shipId: string, teamColor: string, flip: boolean) => {
              const numId = Number(shipId);
              const bigId = BigInt(numId);
              const ship = shipMap.get(bigId);
              const attrs = getShipAttributes(shipId);
              const shipPos = gameState.shipPositions.find((sp) => sp.shipId === shipId);
              return (
                <GameFleetStatusCard
                  key={shipId}
                  shipId={numId}
                  shipName={ship?.name ?? `#${shipId}`}
                  attributes={attrs}
                  hasMoved={movedShipIdsSet.has(shipId)}
                  teamColor={teamColor}
                  flip={flip}
                  isSelected={selectedShipId === bigId}
                  shipImage={ship && <ShipImage ship={ship} className="w-full h-full" showLoadingState={false} hideRankStars />}
                  onClick={() => setSelectedShipId(bigId)}
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

            return (
              <GameFleetStatusPanel
                myCount={myIds.length}
                enemyCount={enemyIds.length}
                onShowDetails={() => setShowFleetModal(true)}
                myCards={myIds.map((id) => renderCard(id, "var(--color-cyan)", true))}
                enemyCards={enemyIds.map((id) => renderCard(id, "var(--color-warning-red)", false))}
              />
            );
          })()}
        </div>

        <div
          className={
            chromeOnSide ? sideChrome.board : "relative w-full"
          }
        >
          <GameBoardLayout
            isCurrentPlayerTurn={isMyTurn}
            containerRef={gridContainerRef}
            onBoardChromeMouseDown={handleBoardChromeMouseDown}
            overlay={missionDialogOverlay}
          >
            {/* Fixed 17×11 aspect so the board does not resize between tutorial steps
              while state hydrates; overlay blocks interaction until ready. */}
            <div
              className="relative w-full [contain:layout]"
              style={{ aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}` }}
            >
              {!isStepHydrated && (
                <div
                  className="absolute inset-0 z-[200] flex items-center justify-center"
                  style={{ backgroundColor: "var(--color-near-black)" }}
                  aria-busy
                  aria-live="polite"
                >
                  <span className="text-cyan font-mono">
                    Preparing tutorial step...
                  </span>
                </div>
              )}
              <div className="absolute inset-0 min-h-0 overflow-hidden">
                <GameGrid
                  grid={gridForDisplay}
                  allShipPositions={allShipPositionsForDisplay}
                  shipMap={shipMapForDisplay}
                  selectedShipId={selectedShipIdForDisplay}
                  previewPosition={previewPosition}
                  targetShipId={targetShipIdForDisplay}
                  selectedWeaponType={selectedWeaponType}
                  draggedShipId={draggedShipIdForDisplay}
                  dragOverCell={dragOverCell}
                  movementRange={movementRange}
                  shootingRange={shootingRange}
                  validTargets={gridValidTargetsForDisplay}
                  assistableTargets={gridAssistableTargetsForDisplay}
                  assistableTargetsFromStart={gridAssistableTargetsFromStartForDisplay}
                  dragShootingRange={dragShootingRange}
                  dragValidTargets={dragValidTargetsForDisplay}
                  labelTargets={labelTargetsForDisplay}
                  getHoverPreview={getHoverPreview}
                  isCurrentPlayerTurn={isMyTurn}
                  isShipOwnedByCurrentPlayer={isShipOwnedByCurrentPlayerForDisplay}
                  movedShipIdsSet={gridMovedShipIdsSetForDisplay}
                  specialType={specialType}
                  specialRange={specialRange}
                  blockedGrid={blockedGrid}
                  scoringGrid={scoringGrid}
                  onlyOnceGrid={onlyOnceGrid}
                  calculateDamage={calculateDamageForDisplay}
                  getShipAttributes={getShipAttributesForDisplay}
                  disableTooltips={false}
                  address={TUTORIAL_PLAYER_ADDRESS}
                  currentTurn={gameState.turnState.currentTurn}
                  highlightedMovePosition={highlightedMovePosition}
                  lastMoveShipId={lastMoveShipIdForDisplay}
                  lastMoveOldPosition={lastMoveProps.lastMoveOldPosition}
                  lastMoveNewPosition={lastMoveProps.lastMoveNewPosition}
                  lastMoveResolvedTo={lastMoveResolvedTo}
                  lastMoveActionType={lastMoveProps.lastMoveActionType}
                  lastMoveTargetShipId={lastMoveTargetShipIdForDisplay}
                  lastMoveIsCurrentPlayer={
                    lastMoveProps.lastMoveIsCurrentPlayer
                  }
                  showLastMoveEmpReplayWhenSelected={
                    currentStep?.id === "ship-destruction" ||
                    currentStep?.id === "destroy-disabled"
                  }
                  retreatPrepShipId={retreatPrepShipIdForDisplay}
                  retreatPrepIsCreator={retreatPrepIsCreator}
                  tutorialHighlightCells={tutorialHighlightCells}
                  tutorialWeaponOption={
                    useSideLayout && shouldHighlightSpecialEmpWeaponDropdown ? "special" : undefined
                  }
                  onGridRightClickDeselect={handleGridRightClickDeselect}
                  setSelectedShipId={setSelectedShipIdForDisplay}
                  setPreviewPosition={wrappedSetPreviewPosition}
                  setTargetShipId={setTargetShipIdForDisplay}
                  setSelectedWeaponType={setWeaponTypeFromGrid}
                  setDraggedShipId={setDraggedShipIdForDisplay}
                  setDragOverCell={setDragOverCell}
                  renderShipCard={renderShipCard}
                  showConfirmWidget={useSideLayout && isShowingProposedMove}
                  confirmWidgetLabel={confirmWidgetLabel}
                  onCancelMove={handleCancelMove}
                  confirmButton={
                    useSideLayout && isShowingProposedMove ? (
                      // Inside the confirm widget, whose clip-path cuts anything
                      // drawn outside the button: brackets inside, no chevron.
                      <TutorialTarget active={shouldPulseSubmitMoveButton} pointer="none" inside className="flex-[2]">
                        <button
                          type="button"
                          onClick={handleSubmitMove}
                          disabled={isConfirmingMove}
                          className={`w-full px-4 py-2 text-xs uppercase font-bold tracking-widest transition-colors duration-100 `}
                          style={{
                            ...STYLE_LABEL,
                            color: "var(--color-phosphor-green)",
                            backgroundColor: "color-mix(in srgb, var(--color-phosphor-green) 10%, transparent)",
                            borderRight: "1px solid var(--color-gunmetal)",
                            borderRadius: 0,
                            letterSpacing: "0.14em",
                          }}
                        >
                          {confirmWidgetLabel}
                        </button>
                      </TutorialTarget>
                    ) : undefined
                  }
                />
              </div>
              {!dockTutorialPanel && renderTutorialTaskPanel(false)}
              <div className="absolute bottom-0 right-0 z-[220] pointer-events-none">
                <div className="pointer-events-auto">
                  {isLastMovePanelMinimized ? (
                    <button
                      type="button"
                      onClick={() => setIsLastMovePanelMinimized(false)}
                      className="px-3 py-1 border-2 border-solid uppercase font-semibold tracking-wider text-xs transition-colors duration-150"
                      style={{
                        ...STYLE_LABEL,
                        borderColor: "var(--color-purple)",
                        color: "var(--color-purple)",
                        backgroundColor: "color-mix(in srgb, var(--color-near-black) 88%, transparent)",
                        borderRadius: 0,
                      }}
                    >
                      Last Move
                    </button>
                  ) : (
                    <div className="w-[min(30rem,70vw)] max-w-full">
                      <div className="mb-1 flex items-center justify-between border border-solid px-2 py-1 bg-black/80">
                        <span
                          className="text-xs uppercase tracking-wider"
                          style={{
                            ...STYLE_LABEL,
                            color: "var(--color-purple)",
                          }}
                        >
                          Last Move
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsLastMovePanelMinimized(true)}
                          className="px-2 py-0.5 text-[11px] uppercase tracking-wider border border-solid"
                          style={{
                            ...STYLE_LABEL,
                            borderColor: "var(--color-purple)",
                            color: "var(--color-purple)",
                            backgroundColor: "var(--color-near-black)",
                            borderRadius: 0,
                          }}
                        >
                          Minimize
                        </button>
                      </div>
                      <GameEvents
                        lastMove={toGameEventsLastMove(lastMoveForEvents)}
                        shipMap={gameEventsShipMap}
                        address={TUTORIAL_PLAYER_ADDRESS}
                        appendDestroyedText={
                          currentStep?.id === "ship-destruction" ||
                          currentStep?.id === "rescue"
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </GameBoardLayout>
        </div>
      </div>

      {/* Fleet Details Modal */}
      {showFleetModal && (() => {
        const buildFleetDetailCards = (
          shipIds: readonly string[],
          isCurrentPlayerShip: boolean,
          flipShip: boolean,
        ) =>
          shipIds.map((shipId) => {
            const attributes = getShipAttributes(shipId);
            const ship = shipMap.get(BigInt(Number(shipId)));
            if (!attributes || !ship) return null;
            return (
              <GameFleetDetailShipCard
                key={shipId}
                shipId={shipId}
                ship={toShipCardData(ship)}
                shipImage={<ShipImage ship={ship} className="h-full w-full" />}
                attributes={attributes}
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
            myFleetLabel="My Fleet"
            enemyFleetLabel="Opponent's Fleet"
            myFleetCards={buildFleetDetailCards(gameState.creatorActiveShipIds, true, true)}
            enemyFleetCards={buildFleetDetailCards(gameState.joinerActiveShipIds, false, false)}
          />
        );
      })()}
      {roundReportModal}
    </div>
    </GridHoverProvider>
  );
}
