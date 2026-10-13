import React from "react";
import {
  TUTORIAL_COMPLETION_CARD,
  TUTORIAL_DECISION_LABEL,
  TUTORIAL_PANELS,
} from "../data/dialog/tutorial";
import { parseTutorialMarkup } from "../utils/tutorialMarkup";

// Builds each tutorial step's panel from its text in
// app/data/dialog/tutorial.ts (edit the words there). This file only holds
// layout: panel sizes, the decision label's styling, and the markup render.

const TUTORIAL_RESCUE_PANEL_MAX_ROWS = 6;

/**
 * Branch final steps: max panel height as a fraction of the grid when the panel
 * is content-sized (`panelFitToContent`). Must be ≤ grid row count (11).
 */
const TUTORIAL_COMPLETION_ENDPOINT_PANEL_MAX_ROWS = 10;

/** The board's reactor-damage marker (GameGridCell), sized to the text. */
function ReactorDamageIcon() {
  return (
    <span
      role="img"
      aria-label="reactor damage"
      className="inline-flex h-[1.1em] w-[1.1em] items-center justify-center rounded-full bg-warning-red/90 align-[-0.15em] font-mono text-[0.7em] leading-none text-white"
    >
      ✕
    </span>
  );
}

/**
 * Tutorial text with its {tone|...} emphasis as spans. Returns plain nodes
 * (not a component) so SimulatedGameDisplay's touch-copy rewrite ("Hover" →
 * "Tap") can reach the words.
 */
export function renderTutorialText(text: string): React.ReactNode {
  return (
    <>
      {parseTutorialMarkup(text).map((run, i) =>
        run.icon === "reactor" ? (
          <ReactorDamageIcon key={i} />
        ) : run.className ? (
          <span key={i} className={run.className}>
            {run.text}
          </span>
        ) : (
          <React.Fragment key={i}>{run.text}</React.Fragment>
        ),
      )}
    </>
  );
}

export function renderTutorialParagraphs(paragraphs: readonly string[]): React.ReactNode {
  return (
    <>
      {paragraphs.map((paragraph, i) => (
        <p key={i}>{renderTutorialText(paragraph)}</p>
      ))}
    </>
  );
}

export const TUTORIAL_COMPLETION_SNIPER_PRIMARY_CTA_SUPPORTING = renderTutorialText(
  TUTORIAL_COMPLETION_CARD.winSupporting,
);
export const TUTORIAL_COMPLETION_RETREAT_PRIMARY_CTA_SUPPORTING = renderTutorialText(
  TUTORIAL_COMPLETION_CARD.lossSupporting,
);
/** Either final, opened from the Operations map in web2 (no reward claim): on to fleet selection. */
export const TUTORIAL_COMPLETION_CONTINUE_PRIMARY_CTA_SUPPORTING = renderTutorialText(
  TUTORIAL_COMPLETION_CARD.continueSupporting,
);

export type TutorialGridPanelConfig = {
  title: string;
  brief: React.ReactNode;
  tasks?: React.ReactNode[];
  tasksSectionLabel?: React.ReactNode;
  primaryCta?: {
    eyebrow: string;
    headline: string;
    supporting: React.ReactNode;
    buttonLabel: string;
    onClick: () => void;
  };
  /**
   * Max panel height as a fraction of the grid (11 rows). Branch finals use
   * `TUTORIAL_COMPLETION_ENDPOINT_PANEL_MAX_ROWS` with `panelFitToContent`;
   * rescue (Hard choice) uses `TUTORIAL_RESCUE_PANEL_MAX_ROWS`.
   */
  panelBottomRowExclusive?: number;
  /** Branch finals: size panel to content, capped by `panelBottomRowExclusive`. */
  panelFitToContent?: boolean;
};

/** Per-step layout beyond the text. */
function panelLayout(stepId: string): Partial<TutorialGridPanelConfig> {
  switch (stepId) {
    case "rescue":
      return {
        tasksSectionLabel: (
          <span
            className="text-warning-red animate-tutorial-decision-label font-black"
            style={{
              fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              filter: "drop-shadow(0 0 14px color-mix(in srgb, var(--color-warning-red) 80%, transparent))",
            }}
          >
            {TUTORIAL_DECISION_LABEL}
          </span>
        ),
        panelBottomRowExclusive: TUTORIAL_RESCUE_PANEL_MAX_ROWS,
      };
    case "completion-retreat":
    case "completion-sniper":
      return {
        panelBottomRowExclusive: TUTORIAL_COMPLETION_ENDPOINT_PANEL_MAX_ROWS,
        panelFitToContent: true,
      };
    default:
      return {};
  }
}

export function getTutorialGridPanelConfig(stepId: string): TutorialGridPanelConfig | null {
  if (!Object.hasOwn(TUTORIAL_PANELS, stepId)) return null;
  const text = TUTORIAL_PANELS[stepId];
  return {
    title: text.title,
    brief: renderTutorialParagraphs(text.brief),
    ...(text.tasks ? { tasks: text.tasks.map(renderTutorialText) } : {}),
    // No words on the panel (e.g. End of round, whose briefing is in the
    // round report): shrink to the header and buttons.
    ...(text.brief.length === 0 && !text.tasks?.length ? { panelFitToContent: true } : {}),
    ...panelLayout(stepId),
  };
}
