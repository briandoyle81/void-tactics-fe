"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { usePlayerGamesWeb2 } from "../hooks/usePlayerGamesWeb2";
import type { Web2GameDataView } from "../types/web2Game";
import { WEB2_TIE_SENTINEL } from "../types/web2Game";
import GameDisplayWeb2 from "./GameDisplayWeb2";
import { BattlesInbox, type BattleInboxItem } from "./BattlesInbox";
import { AI_USER_ID } from "../config/aiUser";
import { useShowPveGames } from "../hooks/useShowPveGames";
import { setUrlParams, useUrlParam } from "../utils/urlState";

// Web2-mode counterpart to `Games.tsx` — same list/detail navigation pattern
// and card layout, backed by `usePlayerGamesWeb2`/session user id instead of
// `usePlayerGames`/wallet address. Genuinely parallel component (not a
// branch inside `Games.tsx`) — same rationale as `ManageNavyWeb2`/
// `LobbiesWeb2`: hooks can't be called conditionally, and mode-specific
// logic belongs in its own file.
const GamesWeb2: React.FC = () => {
  const { userId, isLoggedIn } = useCurrentUser();
  // The open match is in the URL, same as Games.tsx (`?game=<id>`,
  // `&replay=1`; see urlState.ts).
  const urlGameId = useUrlParam("game");
  const startInReplay = useUrlParam("replay") === "1";
  const [selectedGame, setSelectedGame] = useState<Web2GameDataView | null>(null);
  const { games, isLoading, error, refetch } = usePlayerGamesWeb2({
    pausePolling: Boolean(selectedGame),
  });
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const [isMounted, setIsMounted] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (selectedGame) return;
    const interval = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [selectedGame]);

  const calculateTimeRemaining = (game: Web2GameDataView): number => {
    const turnTimeSec = game.turnState.turnTime || 0;
    const turnStartSec = Math.floor((game.turnState.turnStartTime || 0) / 1000);
    if (!turnTimeSec || !turnStartSec) return 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const elapsed = Math.max(0, nowSec - turnStartSec);
    return Math.max(0, turnTimeSec - elapsed);
  };

  const sortedGames = useMemo(() => {
    const copy = [...games];
    copy.sort((a, b) => {
      const aInProgress = a.metadata.winner === "" ? 1 : 0;
      const bInProgress = b.metadata.winner === "" ? 1 : 0;
      if (aInProgress !== bInProgress) return bInProgress - aInProgress;
      return b.metadata.startedAt - a.metadata.startedAt;
    });
    return copy;
  }, [games]);

  // PvE = vs-AI games (campaign and roguelike missions), same test as
  // GameDisplayWeb2.tsx's isVsAIGame. Hidden unless toggled on.
  const [showPve, setShowPve] = useShowPveGames();
  const visibleGames = useMemo(
    () => (showPve ? sortedGames : sortedGames.filter((g) => g.metadata.joiner !== AI_USER_ID)),
    [sortedGames, showPve],
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Follow the URL (same as Games.tsx): open the match once the list has
  // it, close it when the id goes.
  useEffect(() => {
    if (!urlGameId) {
      if (selectedGame) setSelectedGame(null);
      return;
    }
    if (String(selectedGame?.metadata.gameId) === urlGameId) return;
    if (!isLoggedIn || !userId) return;
    const game = games.find((g) => String(g.metadata.gameId) === urlGameId);
    setSelectedGame(game ?? null);
  }, [urlGameId, selectedGame, games, isLoggedIn, userId]);

  // A match in the URL that the list doesn't have yet (just created): show
  // loading until a fresh list is in, rather than the list without it.
  const [mountRefetchDone, setMountRefetchDone] = useState(false);
  useEffect(() => {
    if (!isMounted || !isLoggedIn) return;
    let cancelled = false;
    void Promise.resolve(refetchRef.current()).finally(() => {
      if (!cancelled) setMountRefetchDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isMounted, isLoggedIn]);
  const waitingForUrlGame =
    !selectedGame &&
    urlGameId != null &&
    !games.some((g) => String(g.metadata.gameId) === urlGameId) &&
    !mountRefetchDone;

  // The open match left this player's list: close it.
  useEffect(() => {
    if (!userId || !selectedGame || games.length === 0) return;
    const stillExists = games.some(
      (g) => String(g.metadata.gameId) === String(selectedGame.metadata.gameId),
    );
    if (!stillExists) setUrlParams({ game: null, replay: null }, { replace: true });
  }, [selectedGame, userId, games]);

  // Back on the list: refresh it.
  const prevSelectedGameRef = useRef<Web2GameDataView | null>(null);
  useEffect(() => {
    if (prevSelectedGameRef.current && !selectedGame) void refetchRef.current();
    prevSelectedGameRef.current = selectedGame;
  }, [selectedGame]);

  // Notify Home layout when a game detail is open so global chrome (header/tabs) hides consistently.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("void-tactics-games-detail-active", { detail: { active: Boolean(selectedGame) } }));
  }, [selectedGame]);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(new CustomEvent("void-tactics-games-detail-active", { detail: { active: false } }));
    };
  }, []);

  const handleBackToList = useCallback(() => {
    setUrlParams({ game: null, replay: null }, { back: true });
  }, []);

  const stableListRefetch = useCallback(() => {
    void refetchRef.current();
  }, []);

  if (selectedGame) {
    return (
      <GameDisplayWeb2
        game={selectedGame}
        onBack={handleBackToList}
        refetch={stableListRefetch}
        startInReplay={startInReplay}
      />
    );
  }

  const inboxItems: BattleInboxItem[] = visibleGames.map((game) => {
    const isFinished = game.metadata.winner !== "";
    const isDraw = isFinished && game.metadata.winner === WEB2_TIE_SENTINEL;
    const isPve = game.metadata.joiner === AI_USER_ID;
    const isCreator = game.metadata.creator === userId;
    const turnTime = game.turnState.turnTime || 0;
    return {
      key: String(game.metadata.gameId),
      // Web2 games aren't tied to a mission node, so missions read generically.
      title: isPve
        ? "Mission"
        : `vs ${isCreator ? game.metadata.joinerLabel : game.metadata.creatorLabel}`,
      subtitle: `${isPve ? "PvE" : "Skirmish"} · Game ${game.metadata.gameId}`,
      status: isFinished ? "finished" : game.turnState.currentTurn === userId ? "yourTurn" : "waiting",
      result: isFinished ? (isDraw ? "draw" : game.metadata.winner === userId ? "victory" : "defeat") : undefined,
      isPve,
      myScore: isCreator ? game.creatorScore : game.joinerScore,
      theirScore: isCreator ? game.joinerScore : game.creatorScore,
      maxScore: game.maxScore,
      secondsRemaining: isFinished || !turnTime ? null : calculateTimeRemaining(game),
      startedAtMs: game.metadata.startedAt,
      onOpen: () => {
        setUrlParams({ game: String(game.metadata.gameId), replay: null });
      },
      onReplay: isFinished
        ? () => {
            setUrlParams({ game: String(game.metadata.gameId), replay: "1" });
          }
        : undefined,
    };
  });

  return (
    <BattlesInbox
      isAuthenticated={isLoggedIn}
      authRequiredMessage="Sign in to see your battles."
      isLoading={isLoading || waitingForUrlGame}
      error={error}
      items={inboxItems}
      showPve={showPve}
      onShowPveChange={setShowPve}
      hiddenPveCount={sortedGames.length - visibleGames.length}
    />
  );
};

export default GamesWeb2;
