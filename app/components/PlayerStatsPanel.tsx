"use client";

import React from "react";

// Shared between Profile.tsx (web3) and ProfileWeb2.tsx (web2) — the
// STATISTICS + ACHIEVEMENTS card pair. Statistics split in half: PvP on the
// left, PvE (missions, runs, the tutorial) on the right (playerRecord.ts).
// `draws` is web2 PvP only (on-chain games have no tie concept yet);
// `signInPrompt` differs (wallet vs session) so it's caller-supplied.
export interface PlayerRecordColumn {
  wins: number;
  losses: number;
  draws?: number;
}

export interface PlayerStatsPanelData {
  pvp: PlayerRecordColumn;
  pve: PlayerRecordColumn;
  inProgress: number;
}

interface PlayerStatsPanelProps {
  isSignedIn: boolean;
  signInPrompt: string;
  stats: PlayerStatsPanelData;
}

function RecordColumn({ title, record }: { title: string; record: PlayerRecordColumn }) {
  const draws = record.draws ?? 0;
  const total = record.wins + record.losses + draws;
  const winRate = total > 0 ? Math.round((record.wins / total) * 100) : 0;
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-cyan/80">{title}</div>
      <div className="data-readout">
        <span className="data-readout-label">Wins</span>
        <span className="font-bold text-phosphor-green font-mono text-xs">{record.wins}</span>
      </div>
      <div className="data-readout">
        <span className="data-readout-label">Losses</span>
        <span className="font-bold text-warning-red font-mono text-xs">{record.losses}</span>
      </div>
      {draws > 0 && (
        <div className="data-readout">
          <span className="data-readout-label">Draws</span>
          <span className="font-bold text-purple font-mono text-xs">{draws}</span>
        </div>
      )}
      <div className="data-readout">
        <span className="data-readout-label">Win Rate</span>
        <span className="font-bold font-mono text-xs">{winRate}%</span>
      </div>
      <div className="data-readout">
        <span className="data-readout-label">Total</span>
        <span className="font-mono text-xs opacity-60">{total}</span>
      </div>
    </div>
  );
}

export function PlayerStatsPanel({ isSignedIn, signInPrompt, stats }: PlayerStatsPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div
        className="corner-bracket border bg-black/40 p-4"
        style={{ borderColor: "var(--color-cyan)", borderRadius: 0 }}
      >
        <h4 className="text-lg font-bold text-cyan mb-2 tracking-widest">
          [STATISTICS]
        </h4>
        {isSignedIn ? (
          <>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <RecordColumn title="PvP" record={stats.pvp} />
              <RecordColumn title="PvE" record={stats.pve} />
            </div>
            {stats.inProgress > 0 && (
              <div className="data-readout mt-2">
                <span className="data-readout-label">In Progress</span>
                <span className="font-bold text-amber font-mono text-xs">{stats.inProgress}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm font-mono opacity-80 tracking-wider">
            {signInPrompt}
          </p>
        )}
      </div>
      <div
        className="corner-bracket corner-bracket-purple border border-purple bg-black/40 p-4"
        style={{ borderRadius: 0 }}
      >
        <h4 className="text-lg font-bold text-purple mb-2 tracking-widest">
          [ACHIEVEMENTS]
        </h4>
        <p className="text-sm font-mono opacity-50 tracking-wider">Operational tracking coming in a future update.</p>
      </div>
    </div>
  );
}
