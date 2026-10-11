"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayerGames } from "../hooks/usePlayerGames";
import GameDisplay from "./GameDisplay";
import { BattlesInbox, type BattleInboxItem } from "./BattlesInbox";
import { resolveNodeContent, useWeb3NodeContent } from "../hooks/useNodeContent";
import { useGetRoguelikeRun } from "../hooks/useRoguelikeRun";
import type { RoguelikeRun } from "../types/roguelike";
import { GameDataView } from "../types/types";
import { VOID_TACTICS_CHAIN_CHANGED_EVENT } from "../config/networks";
import { ROGUELIKE_MATCH_ADDRESS } from "../hooks/useRoguelikeMatch";
import { useShowPveGames } from "../hooks/useShowPveGames";
import { isPveGame } from "../utils/pveGames";
import { setUrlParams, useUrlParam } from "../utils/urlState";

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const Games: React.FC = () => {
  const { address, isConnected } = useAccount();
  // The open match is in the URL (`?game=<id>`, `&replay=1` when opened
  // from the inbox's Replay button; see urlState.ts), so a refresh reopens
  // it and Back returns to the list. `selectedGame` is the list row it was
  // opened from (GameDisplay fetches live state itself).
  const urlGameId = useUrlParam("game");
  const startInReplay = useUrlParam("replay") === "1";
  const [selectedGame, setSelectedGame] = useState<GameDataView | null>(null);
  const { games, isLoading, isFetching, error, refetch } = usePlayerGames({
    enabled: !selectedGame,
  });
  const queryClient = useQueryClient();
  const [isResettingCache, setIsResettingCache] = useState(false);

  // Debug affordance: the games list is read through wagmi/TanStack Query,
  // which caches by (address, chainId, args) and only refetches in the
  // background — so a stale/empty cached result can keep showing even after
  // the underlying chain state has changed. This forces every cached read
  // (not just this one) to be thrown out and refetched, to rule caching in
  // or out when a game unexpectedly isn't appearing.
  const handleResetCache = async () => {
    setIsResettingCache(true);
    try {
      queryClient.clear();
      await refetch();
    } finally {
      setIsResettingCache(false);
    }
  };
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const TIE_ADDRESS = "0x0000000000000000000000000000000000000001";

  // Track if component has mounted (client-side only)
  const [isMounted, setIsMounted] = useState(false);

  // Ticker to update countdown timers (list view only).
  const [, setTick] = useState(0);

  // Update ticker every second to refresh countdown timers. Pause while a
  // match is open so this parent clock does not re-render GameDisplay at 1Hz.
  useEffect(() => {
    if (selectedGame) return;
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedGame]);

  // Helper function to calculate time remaining for a game
  const calculateTimeRemaining = (game: GameDataView): number => {
    const turnTimeSec = Number(game.turnState.turnTime || 0n);
    const turnStartSec = Number(game.turnState.turnStartTime || 0n);
    if (!turnTimeSec || !turnStartSec) return 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const elapsed = Math.max(0, nowSec - turnStartSec);
    return Math.max(0, turnTimeSec - elapsed);
  };

  const sortedGames = useMemo(() => {
    const copy = [...games];
    copy.sort((a, b) => {
      const aInProgress = a.metadata.winner === ZERO_ADDRESS ? 1 : 0;
      const bInProgress = b.metadata.winner === ZERO_ADDRESS ? 1 : 0;
      if (aInProgress !== bInProgress) return bInProgress - aInProgress;
      const aStarted = Number(a.metadata.startedAt || 0n);
      const bStarted = Number(b.metadata.startedAt || 0n);
      return bStarted - aStarted;
    });
    return copy;
  }, [games]);

  const [showPve, setShowPve] = useShowPveGames();
  const visibleGames = useMemo(
    () => (showPve ? sortedGames : sortedGames.filter((g) => !isPveGame(g))),
    [sortedGames, showPve],
  );

  // Mark component as mounted after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Follow the URL: open the match it names once the list has it (a match
  // just created may not be in it yet: keep the id and wait, see
  // waitingForSeededGame), close it when the id goes (Back, the list
  // button).
  useEffect(() => {
    if (!urlGameId) {
      if (selectedGame) setSelectedGame(null);
      return;
    }
    if (selectedGame?.metadata.gameId.toString() === urlGameId) return;
    if (!isConnected || !address) return;
    const game = games.find((g) => g.metadata.gameId.toString() === urlGameId);
    setSelectedGame(game ?? null);
  }, [urlGameId, selectedGame, games, isConnected, address]);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const stableListRefetch = useCallback(() => {
    void refetchRef.current();
  }, []);

  const [mountRefetchDone, setMountRefetchDone] = useState(false);
  useEffect(() => {
    if (!isMounted || !isConnected) return;
    let cancelled = false;
    void refetchRef.current().finally(() => {
      if (!cancelled) setMountRefetchDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isMounted, isConnected]);

  const waitingForSeededGame =
    isMounted &&
    !selectedGame &&
    urlGameId != null &&
    !games.some((game) => game.metadata.gameId.toString() === urlGameId);
  const showGamesLoading =
    isLoading ||
    (waitingForSeededGame && (!mountRefetchDone || isFetching));

  // The open match left this player's list (e.g. no longer theirs): close it.
  useEffect(() => {
    if (!address || !selectedGame || games.length === 0) return;
    const stillListed = games.some(
      (g) => g.metadata.gameId.toString() === selectedGame.metadata.gameId.toString(),
    );
    if (!stillListed) setUrlParams({ game: null, replay: null }, { replace: true });
  }, [selectedGame, address, games]);

  // Back on the list: refresh it (it doesn't poll while a match is open).
  const prevSelectedGameRef = useRef<GameDataView | null>(null);
  useEffect(() => {
    if (prevSelectedGameRef.current && !selectedGame) void refetchRef.current();
    prevSelectedGameRef.current = selectedGame;
  }, [selectedGame]);

  // A disconnect closes the match on screen; the URL keeps the id, so a
  // wallet that drops for a moment while reconnecting reopens it.
  const prevAddressRef = useRef<string | undefined>(address);
  useEffect(() => {
    if (prevAddressRef.current && !address) setSelectedGame(null);
    prevAddressRef.current = address;
  }, [address]);

  // Notify Home layout when a game detail is open so global chrome
  // (header/tabs) can be hidden consistently.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("void-tactics-games-detail-active", {
        detail: { active: Boolean(selectedGame) },
      }),
    );
  }, [selectedGame]);

  // Ensure we clear the signal on unmount.
  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(
        new CustomEvent("void-tactics-games-detail-active", {
          detail: { active: false },
        }),
      );
    };
  }, []);

  useEffect(() => {
    const onChainChanged = () => {
      setSelectedGame(null);
      setUrlParams({ game: null, replay: null }, { replace: true });
      void refetchRef.current();
    };
    window.addEventListener(VOID_TACTICS_CHAIN_CHANGED_EVENT, onChainChanged);
    return () => {
      window.removeEventListener(VOID_TACTICS_CHAIN_CHANGED_EVENT, onChainChanged);
    };
  }, []);

  const handleBackToList = useCallback(() => {
    setUrlParams({ game: null, replay: null }, { back: true });
  }, []);

  // The run's live mission shows its title in the inbox; other missions
  // aren't tied to a node after the fact, so they read "Operations".
  const { data: runData } = useGetRoguelikeRun(address);
  const run = runData as RoguelikeRun | undefined;
  const runNodeIds = useMemo(
    () => (run && run.activeGameId !== 0n ? [run.currentNodeId] : []),
    [run],
  );
  const { contentById: runContentById, isLoading: runContentLoading } = useWeb3NodeContent(
    "ROGUELIKE",
    runNodeIds,
  );
  const activeMissionTitle =
    run && run.activeGameId !== 0n
      ? resolveNodeContent(runContentById, run.currentNodeId, runContentLoading).title
      : null;

  const inboxItems: BattleInboxItem[] = visibleGames.map((game) => {
    const isFinished = game.metadata.winner !== ZERO_ADDRESS;
    const isDraw = isFinished && game.metadata.winner === TIE_ADDRESS;
    const isPve = isPveGame(game);
    const isCreator = game.metadata.creator.toLowerCase() === address?.toLowerCase();
    const opponent = isCreator ? game.metadata.joiner : game.metadata.creator;
    const isRoguelike =
      game.metadata.orchestrator?.toLowerCase() === ROGUELIKE_MATCH_ADDRESS.toLowerCase();
    const isRunGame = isRoguelike && run?.activeGameId === game.metadata.gameId;
    const myScore = Number(isCreator ? game.creatorScore : game.joinerScore);
    const theirScore = Number(isCreator ? game.joinerScore : game.creatorScore);
    const turnTime = Number(game.turnState.turnTime || 0n);
    return {
      key: game.metadata.gameId.toString(),
      title: isPve
        ? isRunGame && activeMissionTitle
          ? activeMissionTitle
          : isRoguelike
            ? "Operations mission"
            : "Campaign mission"
        : `vs ${shortAddress(opponent)}`,
      subtitle: `${isPve ? (isRoguelike ? "Operations" : "Campaign") : "Skirmish"} · Game ${game.metadata.gameId.toString()}`,
      status: isFinished ? "finished" : game.turnState.currentTurn === address ? "yourTurn" : "waiting",
      result: isFinished ? (isDraw ? "draw" : game.metadata.winner === address ? "victory" : "defeat") : undefined,
      isPve,
      myScore,
      theirScore,
      maxScore: Number(game.maxScore),
      secondsRemaining: isFinished || !turnTime ? null : calculateTimeRemaining(game),
      startedAtMs: Number(game.metadata.startedAt) * 1000,
      onOpen: () => {
        setUrlParams({ game: game.metadata.gameId.toString(), replay: null });
      },
      onReplay: isFinished
        ? () => {
            setUrlParams({ game: game.metadata.gameId.toString(), replay: "1" });
          }
        : undefined,
    };
  });

  // If a game is selected, show the game display
  if (selectedGame) {
    return (
      <GameDisplay
        game={selectedGame}
        onBack={handleBackToList}
        refetch={stableListRefetch}
        startInReplay={startInReplay}
      />
    );
  }

  return (
    <BattlesInbox
      isAuthenticated={isConnected}
      authRequiredMessage="Connect your wallet to see your battles."
      isLoading={showGamesLoading}
      error={error}
      items={inboxItems}
      showPve={showPve}
      onShowPveChange={setShowPve}
      hiddenPveCount={sortedGames.length - visibleGames.length}
      headerExtra={
        <button
          type="button"
          onClick={() => void handleResetCache()}
          disabled={isResettingCache}
          className="border px-2 py-1 font-mono text-[10px] uppercase tracking-widest disabled:opacity-50"
          style={{
            color: "var(--color-cyan)",
            borderColor: "var(--color-cyan)",
            backgroundColor: "var(--color-near-black)",
          }}
        >
          {isResettingCache ? "[RESETTING CACHE...]" : "[DEBUG: RESET CACHE]"}
        </button>
      }
    />
  );
};

export default Games;
