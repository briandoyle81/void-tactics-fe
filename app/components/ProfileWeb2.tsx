"use client";

import React, { useMemo } from "react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { usePlayerGamesWeb2 } from "../hooks/usePlayerGamesWeb2";
import { usePlayerStatsWeb2 } from "../hooks/usePlayerStatsWeb2";
import { WEB2_TIE_SENTINEL } from "../types/web2Game";
import { PlayerStatsPanel } from "./PlayerStatsPanel";
import { GameHistoryList, type GameHistoryRowData } from "./GameHistoryList";
import { navigateToGameWeb2 } from "../utils/navigateToGame";
import { splitPlayerRecord } from "../utils/playerRecord";

// Web2-mode counterpart to `Profile.tsx` — same layout/copy, backed by
// `usePlayerGamesWeb2`/session user id instead of `usePlayerGames`/wallet
// address. Opponent identity uses `creatorLabel`/`joinerLabel` (attached
// server-side by GET /api/games — see Web2GameMetadata's doc comment)
// instead of web3 Profile's truncated-address display.
const ProfileWeb2: React.FC = () => {
  const { userId, isLoggedIn } = useCurrentUser();
  const { games, isLoading } = usePlayerGamesWeb2();

  // PlayerStats holds PvP games plus the tutorial's win or loss, like web3's
  // GameResults; the stats route also counts finished PvP and PvE games, and
  // the tutorial goes under PvE (playerRecord.ts).
  const record = usePlayerStatsWeb2(userId);
  const stats = useMemo(() => {
    const inProgress = games.filter((game) => game.metadata.winner === "").length;
    const split = splitPlayerRecord({
      stored: { wins: record?.wins ?? 0, losses: record?.losses ?? 0 },
      pvpGames: record?.pvpGames ?? { wins: record?.wins ?? 0, losses: record?.losses ?? 0 },
      pveGames: record?.pveGames ?? { wins: 0, losses: 0 },
    });
    // PlayerStats only records PvP draws (playerStatsWeb2.ts).
    return { pvp: { ...split.pvp, draws: record?.draws ?? 0 }, pve: split.pve, inProgress };
  }, [games, record]);

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      const aFinished = a.metadata.winner !== "";
      const bFinished = b.metadata.winner !== "";

      if (aFinished && !bFinished) return -1;
      if (!aFinished && bFinished) return 1;

      return b.metadata.startedAt - a.metadata.startedAt;
    });
  }, [games]);

  const formatDate = (timestampMs: number) => {
    const date = new Date(timestampMs);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const historyRows: GameHistoryRowData[] = useMemo(() => {
    if (!userId) return [];
    return sortedGames.map((game) => {
      const isCreator = game.metadata.creator === userId;
      const inProgress = game.metadata.winner === "";
      const outcome =
        game.metadata.winner === ""
          ? { text: "IN PROGRESS", color: "text-amber" }
          : game.metadata.winner === WEB2_TIE_SENTINEL
          ? { text: "DRAW", color: "text-purple" }
          : game.metadata.winner === userId
          ? { text: "VICTORY", color: "text-phosphor-green" }
          : { text: "DEFEAT", color: "text-warning-red" };

      return {
        id: game.metadata.gameId.toString(),
        outcomeText: outcome.text,
        outcomeColor: outcome.color,
        opponentLabel: isCreator ? game.metadata.joinerLabel : game.metadata.creatorLabel,
        dateLabel: formatDate(game.metadata.startedAt),
        playerScore: isCreator ? game.creatorScore : game.joinerScore,
        maxScore: game.maxScore,
        round: game.turnState.currentRound,
        activeShips: isCreator
          ? game.creatorActiveShipIds.length
          : game.joinerActiveShipIds.length,
        inProgress,
      };
    });
  }, [sortedGames, userId]);

  const navigateToGame = (gameId: string) => {
    if (!userId) return;
    navigateToGameWeb2(userId, gameId);
  };

  return (
    <div className="text-cyan font-mono">
      <h3 className="text-2xl font-bold mb-6 tracking-wider text-center">
        [PROFILE]
      </h3>
      <PlayerStatsPanel
        isSignedIn={isLoggedIn}
        signInPrompt="// Sign in to view statistics"
        stats={stats}
      />
      <GameHistoryList
        isSignedIn={isLoggedIn}
        isLoading={isLoading}
        rows={historyRows}
        onRowClick={navigateToGame}
      />
    </div>
  );
};

export default ProfileWeb2;
