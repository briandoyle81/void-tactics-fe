"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DialogPortrait } from "./DialogPortrait";
import { useCrewReporter } from "./CrewReport";
import { TutorialTarget } from "./TutorialTarget";
import { useDebugMode } from "../hooks/useDebugMode";

export interface TutorialGridTaskPanelProps {
  /** Step title shown in the panel header */
  title: string;
  /** Narrative or tactical context (string with \\n paragraphs, or rich JSX) */
  brief: string | ReactNode;
  /** Numbered tasks (omit or pass [] to hide the section); strings or rich JSX per item */
  tasks?: ReactNode[];
  /** Label above the numbered list (default "Orders") */
  tasksSectionLabel?: ReactNode;
  displayStepNumber: number;
  displayTotalSteps: number;
  currentStepIndex: number;
  isVisibleLastStep: boolean;
  isStepComplete: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onReset: () => void;
  onQuit?: () => void;
  /** The quit button's label (default "Quit"; "Sign in" when signed out). */
  quitLabel?: string;
  /** Optional conversion-style CTA (full-width button below supporting copy). */
  primaryCta?: {
    headline: string;
    supporting: ReactNode;
    buttonLabel: string;
    onClick: () => void;
  };
  /**
   * Panel height as a fraction of the grid (default 4 → ~4/11 of board height).
   * When `panelFitToContent` is false, this sets a fixed panel height.
   * When true, this is only a max-height cap; the panel grows with content.
   */
  panelBottomRowExclusive?: number;
  /** If true, height follows content up to the max implied by `panelBottomRowExclusive`. */
  panelFitToContent?: boolean;
  /** Horizontal anchor for in-grid panel placement. Defaults to top-right. */
  panelAnchor?: "left" | "right";
  /** Vertical anchor: top (default) or bottom of the grid overlay area. */
  panelVerticalAnchor?: "top" | "bottom";
  /**
   * Completion steps only: small debug control next to the Debug checkbox to clear
   * localStorage for tutorial claim / reward state (e.g. after changing rewards onchain).
   */
  tutorialRewardCacheDebug?: {
    onClear: () => void;
    disabled?: boolean;
  };
  /** Optional compact layout preset for specific steps (keeps text readable). */
  compactPreset?: "welcome";
  /**
   * Render in the page flow (full width, sized to its content) instead of
   * over the board. Tablets held upright dock it in the rail under the
   * score, where it doesn't cover the map.
   */
  docked?: boolean;
}

const mono = {
  fontFamily: "var(--font-jetbrains-mono), 'Courier New', monospace",
} as const;

/** Grid row count (must match SimulatedGameDisplay / GameGrid board rows). */
const GRID_ROW_COUNT = 11;
/** Default: panel bottom aligns with the bottom of row index 3 (fourth row). */
const DEFAULT_PANEL_BOTTOM_ROW_EXCLUSIVE = 4;

const SCROLL_EPS_PX = 4;

function ScrollMoreCue({ variant }: { variant: "overlay" | "sticky" }) {
  const inner = (
    <span
      className="border border-cyan/40 bg-near-black/95 px-2 py-0.5 text-xs font-mono uppercase tracking-wider text-cyan"
      id="tutorial-panel-scroll-hint"
    >
      Scroll for more
    </span>
  );

  if (variant === "sticky") {
    return (
      <div className="pointer-events-none sticky bottom-0 z-[5] -mt-10 flex h-10 shrink-0 items-end justify-center bg-gradient-to-t from-near-black from-30% via-near-black/75 to-transparent pb-1">
        {inner}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex h-12 items-end justify-center bg-gradient-to-t from-near-black from-25% via-near-black/70 to-transparent pb-1">
      {inner}
    </div>
  );
}

/**
 * In-grid tutorial panel (top-right over the map): narrative plus optional numbered
 * orders, same chrome (progress, nav; reset and quit in header).
 */
export function TutorialGridTaskPanel({
  title,
  brief,
  tasks,
  tasksSectionLabel = "Orders",
  displayStepNumber,
  displayTotalSteps,
  currentStepIndex,
  isVisibleLastStep,
  isStepComplete,
  onNext,
  onPrevious,
  onReset,
  onQuit,
  quitLabel = "Quit",
  primaryCta,
  panelBottomRowExclusive: panelBottomRowExclusiveProp,
  panelFitToContent: panelFitToContentProp = false,
  panelAnchor = "right",
  panelVerticalAnchor = "top",
  tutorialRewardCacheDebug,
  compactPreset,
  docked = false,
}: TutorialGridTaskPanelProps) {
  const isCompactWelcome = compactPreset === "welcome";
  // Docked, the panel has no board to size against, so it follows its content.
  const panelFitToContent = panelFitToContentProp || docked;
  const speaker = useCrewReporter("adjutant");
  // The step-skip checkbox only exists in debug mode (Settings › Developer).
  const debugMode = useDebugMode();
  const [debugChecked, setDebugChecked] = useState(false);
  const debugEnabled = debugMode && debugChecked;
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentMeasureRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  const updateScrollHint = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScrollDown =
      scrollHeight > clientHeight + SCROLL_EPS_PX &&
      scrollTop + clientHeight < scrollHeight - SCROLL_EPS_PX;
    setMoreBelow((prev) => (prev === canScrollDown ? prev : canScrollDown));
  }, []);

  useLayoutEffect(() => {
    updateScrollHint();
    const scrollEl = scrollRef.current;
    const contentEl = contentMeasureRef.current;
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(updateScrollHint);
    });
    if (scrollEl) ro.observe(scrollEl);
    if (contentEl) ro.observe(contentEl);
    window.addEventListener("resize", updateScrollHint);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScrollHint);
    };
  }, [updateScrollHint, panelFitToContent, displayStepNumber]);

  // Always start at top when changing tutorial slides.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setMoreBelow(false);
    requestAnimationFrame(updateScrollHint);
  }, [currentStepIndex, updateScrollHint]);

  const panelBottomRowExclusive = Math.min(
    GRID_ROW_COUNT,
    Math.max(
      1,
      panelBottomRowExclusiveProp ?? DEFAULT_PANEL_BOTTOM_ROW_EXCLUSIVE,
    ),
  );

  const maxHeightFromGrid = `calc(100% * ${panelBottomRowExclusive} / ${GRID_ROW_COUNT} - 0.5rem)`;

  const canAdvance = !isVisibleLastStep && (debugEnabled || isStepComplete);
  const nextDisabled = !isVisibleLastStep ? !canAdvance : false;

  const mainBody = (
    <>
      {typeof brief === "string" ? (
        <p
          className="text-sm leading-relaxed text-text-primary whitespace-pre-line"
          style={mono}
        >
          {brief}
        </p>
      ) : (
        <div
          className="space-y-2 text-sm leading-relaxed text-text-primary"
          style={mono}
        >
          {brief}
        </div>
      )}

      {tasks && tasks.length > 0 ? (
        <div>
          <p
            className="text-sm uppercase tracking-widest text-cyan/90 mb-1"
            style={mono}
          >
            {tasksSectionLabel}
          </p>
          <ol
            className="list-decimal list-outside pl-4 space-y-1 text-sm leading-snug text-text-primary"
            style={mono}
          >
            {tasks.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {primaryCta ? (
        <div
          className="mt-2 overflow-hidden border-2 bg-near-black"
          style={{ borderRadius: 0, borderColor: "var(--color-cyan)" }}
        >
          <div className="space-y-1.5 px-2.5 pb-2 pt-2.5">
            <p
              className="text-base font-bold uppercase tracking-wide leading-tight text-cyan"
              style={{
                fontFamily:
                  "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              {primaryCta.headline}
            </p>
            <div
              className="text-sm leading-relaxed text-text-primary"
              style={mono}
            >
              {primaryCta.supporting}
            </div>
          </div>
          <button
            type="button"
            onClick={primaryCta.onClick}
            className="w-full border-t-2 bg-steel py-3.5 px-3 text-center text-base font-bold uppercase tracking-wide text-phosphor-green transition-colors hover:bg-gunmetal"
            style={{
              fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              borderRadius: 0,
              borderColor: "var(--color-phosphor-green)",
            }}
          >
            {primaryCta.buttonLabel}
          </button>
        </div>
      ) : null}
    </>
  );

  return (
    <div
      ref={panelFitToContent ? scrollRef : undefined}
      onScroll={panelFitToContent ? updateScrollHint : undefined}
      className={`pointer-events-auto ${
        docked
          ? "relative w-full"
          : `absolute ${panelVerticalAnchor === "bottom" ? "bottom-2" : "top-2"} ${
              panelAnchor === "left" ? "left-2" : "right-2"
            } z-[190] w-[min(117.5%,28.75rem)]`
      } flex min-h-0 flex-col border-2 ${
        isCompactWelcome ? "p-2.5" : "p-3"
      } ${
        panelFitToContent
          ? "overflow-y-auto overflow-x-hidden"
          : "overflow-hidden"
      }`}
      style={{
        backgroundColor: "rgba(12, 17, 23, 0.94)",
        borderColor: "var(--color-cyan)",
        borderRadius: 0,
        ...(docked
          ? {}
          : panelFitToContent
          ? {
              maxHeight: maxHeightFromGrid,
              height: "auto",
            }
          : {
              height: maxHeightFromGrid,
            }),
      }}
      role="region"
      aria-label={`Tutorial briefing, step ${displayStepNumber} of ${displayTotalSteps}`}
      aria-describedby={moreBelow ? "tutorial-panel-scroll-hint" : undefined}
    >
      <div
        className={`flex shrink-0 items-start justify-between ${
          isCompactWelcome ? "mb-1.5 gap-1.5" : "mb-2 gap-2"
        }`}
      >
        {/* Adjutant Bosch gives the tutorial's instructions. */}
        <DialogPortrait
          character={speaker.character}
          name={speaker.name}
          color={speaker.color}
          sizeClass={isCompactWelcome ? "h-10 w-10" : "h-12 w-12"}
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em] leading-tight"
            style={{ ...mono, color: speaker.color }}
          >
            {speaker.name}
          </p>
          <h3
            className={`font-bold uppercase tracking-wide text-cyan leading-tight ${
              isCompactWelcome ? "text-base" : "text-lg"
            }`}
            style={{
              fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
            }}
          >
            {title}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onReset}
            className={`bg-steel text-amber rounded-none font-mono hover:bg-gunmetal whitespace-nowrap ${
              isCompactWelcome ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-sm"
            }`}
          >
            Reset
          </button>
          {onQuit && (
            <button
              type="button"
              onClick={onQuit}
              className={`bg-steel text-text-secondary rounded-none font-mono hover:bg-gunmetal whitespace-nowrap ${
                isCompactWelcome ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-sm"
              }`}
            >
              {quitLabel}
            </button>
          )}
        </div>
      </div>

      <div className={`${isCompactWelcome ? "mb-1.5" : "mb-2"} h-1 w-full shrink-0 bg-gunmetal`}>
        <div
          className="h-1 bg-cyan transition-all duration-300"
          style={{
            width: `${(displayStepNumber / displayTotalSteps) * 100}%`,
          }}
        />
      </div>

      {panelFitToContent ? (
        <>
          <div
            ref={contentMeasureRef}
            className={`${isCompactWelcome ? "space-y-1.5" : "space-y-2"} overflow-x-hidden pr-0.5`}
          >
            {mainBody}
          </div>
          {moreBelow ? <ScrollMoreCue variant="sticky" /> : null}
        </>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={updateScrollHint}
            className={`min-h-0 flex-1 ${
              isCompactWelcome ? "space-y-1.5" : "space-y-2"
            } overflow-y-auto overflow-x-hidden pr-0.5`}
          >
            <div
              ref={contentMeasureRef}
              className={isCompactWelcome ? "space-y-1.5" : "space-y-2"}
            >
              {mainBody}
            </div>
          </div>
          {moreBelow ? <ScrollMoreCue variant="overlay" /> : null}
        </div>
      )}

      <div
        className={`flex shrink-0 flex-wrap items-center ${
          isCompactWelcome ? "mt-1.5 gap-1.5" : "mt-2 gap-2"
        }`}
      >
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentStepIndex === 0}
          className={`bg-steel text-text-primary rounded-none font-mono hover:bg-gunmetal transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isCompactWelcome ? "px-2 py-1 text-xs" : "px-2.5 py-1 text-sm"
          }`}
        >
          ← Prev
        </button>
        {debugMode && (
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={debugChecked}
            onChange={(e) => setDebugChecked(e.target.checked)}
          />
          <span
            className={`font-mono text-text-secondary ${
              isCompactWelcome ? "text-xs" : "text-sm"
            }`}
          >
            Debug
          </span>
        </label>
        )}
        {debugMode && tutorialRewardCacheDebug ? (
          <button
            type="button"
            disabled={tutorialRewardCacheDebug.disabled}
            onClick={tutorialRewardCacheDebug.onClear}
            className={`bg-steel text-amber rounded-none font-mono border border-amber/60 hover:bg-gunmetal transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              isCompactWelcome ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
            }`}
          >
            Clear reward cache
          </button>
        ) : null}
        {!isVisibleLastStep && (
          // Framed like a tutorial click target (TutorialTarget) once the
          // step is done and Next is the thing to press.
          <TutorialTarget active={!nextDisabled} pointer="none" className="ml-auto">
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className={`bg-steel text-phosphor-green rounded-none font-mono border border-phosphor-green hover:bg-gunmetal transition-colors disabled:text-text-muted disabled:border-gunmetal disabled:hover:bg-steel disabled:cursor-not-allowed ${
                isCompactWelcome ? "px-2 py-1 text-xs" : "px-2.5 py-1 text-sm"
              }`}
            >
              Next →
            </button>
          </TutorialTarget>
        )}
      </div>
    </div>
  );
}
