"use client";

import { navigateToGame as openGame } from "../utils/navigateToGame";
import React, { useMemo } from "react";
import { useChainAccount } from "@/app/near/useChainAccount";
import { usePlayerGames } from "../hooks/usePlayerGames";
import { usePlayerStats } from "../hooks/usePlayerStats";
import { PlayerStatsPanel } from "./PlayerStatsPanel";
import { GameHistoryList, type GameHistoryRowData } from "./GameHistoryList";
import { CopyAddressButton } from "./CopyAddressButton";
import { GAME_MODE } from "../near/adapters/game";
import { isNoAccount } from "../types/chain";
import { countWinLoss, splitPlayerRecord } from "../utils/playerRecord";
import type { GameDataView } from "../types/types";

const Profile: React.FC = () => {
  const { address, isConnected } = useChainAccount();
  const { games, isLoading } = usePlayerGames();

  // GameResults' record holds PvP games plus the tutorial's win or loss
  // (TutorialClaim.completeTutorialWinPath/LossPath); PvE games aren't in it.
  // So PvP and PvE are counted from the games list (by the contract that
  // started each one), with the tutorial under PvE (playerRecord.ts).
  const record = usePlayerStats(address);
  const stats = useMemo(() => {
    const inProgress = games.filter((game) => !game.metadata.ended).length;
    const me = address?.toLowerCase();
    const outcome = (game: GameDataView) =>
      !game.metadata.ended ? null : isNoAccount(game.metadata.winner) || game.metadata.winner.toLowerCase() !== me ? "loss" : "win";
    const isPvp = (game: GameDataView) => game.metadata.orchestrator === GAME_MODE.PVP;
    const split = splitPlayerRecord({
      stored: { wins: Number(record?.wins ?? 0n), losses: Number(record?.losses ?? 0n) },
      pvpGames: countWinLoss(games.filter(isPvp), outcome),
      pveGames: countWinLoss(games.filter((game) => !isPvp(game)), outcome),
    });
    return { pvp: split.pvp, pve: split.pve, inProgress };
  }, [games, record, address]);

  // Sort games: finished first (by startedAt desc), then in progress
  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      const aFinished = a.metadata.ended;
      const bFinished = b.metadata.ended;

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
      const inProgress = !game.metadata.ended;
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
