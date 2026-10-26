"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Whether other UI is drawn over the board (a modal, a sheet, the round
 * report, the map loading overlay...), found by hit-testing points over it:
 * the board is covered when something outside it is the top element at its
 * centre, or at half or more of the points. Decorations that don't take
 * clicks (pointer-events: none, e.g. the tooltips) never count, and neither
 * does a toast or a HUD piece over one corner.
 *
 * Rechecked when the page's DOM changes outside the board, and on resize and
 * scroll, at most once a frame.
 */
export function useBoardCovered(ref: RefObject<HTMLElement | null>): boolean {
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    const board = ref.current;
    if (!board || typeof window === "undefined" || typeof MutationObserver === "undefined") return;
    let frame = 0;
    const check = () => {
      frame = 0;
      setCovered(measureCovered(board));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    // The board's own animations change its DOM every frame; only changes
    // elsewhere can put something over it.
    const observer = new MutationObserver((records) => {
      if (records.some((r) => !board.contains(r.target))) schedule();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "open"],
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    // Overlays that fade in run on CSS transitions, not DOM changes.
    document.addEventListener("transitionend", schedule, true);
    document.addEventListener("animationend", schedule, true);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      document.removeEventListener("transitionend", schedule, true);
      document.removeEventListener("animationend", schedule, true);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);

  useEffect(() => {
    if (!covered) return;
    coveredBoards += 1;
    return () => {
      coveredBoards -= 1;
    };
  }, [covered]);

  return covered;
}

let coveredBoards = 0;

/** True while any board is covered: the battle's keyboard shortcuts (Escape) leave it to the overlay. */
export function isAnyBoardCovered(): boolean {
  return coveredBoards > 0;
}

/** Sample points, as fractions of the board's box; the first is the centre. */
const SAMPLE_POINTS: readonly (readonly [number, number])[] = [
  [0.5, 0.5],
  [0.25, 0.25], [0.5, 0.25], [0.75, 0.25],
  [0.25, 0.5], [0.75, 0.5],
  [0.25, 0.75], [0.5, 0.75], [0.75, 0.75],
];

function measureCovered(board: HTMLElement): boolean {
  const rect = board.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const flags: boolean[] = [];
  for (const [fx, fy] of SAMPLE_POINTS) {
    const x = rect.left + rect.width * fx;
    const y = rect.top + rect.height * fy;
    // Scrolled out of view: nothing to say about this point.
    if (x < 0 || y < 0 || x >= vw || y >= vh) {
      flags.push(false);
      continue;
    }
    const hit = document.elementFromPoint(x, y);
    // The board, something in it, or (where the board takes no clicks) a
    // parent of it.
    flags.push(hit != null && !board.contains(hit) && !hit.contains(board));
  }
  return coverVerdict(flags);
}

/** flags[0] is the centre point. */
export function coverVerdict(flags: readonly boolean[]): boolean {
  if (flags.length === 0) return false;
  if (flags[0]) return true;
  return flags.filter(Boolean).length * 2 >= flags.length;
}
