"use client";

import Link from "next/link";
import SiteFooter from "./SiteFooter";
import { HeaderAlphaBadge, HeaderDiscordLink, HeaderXLink } from "./BrandLinks";
import { InfoFeatureSections, InfoHero } from "./InfoSections";
import { PLAY_PATH } from "../config/routes";
import posthog from "posthog-js";

// Into the game client. Plain Play takes a new visitor straight into their
// first battle; `?signin=1` opens the sign-in screen instead (see
// signedOutLanding in app/utils/tutorialCompletion.ts). That one is a plain
// page load, not a client-side Link: the client reads the query on its first
// render, which a Link transition reaches before the URL changes.
function PlayLink({
  surface,
  className,
  href = PLAY_PATH,
  label = "[PLAY]",
  solid = false,
}: {
  surface: string;
  className: string;
  href?: string;
  label?: string;
  /** Filled cyan, for the main calls to action. */
  solid?: boolean;
}) {
  const Anchor = href === PLAY_PATH ? Link : "a";
  return (
    <Anchor
      href={href}
      onClick={() => posthog.capture("website_play_clicked", { surface })}
      className={`inline-flex items-center justify-center border-2 border-solid uppercase font-black tracking-wider transition-[filter,background-color] duration-150 ${solid ? "hover:brightness-110" : "hover:bg-steel"} ${className}`}
      style={{
        fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
        borderColor: "var(--color-cyan)",
        color: solid ? "var(--color-near-black)" : "var(--color-cyan)",
        backgroundColor: solid ? "var(--color-cyan)" : "rgba(34, 48, 65, 0.85)",
        borderRadius: 0,
        boxShadow: solid
          ? "0 0 32px rgba(86, 214, 255, 0.35)"
          : "0 0 22px rgba(86, 214, 255, 0.18)",
      }}
    >
      {label}
    </Anchor>
  );
}

function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center gap-3 px-5 py-5 md:px-12">
      <Link href="/" aria-label="Void Tactics home" className="relative shrink-0">
        <span
          className="text-2xl font-black uppercase leading-none tracking-[0.06em] md:text-3xl"
          style={{
            fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
            color: "var(--color-text-primary, #e2e8f0)",
          }}
        >
          VOID TACTICS
        </span>
        <span
          className="absolute -bottom-1 left-0 right-0 h-0.5"
          style={{ backgroundColor: "var(--color-cyan)" }}
        />
      </Link>
      <span className="hidden sm:block">
        <HeaderAlphaBadge compact />
      </span>
      <div className="ml-auto flex items-center gap-2">
        <HeaderDiscordLink compact />
        <HeaderXLink compact />
        <PlayLink
          surface="header"
          href={`${PLAY_PATH}?signin=1`}
          label="[SIGN UP/LOGIN]"
          className="h-8 px-4 text-sm"
        />
      </div>
    </header>
  );
}

/**
 * The website (voidtactics.xyz): what the game is and a way in. No game
 * controls — Play opens the game client.
 */
export default function Website() {
  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--color-near-black)" }}>
      <SiteHeader />
      <main className="flex w-full flex-1 flex-col" aria-label="Void Tactics">
        <p className="sr-only">
          Void Tactics is a fully onchain turn-based PvP fleet strategy game. Build ships,
          manage your navy, join lobbies, and play tactical grid battles where range, movement,
          and target priority decide each match.
        </p>
        <InfoHero
          actions={
            <div className="flex flex-col items-stretch gap-3 md:items-start">
              <PlayLink
                surface="hero"
                label="[PLAY NOW]"
                solid
                className="w-full px-6 py-3.5 text-sm sm:px-8 sm:text-base md:w-auto md:px-10 md:py-4"
              />
            </div>
          }
        />
        <InfoFeatureSections
          cta={
            <PlayLink
              surface="closing"
              label="[PLAY NOW]"
              solid
              className="px-8 py-4 text-base md:px-12 md:py-5 md:text-lg"
            />
          }
        />
      </main>
      <div className="shrink-0 pb-6">
        <SiteFooter />
      </div>
    </div>
  );
}
