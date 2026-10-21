"use client";

import { navigateToGame as openGame } from "../utils/navigateToGame";
import React, { useMemo } from "react";
import { useAccount } from "wagmi";
import { baseSepolia } from "viem/chains";
import { usePlayerGames } from "../hooks/usePlayerGames";
import { usePlayerStats } from "../hooks/usePlayerStats";
import { PlayerStatsPanel } from "./PlayerStatsPanel";
import { GameHistoryList, type GameHistoryRowData } from "./GameHistoryList";
import { CopyAddressButton } from "./CopyAddressButton";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const Profile: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { games, isLoading } = usePlayerGames();

  // The record is GameResults' (PvP games plus the tutorial's win or loss,
  // TutorialClaim.completeTutorialWinPath/LossPath), not a count of the
  // games list: the tutorial has no game, and PvE games don't count.
  const record = usePlayerStats(address, baseSepolia.id);
  const stats = useMemo(() => {
    const inProgress = games.filter((game) => game.metadata.winner === ZERO_ADDRESS).length;
    const wins = Number(record?.wins ?? 0n);
    const losses = Number(record?.losses ?? 0n);
    const decided = wins + losses;
    return {
      wins,
      losses,
      inProgress,
      winRate: decided > 0 ? Math.round((wins / decided) * 100) : 0,
      total: Number(record?.totalGames ?? 0n),
    };
  }, [games, record]);

  // Sort games: finished first (by startedAt desc), then in progress
  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      const aFinished = a.metadata.winner !== ZERO_ADDRESS;
      const bFinished = b.metadata.winner !== ZERO_ADDRESS;

      if (aFinished && !bFinished) return -1;
      if (!aFinished && bFinished) return 1;

      // Both same status, sort by startedAt descending
      return Number(b.metadata.startedAt) - Number(a.metadata.startedAt);
    });
  }, [games]);

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const historyRows: GameHistoryRowData[] = useMemo(() => {
    if (!address) return [];
    return sortedGames.map((game) => {
      const isCreator = game.metadata.creator.toLowerCase() === address.toLowerCase();
      const inProgress = game.metadata.winner === ZERO_ADDRESS;
      const outcome = inProgress
        ? { text: "IN PROGRESS", color: "text-amber" }
        : game.metadata.winner.toLowerCase() === address.toLowerCase()
        ? { text: "VICTORY", color: "text-phosphor-green" }
        : { text: "DEFEAT", color: "text-warning-red" };
      const opponent = isCreator ? game.metadata.joiner : game.metadata.creator;

      return {
        id: game.metadata.gameId.toString(),
        outcomeText: outcome.text,
        outcomeColor: outcome.color,
        dateLabel: formatDate(game.metadata.startedAt),
        opponentLabel: `${opponent.slice(0, 6)}…${opponent.slice(-4)}`,
        playerScore: Number(isCreator ? game.creatorScore : game.joinerScore),
        maxScore: Number(game.maxScore),
        round: Number(game.turnState.currentRound),
        activeShips: isCreator
          ? game.creatorActiveShipIds.length
          : game.joinerActiveShipIds.length,
        inProgress,
      };
    });
  }, [sortedGames, address]);

  const navigateToGame = (gameId: string) => {
    openGame(address, BigInt(gameId));
  };

  return (
    <div className="text-cyan font-mono">
      <h3 className="text-2xl font-bold mb-6 tracking-wider text-center">
        [PROFILE]
      </h3>
      {address && (
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="text-xs uppercase tracking-wider text-text-muted">Address</span>
          {/* Phones show it shortened; the copy button copies all of it. */}
          <span className="text-sm text-text-primary sm:hidden" title={address}>
            {`${address.slice(0, 6)}…${address.slice(-4)}`}
          </span>
          <span className="hidden min-w-0 break-all text-sm text-text-primary select-all sm:inline">{address}</span>
          <CopyAddressButton address={address} />
        </div>
      )}
      <PlayerStatsPanel
        isSignedIn={isConnected}
        signInPrompt="// Connect wallet to view statistics"
        stats={stats}
      />
      <GameHistoryList
        isSignedIn={isConnected}
        isLoading={isLoading}
        rows={historyRows}
        onRowClick={navigateToGame}
      />
    </div>
  );
};

export default Profile;
