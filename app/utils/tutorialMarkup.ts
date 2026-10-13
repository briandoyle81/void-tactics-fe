// Parses the {tone|text} emphasis markup in app/data/dialog/tutorial.ts into
// plain and styled runs. Pure; TutorialGridPanelConfigs.tsx renders the runs
// as spans.

/** Each tone's classes: the tutorial's existing emphasis styles. */
export const TUTORIAL_TONE_CLASSES: Record<string, string> = {
  cyan: "font-semibold text-cyan",
  "cyan!": "font-bold text-cyan",
  amber: "font-semibold text-amber",
  "amber!": "font-bold text-amber",
  red: "font-semibold text-warning-red",
  green: "font-semibold text-phosphor-green",
  purple: "font-semibold text-purple",
  dust: "font-semibold text-amber/70",
  plasma: "font-semibold text-cyan/80",
};

/** Inline icons: {icon|name}. */
export const TUTORIAL_ICONS = ["reactor"] as const;
export type TutorialIcon = (typeof TUTORIAL_ICONS)[number];

export interface TutorialTextRun {
  text: string;
  className?: string;
  /** Draw this icon instead of text (TutorialGridPanelConfigs.tsx). */
  icon?: TutorialIcon;
}

const MARKUP = /\{([a-z]+!?)\|([^{}]*)\}/g;

export function parseTutorialMarkup(text: string): TutorialTextRun[] {
  const runs: TutorialTextRun[] = [];
  let last = 0;
  for (const m of text.matchAll(MARKUP)) {
    const start = m.index ?? 0;
    if (start > last) runs.push({ text: text.slice(last, start) });
    if (m[1] === "icon" && (TUTORIAL_ICONS as readonly string[]).includes(m[2])) {
      runs.push({ text: "", icon: m[2] as TutorialIcon });
    } else {
      // An unknown tone shows its words unstyled rather than the raw markup.
      runs.push({ text: m[2], className: TUTORIAL_TONE_CLASSES[m[1]] });
    }
    last = start + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}
