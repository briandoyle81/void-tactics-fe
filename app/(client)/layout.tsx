import type { Metadata } from "next";
import { Providers } from "../providers";
import { RankConfigSync } from "../components/RankConfigSync";
import { AudioSettingsProvider } from "../components/AudioControl";

// The game client's routes (/play, /admin, a game, tournaments): one layout,
// so the wallet providers (app/providers.tsx) stay mounted moving between
// them. The website doesn't load them. Ships here show live rank badges (see
// RankConfigSync), and its audio settings and music live here
// (AudioSettingsProvider) so music plays on across screens. A route group:
// "(client)" isn't part of any URL.
// None of the game client is a landing page; the website is what gets indexed.
export const metadata: Metadata = {
  // A layout's own title resets the root's template for its pages, so it's restated.
  title: { default: "Play", template: "%s | Void Tactics" },
  robots: { index: false, follow: false },
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AudioSettingsProvider>
        <RankConfigSync />
        {children}
      </AudioSettingsProvider>
    </Providers>
  );
}
