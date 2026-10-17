"use client";

import React from "react";
import { nodeContentTextClass, type ResolvedNodeContent } from "../hooks/useNodeContent";
import { usePressStartedHere } from "../hooks/usePressStartedHere";
import { STYLE_LABEL, STYLE_MONO } from "../styles/fontStyles";
import type { DialogCharacterId } from "../data/dialog/characters";
import {
  CrewReportLetterhead,
  CrewReportSignature,
  DEFAULT_REPORTER,
  useCrewReporter,
  useReportArrivalSound,
} from "./CrewReport";

/** Why a mission was lost — only rendered when !isVictory and nodeId is set
 * (a PvP defeat just shows the score, no lore-flavored explanation). Only
 * "enemyScore" is fully reliable (opponentScore >= maxScore at loss time);
 * the caller falls back to "fleetDestroyed" when neither it nor a local
 * flee-intent flag applies — see GameDisplay.tsx's missionLossReason
 * computation for why (no on-chain field distinguishes "every ship
 * retreated one-by-one" from "fleet destroyed in combat"). */
export type MissionLossReason = "fled" | "fleetDestroyed" | "enemyScore";

const LOSS_REASON_COPY: Record<MissionLossReason, string> = {
  fled: "You disengaged and retreated from the battle.",
  fleetDestroyed: "Your fleet was destroyed in combat.",
  enemyScore: "The enemy secured enough resources to claim the site under space law.",
};

/** Why the player won — see app/utils/victoryReason.ts for how it's inferred. */
export type VictoryReason = "fleetDestroyed" | "enemyFled" | "siteControl";

const VICTORY_REASON_COPY: Record<VictoryReason, string> = {
  fleetDestroyed: "You destroyed the enemy fleet.",
  enemyFled: "The enemy fleet fled.",
  siteControl: "Central has declared we control the site.",
};

interface GameResultModalProps {
  isVictory: boolean;
  myScore: number;
  opponentScore: number;
  maxScore: number;
  onClose: () => void;
  /** Primary CTA label + handler — "Back to Games" for PvP, "Return to Campaign" for a mission. */
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  /** Single-player only — swaps VICTORY/DEFEAT for mission-appropriate copy and shows the node title. */
  nodeId?: bigint;
  /** The mission node's resolved title (on-chain / web2 content, no fallback text). */
  nodeContent?: Pick<ResolvedNodeContent, "title" | "titleStatus">;
  missionLossReason?: MissionLossReason;
  /** Shown on any win (PvP or mission). */
  victoryReason?: VictoryReason;
  /** Web2-only: web3's Game.sol has no draw outcome (there's always a
   * single winner address), but web2's server-authoritative engine can end
   * a match tied — see WEB2_TIE_SENTINEL. When true, overrides `isVictory`'s
   * copy/color with neutral "Draw" framing; never set for a mission
   * (single-player has no web2 equivalent). */
  isTie?: boolean;
  /**
   * Mission comms debrief (victory/defeat dialog from useMissionDialog),
   * shown above the actions while lines are queued. Usually a
   * DialogLineCard.
   */
  comms?: React.ReactNode;
  /** Who files the report (a dialog character). Defaults to the adjutant. */
  reporterId?: DialogCharacterId;
  /** Shown above the actions, e.g. constructing a ship the win granted. */
  rewardAction?: React.ReactNode;
}

// End-of-game overlay for both PvP and single-player — one shared screen,
// not a separate campaign-only component (see feedback_no_parallel_
// components memory). PvP keeps the existing VICTORY/DEFEAT wording;
// passing `nodeId` switches to mission-appropriate copy and title. Display
// only — result/completion are already recorded on-chain by the time this
// renders (Game.sol for the winner, SinglePlayerMatch.onGameEnded ->
// NodeMap.recordCompletion for node unlocks), this never writes anything.
export function GameResultModal({
  isVictory,
  myScore,
  opponentScore,
  maxScore,
  onClose,
  primaryActionLabel,
  onPrimaryAction,
  nodeId,
  nodeContent,
  missionLossReason,
  victoryReason,
  isTie = false,
  comms,
  reporterId = DEFAULT_REPORTER,
  rewardAction,
}: GameResultModalProps) {
  const accentColor = isTie
    ? "var(--color-amber)"
    : isVictory
      ? "var(--color-phosphor-green)"
      : "var(--color-warning-red)";
  const isMission = nodeId != null;
  const nodeTitle = isMission ? nodeContent : undefined;
  // Stays up until the player picks an option; only a press that starts on
  // a button counts, since this opens right as the last move resolves (see
  // usePressStartedHere).
  const pressProps = usePressStartedHere();

  const reporter = useCrewReporter(reporterId);
  useReportArrivalSound();
  const headline = isTie
    ? "Draw"
    : isMission
      ? isVictory
        ? "Mission Complete"
        : "Mission Failed"
      : isVictory
        ? "Victory"
        : "Defeat";

  // Filed as a crew report (see CrewReport.tsx), centered over the board.
  // The outcome and score stay the headline.
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 p-4">
      <div
        className="relative max-h-full w-full max-w-md overflow-y-auto border-2 bg-near-black font-mono"
        style={{ borderColor: accentColor, borderRadius: 0 }}
        role="dialog"
        aria-label={`${headline} report`}
      >
        <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accentColor }} aria-hidden />
        <CrewReportLetterhead
          title={isMission ? "Mission report" : "Battle report"}
          subtitle="After action"
          reporter={reporter}
        />

        <div className="px-6 pb-6 pt-5">
          <div className="text-center">
            <div
              className="text-3xl font-bold uppercase tracking-widest"
              style={{ ...STYLE_LABEL, color: accentColor }}
            >
              {headline}
            </div>
            {nodeTitle && (
              <div
                className={`mt-2 text-sm uppercase tracking-wider ${nodeContentTextClass(nodeTitle.titleStatus, "text-text-muted")}`}
              >
                {nodeTitle.title}
              </div>
            )}
          </div>

          <table className="mt-5 w-full border-collapse text-left text-xs" style={STYLE_MONO}>
            <thead>
              <tr
                className="border-b border-solid text-[10px] uppercase tracking-widest text-text-muted"
                style={{ borderColor: "var(--color-gunmetal)" }}
              >
                <th className="py-1 font-normal" />
                <th className="py-1 text-right font-normal">You</th>
                <th className="py-1 text-right font-normal">Enemy</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 uppercase tracking-wider text-text-muted">
                  Final score
                  <span className="block text-[10px] normal-case tracking-normal">{maxScore} to win</span>
                </td>
                <td className="py-2 text-right text-3xl font-bold tabular-nums" style={{ color: "var(--color-cyan)" }}>
                  {myScore}
                </td>
                <td className="py-2 text-right text-3xl font-bold tabular-nums" style={{ color: "var(--color-warning-red)" }}>
                  {opponentScore}
                </td>
              </tr>
            </tbody>
          </table>

          {isVictory && !isTie && victoryReason && (
            <p className="mt-4 text-center text-xs text-text-secondary">
              {VICTORY_REASON_COPY[victoryReason]}
            </p>
          )}

          {isMission && !isVictory && missionLossReason && (
            <p className="mt-4 text-center text-xs text-text-secondary">
              {LOSS_REASON_COPY[missionLossReason]}
            </p>
          )}

          {isMission && (
            <p className="mt-4 text-center text-xs text-text-secondary">
              {isVictory
                ? "The node's completion is recorded — any nodes it unlocks are now available."
                : "This mission is not marked complete. You can try again any time."}
            </p>
          )}

          {comms && <div className="mt-5">{comms}</div>}

          <div className="mt-4">
            <CrewReportSignature reporter={reporter} />
          </div>

          {rewardAction && <div className="mt-4">{rewardAction}</div>}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              {...pressProps(onPrimaryAction)}
              className="flex-1 border-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors hover:bg-white/5"
              style={{ ...STYLE_LABEL, borderColor: accentColor, color: accentColor, borderRadius: 0 }}
            >
              {primaryActionLabel}
            </button>
            <button
              type="button"
              {...pressProps(onClose)}
              className="flex-1 border px-4 py-2 text-sm uppercase tracking-wider text-text-secondary transition-colors hover:bg-white/5"
              style={{ ...STYLE_LABEL, borderColor: "var(--color-gunmetal)", borderRadius: 0 }}
            >
              Review Board
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
