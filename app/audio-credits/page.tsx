import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Audio Credits",
  alternates: { canonical: "/audio-credits" },
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
          Last updated: October 23, 2026
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
              Missile Launch Sound Effect
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              &ldquo;Mechanical1.wav&rdquo; by BMacZero
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              <span className="opacity-80">Source:</span>{" "}
              <a
                href="https://freesound.org/s/94120/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                freesound.org/s/94120/
              </a>
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              <span className="opacity-80">License:</span> Creative Commons 0
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

          <PixabayMusicCredit
            heading="Music Outside Battle"
            file="night-221519.mp3"
            title="Night"
            artist="Begench_Begenjov"
            href="https://pixabay.com/music/synthwave-night-221519/"
          />
          <PixabayMusicCredit
            heading="Tutorial Mission Music"
            file="chill-synthwave-211190.mp3"
            title="Chill Synthwave"
            artist="NickPanek"
            href="https://pixabay.com/music/synthwave-chill-synthwave-211190/"
          />
          <PixabayMusicCredit
            heading="Mission Music: A Strange Encounter"
            file="dark-synth-wave-221328.mp3"
            title="Dark Synth Wave"
            artist="ElephantGreen"
            href="https://pixabay.com/music/synthwave-dark-synth-wave-221328/"
          />
          <PixabayMusicCredit
            heading="Mission Music: Digging Deeper"
            file="bransboynd-retro-game-402454.mp3"
            title="Retro Game"
            artist="Roman Rumyantsev"
            artistHref="https://pixabay.com/users/bransboynd-51721546/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=402454"
            href="https://pixabay.com/music//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=402454"
          />
          <PixabayMusicCredit
            heading="Mission Music: Collision Course"
            file="tom091178-neon-dystopia-vaporwave-1-562018.mp3"
            title="Neon-Dystopia-Vaporwave-1"
            artist="tom091178"
            artistHref="https://pixabay.com/users/tom091178-52127885/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=562018"
            href="https://pixabay.com/music//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=562018"
          />
          <PixabayMusicCredit
            heading="Mission Music: Shocking Revelation"
            file="nickpanek-dark-synthwave-instrumental-with-dubstep-elements-323643.mp3"
            title="Dark Synthwave Instrumental with Dubstep Elements"
            artist="Nicholas Panek"
            artistHref="https://pixabay.com/users/nickpanek-38266323/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=323643"
            href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=323643"
          />

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Sergeant Portrait
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Sergeant Sasha portrait, from &ldquo;Soldier in camouflage with
              red beret&rdquo;
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Photo by{" "}
              <a
                href="https://www.pexels.com/@rapha-fernandes-2160921068/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                Rapha Fernandes
              </a>{" "}
              from{" "}
              <a
                href="https://www.pexels.com/photo/soldier-in-camouflage-with-red-beret-37136229/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                Pexels
              </a>
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              <span className="opacity-80">License:</span>{" "}
              <a
                href="https://www.pexels.com/license/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                Pexels License
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

const LINK_CLASS =
  "text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80";

/** A Pixabay music track's credit, in the same layout as the entries above. */
function PixabayMusicCredit({
  heading,
  file,
  title,
  artist,
  artistHref,
  href,
}: {
  heading: string;
  file: string;
  title: string;
  artist: string;
  artistHref?: string;
  href: string;
}) {
  const artistCredit = artistHref ? (
    <a href={artistHref} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {artist}
    </a>
  ) : (
    artist
  );
  return (
    <section className="space-y-3">
      <h2
        className="text-lg font-bold uppercase tracking-wide"
        style={{ fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" }}
      >
        {heading}
      </h2>
      <p style={{ color: "var(--color-text-secondary)" }}>&ldquo;{file}&rdquo;</p>
      <p style={{ color: "var(--color-text-secondary)" }}>
        &ldquo;{title}&rdquo; by {artistCredit} from{" "}
        <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          Pixabay
        </a>
      </p>
      <p style={{ color: "var(--color-text-secondary)" }}>
        <span className="opacity-80">License:</span>{" "}
        <a
          href="https://pixabay.com/service/license-summary/"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          Pixabay License Summary
        </a>
      </p>
    </section>
  );
}
