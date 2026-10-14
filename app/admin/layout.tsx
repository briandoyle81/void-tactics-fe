import type { Metadata } from "next";
import { RankConfigSync } from "../components/RankConfigSync";

export const metadata: Metadata = {
  title: "Ops Console",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RankConfigSync />
      {children}
    </>
  );
}
