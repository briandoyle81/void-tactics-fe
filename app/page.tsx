import type { Metadata } from "next";
import Website from "./components/Website";
import { DISCORD_URL, X_URL } from "./config/socialLinks";

// The website. The game client is at /play (app/(client)/play/GameClient.tsx); see
// app/config/routes.ts for how the two are split across hosts.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://voidtactics.xyz";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Structured data for search results: the site, and the game itself.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Void Tactics",
      url: SITE_URL,
    },
    {
      "@type": "VideoGame",
      name: "Void Tactics",
      url: SITE_URL,
      image: `${SITE_URL}/img/og-image.jpg`,
      description:
        "A fully onchain, turn-based space tactics game. Lead your fleet through a branching campaign against the Hive, then face other admirals in PvP.",
      genre: ["Turn-based tactics", "Strategy", "Roguelike"],
      gamePlatform: "Web browser",
      playMode: ["SinglePlayer", "MultiPlayer"],
      applicationCategory: "Game",
      operatingSystem: "Any",
      sameAs: [DISCORD_URL, X_URL],
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <Website />
    </>
  );
}
