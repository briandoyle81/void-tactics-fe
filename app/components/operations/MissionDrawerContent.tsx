"use client";

import type { ReactNode } from "react";
import { nodeContentTextClass, type NodeContentStatus } from "../../hooks/useNodeContent";
import { getFactionName } from "../../config/factions";
import { calculateShipRank } from "../../utils/shipLevel";
import { shipGrantToVisual, type NodeRewardShip } from "../../utils/shipGrant";

// The run map drawer's mission view: title and kind, the briefing
// transmission, the enemy fleet as named ship chips, the reward ship (if the
// node grants one), then the dossier.

export interface EnemyShipChip {
  key: string;
  name: string;
  image: ReactNode;
}

const DISPLAY_FONT = { fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" } as const;

export function MissionDrawerContent({
  title,
  titleStatus,
  completed = false,
  kindLabel,
  briefing,
  enemyFleet,
  rewardShip,
  dossier,
}: {
  title: string;
  titleStatus: NodeContentStatus | undefined;
  /** Cleared or passed (the star chart's green node): green, "- Completed". */
  completed?: boolean;
  kindLabel: string;
  briefing: ReactNode;
  /** Combat nodes only; null while loading. */
  enemyFleet?: EnemyShipChip[] | null;
  /** The ship a win here mints; `image` is the mode's ShipImage of it. */
  rewardShip?: { reward: NodeRewardShip; image: ReactNode } | null;
  dossier: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 p-4 pr-10 font-mono md:pr-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3
          className={`text-2xl font-bold uppercase leading-tight tracking-wider ${nodeContentTextClass(titleStatus, completed ? "text-phosphor-green" : "text-cyan")}`}
          style={DISPLAY_FONT}
        >
          {title}
          {completed && " - Completed"}
        </h3>
        <span className="shrink-0 border border-steel px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-secondary">
          {kindLabel}
        </span>
      </div>

      {briefing}

      {enemyFleet !== undefined && (
        <section aria-label="Enemy fleet">
          <div className="mb-2 text-sm font-bold uppercase tracking-wider text-warning-red" style={DISPLAY_FONT}>
            Enemy fleet
          </div>
          {enemyFleet === null ? (
            <p className="text-xs text-text-muted">Scanning…</p>
          ) : enemyFleet.length === 0 ? (
            <p className="text-xs text-text-muted">No contacts.</p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {enemyFleet.map((ship) => (
                <div key={ship.key} className="grid w-[4.4rem] content-start gap-1">
                  <div className="aspect-square overflow-hidden border border-warning-red/50 bg-black/40">{ship.image}</div>
                  <span className="line-clamp-2 break-words text-[10px] leading-tight text-text-secondary">{ship.name}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {rewardShip && <RewardShipSection {...rewardShip} />}

      {dossier}
    </div>
  );
}

function RewardShipSection({ reward, image }: { reward: NodeRewardShip; image: ReactNode }) {
  const { grant, claimed } = reward;
  const { rank } = calculateShipRank(shipGrantToVisual(grant));
  const alreadyReceived = grant.oncePerAddress && claimed;
  return (
    <section aria-label="Reward ship">
      <div className="mb-2 text-sm font-bold uppercase tracking-wider text-phosphor-green" style={DISPLAY_FONT}>
        Reward ship
      </div>
      <div className={`flex items-center gap-3 border p-2 ${alreadyReceived ? "border-gunmetal" : "border-phosphor-green/50"}`}>
        <div className={`h-16 w-16 shrink-0 overflow-hidden bg-black/40 ${alreadyReceived ? "opacity-50" : ""}`}>{image}</div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-text-primary">{grant.name}</div>
          <div className="text-[11px] text-text-secondary">
            {getFactionName(grant.variant)} · Rank {rank}
            {grant.shiny ? " · Shiny" : ""}
          </div>
          <div className={`text-[11px] ${alreadyReceived ? "text-text-muted" : "text-phosphor-green"}`}>
            {alreadyReceived
              ? "Already received"
              : grant.oncePerAddress
                ? "Win to add it to your fleet (once)"
                : "Every win adds one to your fleet"}
          </div>
        </div>
      </div>
    </section>
  );
}
