import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Audio Credits | Void Tactics",
  description: "Audio asset credits used in the Void Tactics alpha.",
};

export default function AudioCreditsPage() {
  return (
    <div
      className="min-h-screen px-4 py-10 sm:px-8"
      style={{
        backgroundColor: "var(--color-near-black)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-jetbrains-mono), 'Courier New', monospace",
      }}
    >
      <div className="mx-auto max-w-3xl">
        <p className="mb-8">
          <Link
            href="/"
            className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
          >
            Back to Void Tactics
          </Link>
        </p>

        <h1
          className="mb-2 text-2xl font-bold uppercase tracking-wider sm:text-3xl"
          style={{
            fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
            color: "var(--color-cyan)",
          }}
        >
          Audio Credits
        </h1>

        <p
          className="mb-10 text-sm uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          Last updated: October 11, 2026
        </p>

        <div className="space-y-6 text-sm leading-relaxed sm:text-base">
          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              UI Sound Effect
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              &ldquo;UI_6 Tonal beep.Aliens.Proximity
              alert(63osc,chrs,cmpr).wav&rdquo;
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              <span className="opacity-80">Source:</span>{" "}
              <a
                href="https://freesound.org/s/563864/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                freesound.org/s/563864/
              </a>
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              <span className="opacity-80">License:</span> Attribution 4.0
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Comms Sound Effect
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              &ldquo;comms.mp3&rdquo;
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Sound Effect by{" "}
              <a
                href="https://pixabay.com/users/alexis_gaming_cam-50011695/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=338296"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                ALEXIS_GAMING_CAM
              </a>{" "}
              from{" "}
              <a
                href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=338296"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                Pixabay
              </a>
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              <span className="opacity-80">License:</span>{" "}
              <a
                href="https://pixabay.com/service/license-summary/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                Pixabay License Summary
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Ram Sound Effect
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              &ldquo;crash.mp3&rdquo;
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Sound Effect by{" "}
              <a
                href="https://pixabay.com/users/u_mgq59j5ayf-50948372/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=394903"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                u_mgq59j5ayf
              </a>{" "}
              from{" "}
              <a
                href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=394903"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                Pixabay
              </a>
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              <span className="opacity-80">License:</span>{" "}
              <a
                href="https://pixabay.com/service/license-summary/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                Pixabay License Summary
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Background Music
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              &ldquo;synthwave-80s-robot-swarm-218092.mp3&rdquo;
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              <span className="opacity-80">Source:</span> Pixabay
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              <span className="opacity-80">Author credit:</span> Nick Panek{" "}
              <a
                href="https://heylink.me/nickpanek/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                (check my other projects)
              </a>
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              <span className="opacity-80">License:</span>{" "}
              <a
                href="https://pixabay.com/service/license-summary/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                Pixabay License Summary
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
