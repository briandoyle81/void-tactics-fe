"use client";

import React from "react";
import { STYLE_LABEL } from "../styles/fontStyles";
import { getDialogCharacter } from "../data/dialog/characters";
import { STATIC_NODE_CONTENT } from "../config/content";
import { TUTORIAL_PRELUDE } from "../data/dialog/tutorial";
import { nodeContentTextClass, type NodeContentStatus } from "../hooks/useNodeContent";
import { missionDebriefItems } from "../utils/missionDialog";
import type { DialogMission } from "../types/dialog";
import { DialogPortrait } from "./DialogPortrait";
import { HighlightedText } from "./HighlightedText";

// A mission's description, presented as a transmission from the character
// set as the node's `speaker` in nodeContent.ts (the tutorial's in
// TUTORIAL_PRELUDE): portrait with a name plate floated
// into the text, in a panel edged in the character's color. The body uses the
// primary text color — a long briefing in an accent color is hard to read;
// the character's color carries the name, frame and edge instead. Shared by
// CampaignNodePreview(Web2) and RoguelikeGraph(Web2). Loading/missing text
// and missions with no assigned speaker render as plain description text.
/**
 * Who delivers a mission's briefing: the node's `speaker` in nodeContent.ts
 * (web2 uses the same node's, as its node ids match), the tutorial's in
 * TUTORIAL_PRELUDE.
 */
function briefingSpeaker(mission: DialogMission): string | undefined {
  if (mission.kind === "tutorial") return TUTORIAL_PRELUDE.speaker;
  return STATIC_NODE_CONTENT[mission.kind === "campaign" ? "CAMPAIGN" : "ROGUELIKE"][mission.nodeId]?.speaker;
}

export function MissionBriefing({
  mission,
  text,
  status,
  compact = false,
  debrief = false,
}: {
  mission: DialogMission;
  text: string;
  status: NodeContentStatus | undefined;
  /**
   * Smaller portrait, for narrow panels like the run map's mission drawer.
   * On phones the portrait and name sit in a row above the text instead, so
   * the text gets the full width.
   */
  compact?: boolean;
  /**
   * The mission is won: show its debrief (the result screen's victory
   * dialog) instead, when one is written.
   */
  debrief?: boolean;
}) {
  const debriefItems = debrief ? missionDebriefItems(mission) : [];
  if (debriefItems.length > 0) return <MissionDebrief items={debriefItems} />;

  const speakerId = briefingSpeaker(mission);
  const character = speakerId ? getDialogCharacter(speakerId) : undefined;

  if (!character || status !== "ok") {
    return (
      <p className={`whitespace-pre-line text-sm leading-relaxed ${nodeContentTextClass(status, "text-text-secondary")}`}>
        {status === "ok" ? <HighlightedText text={text} /> : text}
      </p>
    );
  }

  const color = character.textColor;
  return (
    <div className="border-l-2 bg-near-black/60 p-4" style={{ borderColor: color }}>
      {compact && (
        <div className="mb-3 flex items-center gap-3 sm:hidden">
          <DialogPortrait character={character} name={character.name} color={color} sizeClass="h-14 w-14" />
          <div className="flex min-w-0 flex-col gap-1">
            <span
              className="truncate text-sm font-bold uppercase leading-tight tracking-widest"
              style={{ ...STYLE_LABEL, color }}
            >
              {character.name}
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color }}>
              {"// Incoming transmission"}
            </span>
          </div>
        </div>
      )}
      {/* Portrait floats so the transmission wraps around and then under it
          — no empty column beside a long briefing. */}
      <div className={`float-left mb-2 mr-4 ${compact ? "w-20 max-sm:hidden" : "w-24 sm:w-32"}`}>
        <DialogPortrait
          character={character}
          name={character.name}
          color={color}
          sizeClass={compact ? "h-20 w-20" : "h-24 w-24 sm:h-32 sm:w-32"}
        />
        <div
          className="border border-t-0 border-solid px-1 py-1 text-center"
          style={{ borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          <div
            className="line-clamp-2 break-words text-xs font-bold uppercase leading-tight tracking-widest"
            style={{ ...STYLE_LABEL, color }}
          >
            {character.name}
          </div>
        </div>
      </div>
      <div className={`mb-2 text-[10px] uppercase tracking-[0.2em] ${compact ? "max-sm:hidden" : ""}`} style={{ color }}>
        {"// Incoming transmission"}
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
        <HighlightedText text={text} />
      </p>
      <div className="clear-both" />
    </div>
  );
}

/** A won mission's debrief as a transcript: each line with its speaker's portrait and name. */
function MissionDebrief({ items }: { items: ReturnType<typeof missionDebriefItems> }) {
  const edge = getDialogCharacter(items[0]!.characterId)?.textColor ?? "var(--color-phosphor-green)";
  return (
    <div className="border-l-2 bg-near-black/60 p-4" style={{ borderColor: edge }}>
      <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-phosphor-green">{"// Mission debrief"}</div>
      <ol className="flex flex-col gap-3">
        {items.map((item) => {
          const character = getDialogCharacter(item.characterId);
          const color = character?.textColor ?? "var(--color-text-primary)";
          const name = character?.name ?? item.characterId;
          return (
            <li key={item.key} className="flex items-start gap-3">
              <DialogPortrait character={character} name={name} color={color} sizeClass="h-12 w-12 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ ...STYLE_LABEL, color }}>
                  {name}
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                  <HighlightedText text={item.text} />
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
