"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import posthog from "posthog-js";
import { ArtSlot } from "./ArtSlot";
import { HeaderAlphaBadge, HeaderDiscordLink, HeaderXLink } from "./BrandLinks";
import { SignInPanel, type SignInStep } from "./signIn/SignInPanel";

const DISPLAY_FONT = { fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" } as const;

/**
 * The client's sign-in screen for signed-out players: the title, the sign-in
 * panel (SignInPanel, shared with SignInModal), and the first battle (First
 * Contact, no sign-in needed) below it while the player is choosing how to
 * sign in. New players skip this screen and land in the battle directly; see
 * signedOutLanding in tutorialCompletion.ts.
 */
export function BootScreen({
  onStartFirstBattle,
  firstBattleCompleted,
}: {
  onStartFirstBattle: () => void;
  firstBattleCompleted: boolean;
}) {
  const [step, setStep] = useState<SignInStep>("email");
  const onStepChange = useCallback((next: SignInStep) => setStep(next), []);

  return (
    <ArtSlot slot="bootBackdrop" className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="relative grid w-full max-w-xl gap-6">
        <div className="grid justify-items-center gap-2 text-center">
          <h1
            className="text-5xl font-bold uppercase leading-none tracking-wider text-cyan sm:text-7xl"
            style={{ ...DISPLAY_FONT, textShadow: "0 0 20px rgba(86, 214, 255, 0.5)" }}
          >
            Void Tactics
          </h1>
          <HeaderAlphaBadge />
        </div>

        <SignInPanel surface="boot" onStepChange={onStepChange} />

        {(step === "email" || step === "wallets") && (
          <div className="grid justify-items-center gap-1 text-center">
            <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
              {firstBattleCompleted ? "Want another run at it?" : "No account yet?"}
            </span>
            <button
              type="button"
              onClick={() => {
                posthog.capture("boot_first_battle_clicked");
                onStartFirstBattle();
              }}
              className="px-4 py-1 font-mono text-sm font-bold uppercase tracking-wider text-phosphor-green underline-offset-4 hover:underline"
            >
              {firstBattleCompleted ? "Replay First Contact" : "Play First Contact"} ›
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-text-muted">
          <HeaderDiscordLink compact />
          <HeaderXLink compact />
          <Link href="/privacy" className="inline-flex min-h-8 items-center px-1 hover:text-cyan">Privacy</Link>
          <Link href="/terms" className="inline-flex min-h-8 items-center px-1 hover:text-cyan">Terms</Link>
          <Link href="/audio-credits" className="inline-flex min-h-8 items-center px-1 hover:text-cyan">Audio credits</Link>
        </div>
      </div>
    </ArtSlot>
  );
}
