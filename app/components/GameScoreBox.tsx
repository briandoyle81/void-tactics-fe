"use client";

import { STYLE_LABEL, STYLE_MONO } from "../styles/fontStyles";
import type { GameScoreData } from "../types/gameDisplayData";
import { formatScore } from "../utils/roundScoreProjection";

// Shared between GameDisplay.tsx (web3), GameDisplayWeb2.tsx (web2) and
// SimulatedGameDisplay.tsx (tutorial) — number-native (see
// app/types/gameDisplayData.ts): callers convert bigint game data to a
// GameScoreData via app/utils/toGameDisplayData.ts (web3) or
// gameDisplayDataWeb2.ts (web2) before passing it in. Each score reads
// 32(+10)/80 when that side scores 10 more at the end of this round.

const SCORE_TITLE = "Scores update at end of round. (+N): points at round end if the ships stay where they are.";

interface GameScoreBoxProps {
  score: GameScoreData;
}

/** The desktop score box: [YOU] and [OPP] above each score. */
export function GameScoreBox({
  score: { myScore, opponentScore, maxScore, myRoundPoints, opponentRoundPoints },
}: GameScoreBoxProps) {
  return (
    <div
      className="w-full shrink-0 border border-solid overflow-hidden"
      style={{
        backgroundColor: "var(--color-slate)",
        borderColor: "var(--color-gunmetal)",
        borderTopColor: "var(--color-steel)",
        borderLeftColor: "var(--color-steel)",
        borderRadius: 0,
      }}
    >
      <div className="flex items-stretch" style={{ ...STYLE_MONO, fontSize: "22px" }}>
        <div className="flex flex-1 flex-col items-center justify-center px-3 py-1.5">
          <span style={{ ...STYLE_LABEL, fontSize: 11, color: "var(--color-cyan)" }}>[YOU]</span>
          <span title={SCORE_TITLE} style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
            {formatScore(myScore, myRoundPoints)}/{maxScore}
          </span>
        </div>
        <div style={{ width: 1, backgroundColor: "var(--color-gunmetal)", flexShrink: 0 }} />
        <div className="flex flex-1 flex-col items-center justify-center px-3 py-1.5">
          <span style={{ ...STYLE_LABEL, fontSize: 11, color: "var(--color-warning-red)" }}>[OPP]</span>
          <span title={SCORE_TITLE} style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
            {formatScore(opponentScore, opponentRoundPoints)}/{maxScore}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * The compact Me / Opp score pair (the phone layouts' status panels and
 * header), each label above its score.
 */
export function GameScoreTiles({
  score: { myScore, opponentScore, maxScore, myRoundPoints, opponentRoundPoints },
  compact = false,
}: GameScoreBoxProps & {
  /** The portrait header's smaller tiles on a slate ground. */
  compact?: boolean;
}) {
  const tileClass = `flex flex-col border border-solid ${compact ? "px-1.5 py-0.5 text-[11px]" : "px-1.5 py-1 text-xs"}`;
  const tileStyle = {
    borderColor: "var(--color-gunmetal)",
    backgroundColor: compact ? "var(--color-slate)" : "var(--color-near-black)",
  };
  const tiles = (
    <>
      <div className={tileClass} style={tileStyle}>
        <span className="text-text-muted leading-tight">Me</span>
        <span className="font-mono text-white" title={SCORE_TITLE}>
          {formatScore(myScore, myRoundPoints)}/{maxScore}
        </span>
      </div>
      <div className={tileClass} style={tileStyle}>
        <span className="text-text-muted leading-tight">Opp</span>
        <span className="font-mono text-white" title={SCORE_TITLE}>
          {formatScore(opponentScore, opponentRoundPoints)}/{maxScore}
        </span>
      </div>
    </>
  );
  return compact ? tiles : <div className="grid grid-cols-2 gap-1.5">{tiles}</div>;
}
