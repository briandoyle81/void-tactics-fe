import SpectatorGamePage from "./spectator-game-page";

interface GamePageProps {
  params:
    | {
        gameId?: string;
      }
    | Promise<{
    gameId?: string;
      }>;
}

export default async function GamePage({ params }: GamePageProps) {
  const resolvedParams = await params;
  const gameIdRaw = resolvedParams?.gameId ?? "";
  const parsedGameId = Number(gameIdRaw);
  const gameId =
    /^\d+$/.test(gameIdRaw) &&
    Number.isSafeInteger(parsedGameId) &&
    parsedGameId > 0
      ? parsedGameId
      : null;

  // Always render this route so users always get header + chain options.
  return <SpectatorGamePage gameId={gameId} requestedPathId={gameIdRaw} />;
}

