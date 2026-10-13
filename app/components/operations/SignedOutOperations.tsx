"use client";

import { RoguelikeGraph } from "../RoguelikeGraph";
import {
  persistTutorialSkippedSignedOut,
  startTutorialFromOperations,
} from "../../utils/tutorialCompletion";

const DISPLAY_FONT = { fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" } as const;
const NOOP = () => {};

/**
 * What a new, signed-out visitor sees at /play (signedOutLanding "map"): the
 * Operations map with First Contact as their first mission, playable without
 * an account. Anything past it needs one: Skip Tutorial and Sign Up/Login
 * open the sign-in screen (`onSignIn`). The map reads campaign data from the
 * chain, so it works with no wallet connected.
 */
export function SignedOutOperations({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex w-full flex-col gap-3 px-2 py-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 font-mono text-xs text-phosphor-green/70">&gt; No account needed to play.</p>
        <button
          type="button"
          onClick={onSignIn}
          className="border-2 border-solid border-cyan px-4 py-1.5 text-sm font-black uppercase tracking-wider text-cyan transition-colors duration-150 hover:bg-steel"
          style={{ ...DISPLAY_FONT, borderRadius: 0 }}
        >
          [Sign up/Login]
        </button>
      </div>
      <RoguelikeGraph
        run={null}
        onRunEnded={NOOP}
        onRunAdvanced={NOOP}
        tutorial={{
          onStart: startTutorialFromOperations,
          // Skipping means playing for real, which needs an account: sign in
          // first. The skip is kept for whoever signs in on this device.
          onSkip: () => {
            persistTutorialSkippedSignedOut();
            onSignIn();
          },
        }}
      />
    </div>
  );
}
