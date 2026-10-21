import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms" },
  description: "Terms for using the Void Tactics alpha.",
};

export default function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p
          className="mb-10 text-sm uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          Last updated: April 9, 2026
        </p>

        <div className="space-y-6 text-sm leading-relaxed sm:text-base">
          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Agreement
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              By accessing or using Void Tactics (the &quot;Service&quot;), you agree
              to these Terms of Service. If you do not agree, do not use the
              Service. We may change these terms; the date above will be updated when
              we do. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Operator
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              The Service is operated by Brian Doyle, an individual developer based
              in the United States (&quot;we&quot;, &quot;us&quot;, or the
              &quot;operator&quot;). Void Tactics is not offered by a registered
              company or LLC. You are entering into these terms with the operator
              personally.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Eligibility
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              You must be at least 13 years old to use the Service. If you are under
              the age of majority where you live, you may use the Service only with
              permission from a parent or legal guardian.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Testnet, alpha, and resets
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              The Service is offered for alpha and testing purposes, including on
              test networks. It may be unstable, incomplete, or unavailable at any
              time. Features, smart contracts, and economics may change or reset.
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              While the game is in alpha, in-game progress, match state, fleets, and
              other assets may be reset or lost on a regular basis as we deploy
              updates, migrate contracts, or wipe test data. You should not rely on
              any alpha state persisting.
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              The Service is intended for testing. Any tokens, items, or other assets
              you see or use in the test environment are for that environment only.
              They may be reset, deleted, or rendered unusable at any time, with or
              without notice. You use the Service at your own risk.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Not financial, legal, or tax advice
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Nothing on the Service is financial, legal, or tax advice. Digital
              assets and blockchain transactions carry risk, including total loss.
              You are solely responsible for your decisions and for compliance with
              laws that apply to you.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Game and in-game assets
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Void Tactics is a game. For purposes of these terms, we do not treat
              any in-game items, tokens, NFTs, or other digital objects associated
              with the Service as having monetary or investment value, and we make
              no representation that they have or will have value.
            </p>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Nothing in these terms prevents you from arranging personal deals,
              trades, or transfers of game-related assets with other players on your
              own. Such arrangements are between you and the other parties. We are
              not a party to those deals and do not endorse, guarantee, or supervise
              them. You are responsible for your own compliance with applicable laws
              when you trade or deal with others.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Your wallet and transactions
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              You are solely responsible for your wallet, private keys, seed phrases,
              and any transactions you sign or submit. We do not custody your assets
              and cannot recover lost keys, reverse onchain transactions, or undo
              mistaken transfers. If you lose access to your wallet, we cannot
              restore it.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Smart contracts and software risk
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Smart contracts, front-end software, and other code associated with
              the Service may contain bugs, errors, or vulnerabilities. Exploits or
              failures could result in loss of assets, loss of access, or loss of
              functionality. You accept these risks when you use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Your conduct
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              You agree not to misuse the Service, including attempting to disrupt,
              scrape, or attack it, or to use it for unlawful purposes. We may
              suspend or limit your access when we believe it is necessary to
              protect the Service or other users.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Changes, suspension, and discontinuance
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              We may modify, suspend, or discontinue the Service, or any part of it,
              at any time, with or without notice. That includes changing features,
              deleting data, resetting game state, or ending the alpha entirely. We
              are not liable to you for any change, suspension, or discontinuance.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Intellectual property
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              The Service, its branding, UI, and original content are owned by the
              operator or its licensors. You receive a limited, revocable license to
              use the Service as intended. You do not acquire rights in our
              intellectual property except as stated here.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Disclaimer of warranties
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
              WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Limitation of liability
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR, VOID TACTICS, AND
              CONTRIBUTORS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
              DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE, EVEN IF
              ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY FOR ANY
              CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF ONE
              HUNDRED U.S. DOLLARS OR THE AMOUNT YOU PAID US FOR THE SERVICE IN THE
              TWELVE MONTHS BEFORE THE CLAIM (WHICH MAY BE ZERO FOR A FREE TESTNET
              ALPHA).
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Governing law
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              These terms are governed by the laws of the United States, without
              regard to conflict-of-law rules. If a provision is unenforceable, the
              remaining provisions remain in effect.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
