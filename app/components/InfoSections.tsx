"use client";

import React from "react";
import Image from "next/image";
import { HeroShipShowcase } from "./HeroShipShowcase";
import { TacticalTargetingPreview } from "./TacticalTargetingPreview";

// The website's hero and the sections below it (app/components/Website.tsx):
// the ship showcase, then the Shattered Hive campaign. The hero and the
// closing section take their Play button as a prop.

/** Grid wrapper the sections render in. */
export const INFO_GRID_CLASS =
  "mx-auto grid w-full max-w-6xl grid-cols-1 gap-x-4 gap-y-4 px-0 md:grid-cols-12 md:gap-x-6 md:gap-y-8 md:px-0";

/** Full width so its inner grid aligns with the feature sections below. */
export function InfoHero({ actions }: { actions: React.ReactNode }) {
  return (
    <section
      className="corner-bracket relative overflow-hidden border-2 bg-black/60 py-4 md:col-span-12 md:py-8"
      style={{ borderColor: "var(--color-cyan)", borderRadius: 0 }}
      aria-labelledby="info-hero-heading"
    >
      {/* Background pattern/grid effect */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-cyan) 1px, transparent 1px), linear-gradient(90deg, var(--color-cyan) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 grid grid-cols-1 items-center gap-4 px-2 md:grid-cols-12 md:gap-6 md:px-0">
        {/* Left side - Text + primary CTA */}
        <div className="text-left md:col-span-5 md:pl-8 md:pr-2">
          <p
            className="mb-3 text-xs uppercase tracking-[0.24em] md:mb-4"
            style={{
              fontFamily: "var(--font-mono), monospace",
              color: "var(--color-phosphor-green)",
            }}
          >
            {"// Turn-based fleet tactics · fully onchain"}
          </p>
          <h1
            id="info-hero-heading"
            className="mb-4 text-5xl font-bold uppercase leading-[0.92] tracking-wide md:mb-5 md:text-5xl xl:text-6xl"
            style={{
              fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              color: "var(--color-text-primary)",
            }}
          >
            Outmaneuver.
            <br />
            Outrange.
            <br />
            <span
              style={{
                color: "var(--color-cyan)",
                textShadow: "0 0 20px rgba(86, 214, 255, 0.5)",
              }}
            >
              Outlast.
            </span>
          </h1>
          <p
            className="mb-5 text-base leading-snug opacity-100 md:mb-6 md:text-lg"
            style={{
              fontFamily: "var(--font-rajdhani), sans-serif",
              color: "var(--color-text-primary)",
            }}
          >
            Command a fleet of starships with positioning, range control, and
            ruthless target priority in tactical, turn-based battles.
          </p>
          {actions}
        </div>

        {/* Right side - Gameplay clip (above the fold) */}
        <div className="flex justify-center px-0 md:col-span-7 md:justify-end md:pr-8 md:pl-0">
          <div className="w-full">
            <TacticalTargetingPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

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
      className="mb-2 text-xs uppercase tracking-[0.24em]"
      style={{ ...MONO_FONT, color }}
    >
      {children}
    </p>
  );
}

function SectionTitle({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="mb-4 text-3xl font-bold uppercase leading-none tracking-wide text-text-primary md:text-5xl"
      style={DISPLAY_FONT}
    >
      {children}
    </h2>
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
      {/* Intel: the live ship showcase */}
      <section
        className="corner-bracket corner-bracket-green relative border-2 border-phosphor-green bg-black/40 p-2 md:col-span-12 md:p-6"
        style={{
          borderRadius: 0,
        }}
        aria-labelledby="info-intel-heading"
      >
        <h2
          id="info-intel-heading"
          className="text-xl font-bold mb-3 tracking-wider text-center md:text-left"
          style={{ ...DISPLAY_FONT, color: "var(--color-phosphor-green)" }}
        >
          [INTEL]
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-black/0 p-1" style={{ borderRadius: 0 }}>
            <HeroShipShowcase
              seedOffset={0}
              align="start"
              side="allied"
              forcedVariant={1}
            />
          </div>
          <div
            className="hidden bg-black/0 p-1 md:block"
            style={{ borderRadius: 0 }}
          >
            <HeroShipShowcase
              seedOffset={3}
              align="start"
              side="enemy"
              flipLayout={true}
              forcedVariant={2}
            />
          </div>
        </div>
      </section>

      {/* The campaign */}
      <section
        className="corner-bracket corner-bracket-amber relative border-2 border-amber bg-black/40 p-2 md:col-span-12 md:p-6"
        style={{ borderRadius: 0 }}
        aria-labelledby="info-campaign-heading"
      >
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12">
          <Image
            src="/img/site-art/shatterd-hive-title.webp"
            alt="Shattered Hive: a human cruiser faces a Hive warship in an asteroid field"
            width={1796}
            height={1200}
            sizes="(min-width: 768px) 640px, 100vw"
            className="h-auto w-full border-2 border-gunmetal object-cover md:col-span-7"
            style={{ maxHeight: 420 }}
          />
          <div className="md:col-span-5">
            <SectionLabel color="var(--color-amber)">
              [The campaign]
            </SectionLabel>
            <SectionTitle id="info-campaign-heading">
              Shattered Hive
            </SectionTitle>
            <p className="mb-3 text-base text-text-primary" style={BODY_FONT}>
              It starts with an odd dispatch: unidentified ships at a mining
              claim, running dark. No answer to your hails. No IFF, which means
              no legal claim to the site, which means no point in fighting.
            </p>
            <p className="mb-4 text-base text-text-primary" style={BODY_FONT}>
              Every encounter, they seem to learn a little more about you.
              Follow the trail and find out who, or what, is on the other side.
            </p>
            <ol
              className="space-y-3 text-sm text-text-primary"
              style={MONO_FONT}
            >
              {[
                "Choose your route on the star chart. Every path you commit to closes the others behind you.",
                "The ships you bring are the ships you keep, scars and all. Repair and regroup at resupply stations.",
                "Adjutant Bosch is on comms for every mission, piecing together what you're up against.",
              ].map((line, i) => (
                <li key={line} className="flex gap-3">
                  <span className="text-amber">{`0${i + 1}`}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* The enemy */}
      <section
        className="corner-bracket corner-bracket-red relative border-2 border-warning-red bg-black/40 p-2 md:col-span-12 md:p-6"
        style={{ borderRadius: 0 }}
        aria-label="The enemy"
      >
        <div className="flex flex-wrap items-center gap-6">
          <Image
            src="/img/character-art/hive-queen.svg"
            alt="Unknown source"
            width={144}
            height={144}
            unoptimized
            className="h-28 w-28 shrink-0 border-2 border-warning-red object-cover md:h-36 md:w-36"
          />
          <div className="min-w-0 flex-1">
            <SectionLabel color="var(--color-warning-red)">
              {"// Intercepted · Unknown Source"}
            </SectionLabel>
            <p
              className="text-3xl leading-tight text-text-primary md:text-4xl"
              style={DISPLAY_FONT}
            >
              &ldquo;Your hulls break so easily.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* How a battle plays */}
      <section
        className="corner-bracket relative border-2 bg-black/40 p-2 md:col-span-12 md:p-6"
        style={{ borderRadius: 0, borderColor: "var(--color-cyan)" }}
        aria-labelledby="info-battle-heading"
      >
        <SectionTitle id="info-battle-heading">
          Every turn is a decision
        </SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {BATTLE_CARDS.map(({ title, color, body }) => (
            <article
              key={title}
              className="border border-gunmetal bg-black/40 p-4"
              style={{ borderTop: `3px solid ${color}` }}
            >
              <h3
                className="mb-2 text-2xl font-bold uppercase"
                style={{ ...DISPLAY_FONT, color }}
              >
                {title}
              </h3>
              <p className="text-sm text-text-primary" style={MONO_FONT}>
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* PvP */}
      <section
        className="corner-bracket corner-bracket-red relative border-2 border-warning-red bg-black/40 p-2 md:col-span-12 md:p-6"
        style={{ borderRadius: 0 }}
        aria-labelledby="info-pvp-heading"
      >
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12">
          <div className="md:col-span-5">
            <SectionTitle id="info-pvp-heading">
              Face other admirals
            </SectionTitle>
            <p className="mb-4 text-base text-text-primary" style={BODY_FONT}>
              When your fleet is ready, take it into PvP. Open a lobby or join
              one, and outthink a real opponent, turn by turn.
            </p>
            <ol
              className="space-y-3 text-sm text-text-primary"
              style={MONO_FONT}
            >
              {[
                "Set the terms: the map, the fleet threat limit, turn pace and match length.",
                "Take on anyone, or reserve the lobby for a rival.",
                "Every kill ranks up the ship that made it.",
              ].map((line, i) => (
                <li key={line} className="flex gap-3">
                  <span className="text-warning-red">{`0${i + 1}`}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </div>
          <Image
            src="/img/site-art/pvp-title.webp"
            alt="Two fleets trade laser fire in an asteroid field as a ship explodes"
            width={1672}
            height={941}
            sizes="(min-width: 768px) 640px, 100vw"
            className="h-auto w-full border-2 border-gunmetal object-cover md:col-span-7"
            style={{ maxHeight: 420 }}
          />
        </div>
      </section>

      {/* Fully onchain */}
      <section
        className="corner-bracket corner-bracket-purple relative border-2 bg-black/40 p-2 md:col-span-12 md:p-6"
        style={{ borderRadius: 0, borderColor: "var(--color-purple)" }}
        aria-labelledby="info-onchain-heading"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="md:col-span-5">
            <SectionTitle id="info-onchain-heading">
              Built to outlive us
            </SectionTitle>
            <p className="text-base text-text-primary" style={BODY_FONT}>
              The rules, the ships and every match live onchain. If we
              disappeared tomorrow, the game would keep running, and your fleet
              would still be yours.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-7">
            {ONCHAIN_POINTS.map(({ title, body }) => (
              <div key={title} className="border border-gunmetal p-4">
                <h3
                  className="mb-2 text-sm uppercase tracking-widest text-purple"
                  style={MONO_FONT}
                >
                  {title}
                </h3>
                <p className="text-sm text-text-primary" style={MONO_FONT}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Getting started */}
      <section
        className="corner-bracket corner-bracket-green relative border-2 border-phosphor-green bg-black/40 p-2 md:col-span-12 md:p-6"
        style={{ borderRadius: 0 }}
        aria-labelledby="info-getting-started-heading"
      >
        <SectionTitle id="info-getting-started-heading">
          Three steps to command
        </SectionTitle>
        <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map(({ n, color, title, body }) => (
            <li key={n} className="flex items-start gap-4">
              <span
                className="text-4xl font-bold leading-none tabular-nums"
                style={{ ...DISPLAY_FONT, color }}
              >
                {n}
              </span>
              <div className="min-w-0">
                <h3
                  className="mb-1 text-sm font-bold uppercase tracking-widest text-text-primary"
                  style={MONO_FONT}
                >
                  {title}
                </h3>
                <p className="text-sm text-text-secondary" style={MONO_FONT}>
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing call to action */}
      <section
        className="flex flex-wrap items-center justify-between gap-4 border-t border-gunmetal px-2 py-8 md:col-span-12 md:px-6"
        aria-label="Play"
      >
        <h2
          className="text-2xl font-bold uppercase leading-tight text-text-primary md:text-4xl"
          style={DISPLAY_FONT}
        >
          Your first mission is waiting, Admiral.
        </h2>
        {cta}
      </section>
    </>
  );
}
