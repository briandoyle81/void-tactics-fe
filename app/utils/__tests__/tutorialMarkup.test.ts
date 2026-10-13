import { describe, expect, it } from "vitest";
import { parseTutorialMarkup, TUTORIAL_ICONS, TUTORIAL_TONE_CLASSES } from "../tutorialMarkup";
import { TUTORIAL_COMPLETION_CARD, TUTORIAL_PANELS } from "../../data/dialog/tutorial";

describe("parseTutorialMarkup", () => {
  it("splits plain text and toned words", () => {
    expect(parseTutorialMarkup("Hit the {red|Hammer}, then {cyan!|go}.")).toEqual([
      { text: "Hit the " },
      { text: "Hammer", className: "font-semibold text-warning-red" },
      { text: ", then " },
      { text: "go", className: "font-bold text-cyan" },
      { text: "." },
    ]);
  });

  it("turns {icon|reactor} into an icon run", () => {
    expect(parseTutorialMarkup("damage ({icon|reactor})")).toEqual([
      { text: "damage (" },
      { text: "", icon: "reactor" },
      { text: ")" },
    ]);
  });

  it("shows an unknown tone's words unstyled", () => {
    expect(parseTutorialMarkup("{teal|odd}")).toEqual([{ text: "odd", className: undefined }]);
  });

  it("uses only known tones and leaves no stray markup in the tutorial text", () => {
    const all = [
      ...Object.values(TUTORIAL_PANELS).flatMap((p) => [...p.brief, ...(p.tasks ?? [])]),
      TUTORIAL_COMPLETION_CARD.winSupporting,
      TUTORIAL_COMPLETION_CARD.lossSupporting,
      TUTORIAL_COMPLETION_CARD.continueSupporting,
    ];
    for (const text of all) {
      for (const [, tone, inner] of text.matchAll(/\{([^|{}]*)\|([^{}]*)\}/g)) {
        if (tone === "icon") {
          expect(TUTORIAL_ICONS, `icon ${inner} in: ${text}`).toContain(inner);
        } else {
          expect(TUTORIAL_TONE_CLASSES[tone], `${tone} in: ${text}`).toBeDefined();
        }
      }
      for (const run of parseTutorialMarkup(text)) {
        expect(run.text, text).not.toMatch(/[{}|]/);
      }
    }
  });
});
