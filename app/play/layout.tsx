import type { Metadata } from "next";
import { RankConfigSync } from "../components/RankConfigSync";

export const metadata: Metadata = {
  title: "Play",
  // The game client isn't a landing page; the website at / is what gets indexed.
  robots: { index: false, follow: false },
};

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RankConfigSync />
      {children}
    </>
  );
}
