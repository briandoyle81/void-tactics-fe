import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
  description: "How Void Tactics handles information when you use the alpha.",
};

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p
          className="mb-10 text-sm uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          Last updated: April 22, 2026
        </p>

        <div className="space-y-6 text-sm leading-relaxed sm:text-base">
          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
                color: "var(--color-text-primary)",
              }}
            >
              Overview
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Void Tactics (&quot;we&quot;, &quot;us&quot;) is provided as an alpha
              experience. This policy describes how information may be collected or
              processed when you use our website and related interfaces. If you do
              not agree, please do not use the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Wallet and onchain data
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Connecting a wallet is voluntary. Your public wallet address and
              onchain activity may be visible to us, to blockchain indexers, and to
              anyone else observing the networks you use. We do not control public
              blockchains and cannot remove data that is already onchain.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Local storage and similar technologies
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              The app may store preferences, tutorial progress, and similar data in
              your browser (for example localStorage or sessionStorage) so the
              experience can work offline of a dedicated account system. You can
              clear this data through your browser settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Analytics (PostHog)
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              We use{" "}
              <a
                href="https://posthog.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                PostHog
              </a>{" "}
              as a product analytics provider to understand how Void Tactics is used
              and to improve the alpha. PostHog may receive technical data from your
              browser (for example device or browser type, and network metadata) as
              described in their policy. We may send event data such as navigation,
              tutorial progress, lobby and purchase flows, and high-level in-app
              actions (for example when a move is submitted on the game grid, with
              non-sensitive fields like ship id, move type, and optional target).
              When you connect a wallet, we may associate analytics with your public
              wallet address using PostHog identify. We do not send private keys or
              seed phrases. Error and exception reports may also be sent to PostHog to
              help us fix bugs. Review{" "}
              <a
                href="https://posthog.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline decoration-cyan/50 underline-offset-4 hover:text-cyan/80"
              >
                PostHog privacy information
              </a>{" "}
              for how they process data.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Infrastructure and third parties
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              We rely on third-party providers to operate the site (for example RPC
              endpoints, wallet libraries, and hosting). Those providers may process
              technical data such as IP address, device type, and request metadata
              according to their own policies. We encourage you to review the
              privacy terms of your wallet and network providers.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Children
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              The service is not directed at children under 13 (or the minimum age
              in your jurisdiction). We do not knowingly collect personal
              information from children.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Changes
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              We may update this policy as the product evolves. The &quot;Last
              updated&quot; date at the top will change when we do. Continued use
              after changes means you accept the revised policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2
              className="text-lg font-bold uppercase tracking-wide"
              style={{
                fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
              }}
            >
              Contact
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              For privacy-related questions about Void Tactics, contact the project
              team through the official channels listed for the product (for example
              the project site or community links). We may not respond to every
              inquiry during alpha.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
