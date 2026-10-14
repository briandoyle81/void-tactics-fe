import { RankConfigSync } from "../components/RankConfigSync";

// Game route: ships here show live rank badges (see RankConfigSync).
export default function GameRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RankConfigSync />
      {children}
    </>
  );
}
