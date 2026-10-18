"use client";

import React from "react";
import Image from "next/image";
import { HeroShipShowcase } from "./HeroShipShowcase";
import { TacticalTargetingPreview } from "./TacticalTargetingPreview";

// The website's hero and the sections below it (app/components/Website.tsx):
// the ship showcase, the Shattered Hive campaign, the enemy, how battles
// play, PvP, onchain, getting started and a closing Play. Open, editorial
// layout: no framed cards, sections separated by space and hairlines, large
// text left-aligned. The hero and the closing section take their Play
// button as a prop.

/** The content column every section lines up on. */
const CONTAINER = "mx-auto w-full max-w-7xl px-5 md:px-12";
const HAIRLINE = "border-t border-white/[0.07]";
/** Section headings: large display type. */
const SECTION_HEADING = "font-bold uppercase leading-[0.92] text-text-primary";

const DISPLAY_FONT = {
  fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
} as const;
const BODY_FONT = { fontFamily: "var(--font-rajdhani), sans-serif" } as const;
const MONO_FONT = { fontFamily: "var(--font-mono), monospace" } as const;

function SectionLabel({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className="text-xs uppercase tracking-[0.24em]"
      style={{ ...MONO_FONT, color }}
    >
      {children}
    </p>
  );
}

export function InfoHero({ actions }: { actions: React.ReactNode }) {
  return (
    <section
      className={`${CONTAINER} grid grid-cols-1 items-center gap-12 pb-12 pt-8 md:grid-cols-12 md:pb-16 md:pt-14`}
      aria-labelledby="info-hero-heading"
    >
      {/* Left side - Text + primary CTA */}
      <div className="flex flex-col gap-6 text-left md:col-span-5 md:gap-7">
        <SectionLabel color="var(--color-phosphor-green)">
          {"// Turn-based fleet tactics · fully onchain"}
        </SectionLabel>
        <h1
          id="info-hero-heading"
          className="text-[clamp(2.25rem,12vw,3rem)] font-bold uppercase leading-[0.9] tracking-wide text-text-primary xl:text-6xl 2xl:text-7xl"
          style={DISPLAY_FONT}
        >
          Outmaneuver.
          <br />
          Outrange.
          <br />
          <span
            className="text-cyan"
            style={{ textShadow: "0 0 20px rgba(86, 214, 255, 0.5)" }}
          >
            Outlast.
          </span>
        </h1>
        <p
          className="max-w-md text-lg font-medium leading-snug text-text-secondary md:text-xl"
          style={BODY_FONT}
        >
          Command a fleet of starships with positioning, range control, and
          ruthless target priority in tactical, turn-based battles.
        </p>
        {actions}
      </div>

      {/* Right side - Gameplay clip (above the fold), unframed */}
      <div className="w-full md:col-span-7">
        <TacticalTargetingPreview />
      </div>
    </section>
  );
}

const BATTLE_CARDS = [
  {
    title: "Maneuver",
    color: "var(--color-phosphor-green)",
    body: "Ships and nebulae block shots and paths. Use them for cover, or flank around them.",
  },
  {
    title: "Engage",
    color: "var(--color-cyan)",
    body: "Guns, EMPs, rams and repair drones. Damaged reactors go critical, and destroyed ships stay destroyed.",
  },
  {
    title: "Hold the sites",
    color: "var(--color-amber)",
    body: "Resource sites pay out every round. Hold enough of them and the region is yours.",
  },
] as const;

const ONCHAIN_POINTS = [
  {
    title: "Rules onchain",
    body: "Every move is checked by the contracts. Even the AI opponents think onchain.",
  },
  {
    title: "Art onchain",
    body: "Each ship's image is drawn by the contracts from its parts. No image server to go dark.",
  },
  {
    title: "Ships with history",
    body: "Damage, rank and kills stay with a ship from battle to battle.",
  },
  {
    title: "Open to builders",
    body: "Run your own frontend against the same contracts and earn a share of the ship sales it brings in.",
  },
] as const;

const STEPS = [
  {
    n: "01",
    color: "var(--color-cyan)",
    title: "Play First Contact",
    body: "Your first mission, guided by your adjutant. No account needed.",
  },
  {
    n: "02",
    color: "var(--color-amber)",
    title: "Claim your ships",
    body: "Sign in and the drone shipyards build your first fleet for free.",
  },
  {
    n: "03",
    color: "var(--color-phosphor-green)",
    title: "Start the operation",
    body: "Pick who flies and push into the Shattered Hive campaign.",
  },
] as const;

/**
 * Everything below the hero: the ship showcase (the ships are the heroes),
 * then the campaign. `cta` is the closing Play button (Website.tsx).
 */
export function InfoFeatureSections({ cta }: { cta: React.ReactNode }) {
  return (
    <>
      {/* Intel: the live ship showcase, ours against theirs */}
      <section className={HAIRLINE} aria-label="Intel">
        <div className={`${CONTAINER} pb-16 pt-12 md:pb-20 md:pt-16`}>
          <div className="flex flex-col items-center gap-12 md:flex-row md:gap-8">
            <div className="w-full min-w-0 flex-1">
              <HeroShipShowcase
                seedOffset={0}
                side="allied"
                forcedVariant={1}
              />
            </div>
            <p
              aria-hidden="true"
              className="hidden shrink-0 text-sm tracking-[0.3em] text-text-muted md:block"
              style={MONO_FONT}
            >
              VS
            </p>
            <div className="hidden w-full min-w-0 flex-1 md:block">
              <HeroShipShowcase
                seedOffset={3}
                side="enemy"
                flipLayout={true}
                forcedVariant={2}
              />
            </div>
          </div>
        </div>
      </section>

      {/* The campaign: the story over the key art, darkened so the text
          reads, fading into the page at the bottom */}
      <section
        className="relative isolate overflow-hidden"
        aria-labelledby="info-campaign-heading"
      >
        <Image
          src="/img/site-art/shattered-hive-no-text.webp"
          alt="A human cruiser faces a Hive warship in an asteroid field"
          fill
          sizes="100vw"
          className="-z-10 object-cover"
          style={{ objectPosition: "center 40%" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to bottom, rgba(12, 17, 23, 0.45) 0%, rgba(12, 17, 23, 0.7) 50%, var(--color-near-black) 100%), linear-gradient(to right, rgba(12, 17, 23, 0.6) 0%, rgba(12, 17, 23, 0) 70%)",
          }}
        />
        <div className={`${CONTAINER} flex flex-col gap-12 pb-16 pt-20 md:gap-16 md:pb-20 md:pt-32`}>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-16">
            <div className="flex flex-col gap-4 md:col-span-5">
              <SectionLabel color="var(--color-amber)">
                [The campaign]
              </SectionLabel>
              <h2
                id="info-campaign-heading"
                className={`${SECTION_HEADING} text-6xl md:text-8xl`}
                style={DISPLAY_FONT}
              >
                Shattered Hive
              </h2>
            </div>
            <div className="flex flex-col gap-5 md:col-span-7 md:pt-2">
              <p
                className="text-xl font-medium leading-snug text-text-primary md:text-2xl"
                style={BODY_FONT}
              >
                It starts with an odd dispatch: unidentified ships at a mining
                claim, running dark. No answer to your hails. No IFF, which means
                no legal claim to the site, which means no point in fighting.
              </p>
              <p
                className="text-lg font-medium leading-relaxed text-text-secondary md:text-xl"
                style={BODY_FONT}
              >
                Every encounter, they seem to learn a little more about you.
                Follow the trail and find out who, or what, is on the other side.
              </p>
            </div>
          </div>
          <ol className="grid grid-cols-1 gap-10 md:grid-cols-3">
            {[
              "Choose your route on the star chart. Every path you commit to closes the others behind you.",
              "The ships you bring are the ships you keep, scars and all. Repair and regroup at resupply stations.",
              "Adjutant Bosch is on comms for every mission, piecing together what you're up against.",
            ].map((line, i) => (
              <li
                key={line}
                className="flex flex-col gap-3 border-t border-amber/50 pt-5"
              >
                <span className="text-xs text-amber" style={MONO_FONT}>
                  {`0${i + 1}`}
                </span>
                <span
                  className="text-lg font-medium leading-snug text-text-secondary"
                  style={BODY_FONT}
                >
                  {line}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* The enemy: an intercepted line, the portrait beside it */}
      <section className="bg-[#0d0806]" aria-label="The enemy">
        <div
          className={`${CONTAINER} flex flex-col items-start gap-8 py-14 md:flex-row md:items-center md:gap-14 md:py-16`}
        >
          <Image
            src="/img/character-art/hive-queen.svg"
            alt="Unknown source"
            width={256}
            height={256}
            unoptimized
            className="h-40 w-40 shrink-0 object-cover md:h-64 md:w-64"
          />
          <div className="flex min-w-0 flex-col gap-5">
            <p
              className="text-base uppercase tracking-[0.2em] md:text-xl"
              style={{ ...MONO_FONT, color: "var(--color-warning-red)" }}
            >
              {"// Intercepted · Unknown Source"}
            </p>
            <p
              className="text-5xl font-semibold leading-none text-text-primary md:text-7xl lg:text-8xl"
              style={DISPLAY_FONT}
            >
              &ldquo;Your hulls break so easily.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* How a battle plays */}
      <section aria-labelledby="info-battle-heading">
        <div className={`${CONTAINER} py-16 md:py-20`}>
          <h2
            id="info-battle-heading"
            className={`${SECTION_HEADING} mb-10 max-w-4xl text-5xl md:mb-12 md:text-7xl lg:text-8xl`}
            style={DISPLAY_FONT}
          >
            Every turn is a decision
          </h2>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            {BATTLE_CARDS.map(({ title, color, body }) => (
              <div key={title} className="flex flex-col gap-4">
                <span
                  aria-hidden="true"
                  className="h-[3px] w-12"
                  style={{ backgroundColor: color }}
                />
                <h3
                  className="text-3xl font-bold uppercase md:text-4xl"
                  style={{ ...DISPLAY_FONT, color }}
                >
                  {title}
                </h3>
                <p
                  className="text-lg font-medium leading-relaxed text-text-secondary"
                  style={BODY_FONT}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PvP: the key art fills one half, the pitch the other */}
      <section
        className="flex flex-col bg-white/[0.02] md:flex-row"
        aria-labelledby="info-pvp-heading"
      >
        <div className="relative min-h-[300px] md:min-h-[480px] md:flex-1">
          <Image
            src="/img/site-art/pvp-title.webp"
            alt="Two fleets trade laser fire in an asteroid field as a ship explodes"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col justify-center gap-7 px-5 py-16 md:flex-1 md:px-16 md:py-20 lg:px-24">
          <h2
            id="info-pvp-heading"
            className={`${SECTION_HEADING} text-5xl md:text-7xl`}
            style={DISPLAY_FONT}
          >
            Face other admirals
          </h2>
          <p
            className="max-w-lg text-xl font-medium leading-snug text-text-primary md:text-2xl"
            style={BODY_FONT}
          >
            When your fleet is ready, take it into PvP. Open a lobby or join
            one, and outthink a real opponent, turn by turn.
          </p>
          <ol className="max-w-lg border-b border-white/10">
            {[
              "Set the terms: the map, the fleet threat limit, turn pace and match length.",
              "Take on anyone, or reserve the lobby for a rival.",
              "Every kill ranks up the ship that made it.",
            ].map((line, i) => (
              <li
                key={line}
                className="flex gap-5 border-t border-white/10 py-4"
              >
                <span
                  className="pt-1 text-xs text-warning-red"
                  style={MONO_FONT}
                >
                  {`0${i + 1}`}
                </span>
                <span
                  className="text-lg font-medium leading-snug text-text-secondary"
                  style={BODY_FONT}
                >
                  {line}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Fully onchain */}
      <section aria-labelledby="info-onchain-heading">
        <div
          className={`${CONTAINER} grid grid-cols-1 gap-12 py-16 md:grid-cols-12 md:gap-16 md:py-20`}
        >
          <div className="flex flex-col gap-7 md:col-span-5">
            <h2
              id="info-onchain-heading"
              className={`${SECTION_HEADING} text-5xl md:text-7xl`}
              style={DISPLAY_FONT}
            >
              Built to outlive us
            </h2>
            <p
              className="text-xl font-medium leading-snug text-text-secondary md:text-2xl"
              style={BODY_FONT}
            >
              The rules, the ships and every match live onchain. If we
              disappeared tomorrow, the game would keep running, and your fleet
              would still be yours.
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-x-12 sm:grid-cols-2 md:col-span-7">
            {ONCHAIN_POINTS.map(({ title, body }) => (
              <div key={title} className="border-t border-purple/40 pb-8 pt-6">
                <dt
                  className="text-xl font-bold uppercase text-purple md:text-2xl"
                  style={DISPLAY_FONT}
                >
                  {title}
                </dt>
                <dd
                  className="mt-2.5 text-lg font-medium leading-relaxed text-text-secondary"
                  style={BODY_FONT}
                >
                  {body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Getting started */}
      <section className={HAIRLINE} aria-labelledby="info-getting-started-heading">
        <div className={`${CONTAINER} py-16 md:py-20`}>
          <h2
            id="info-getting-started-heading"
            className={`${SECTION_HEADING} mb-10 text-5xl md:mb-12 md:text-7xl lg:text-8xl`}
            style={DISPLAY_FONT}
          >
            Three steps to command
          </h2>
          <ol className="grid grid-cols-1 gap-12 md:grid-cols-3">
            {STEPS.map(({ n, color, title, body }) => (
              <li key={n} className="flex flex-col gap-4">
                <span
                  className="text-8xl font-bold leading-[0.8] tabular-nums md:text-9xl"
                  style={{
                    ...DISPLAY_FONT,
                    color: "transparent",
                    WebkitTextStroke: `1.5px ${color}`,
                  }}
                >
                  {n}
                </span>
                <h3
                  className="text-2xl font-bold uppercase text-text-primary md:text-3xl"
                  style={DISPLAY_FONT}
                >
                  {title}
                </h3>
                <p
                  className="text-lg font-medium leading-relaxed text-text-secondary"
                  style={BODY_FONT}
                >
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing call to action */}
      <section className={HAIRLINE} aria-label="Play">
        <div className={`${CONTAINER} flex flex-col items-start gap-10 py-16 md:flex-row md:items-center md:justify-between md:gap-16 md:py-20`}>
          <h2
            className={`${SECTION_HEADING} min-w-0 max-w-5xl text-5xl md:text-7xl lg:text-8xl`}
            style={DISPLAY_FONT}
          >
            Your first mission is waiting, Admiral.
          </h2>
          <div className="shrink-0">{cta}</div>
        </div>
      </section>
    </>
  );
}
