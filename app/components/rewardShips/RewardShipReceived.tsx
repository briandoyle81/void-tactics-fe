"use client";

import React, { useMemo } from "react";
import { SHIP_GRANT_ADDRESS, useNodeGrant } from "../../hooks/useShipGrants";
import { useRoguelikeNodeWinEffects } from "../../hooks/useWinEffects";
import { useNodeRewardShipWeb2, useRewardShipAwardWeb2 } from "../../hooks/useShipGrantsWeb2";
import { getFactionName } from "../../config/factions";
import { calculateShipRank } from "../../utils/shipLevel";
import { shipGrantToVisual } from "../../utils/shipGrant";
import { shipGrantToPreviewShip } from "../../utils/previewShips";
import { ShipImage } from "../ShipImage";
import { ShipImageWeb2 } from "../ShipImageWeb2";
import type { ShipVisual } from "../../types/shipVisual";

// The won roguelike mission's reward ship on the result screen: minted
// already constructed (docs/frontend-handoff-2026-10-19.md §2-3), so it's
// just shown, no construct step. Web3 shows the node's ship from the app's
// reward ship snapshot, web2 the game's award row; both render
// RewardShipReceivedView.

export function RewardShipReceivedView({
  name,
  image,
  visual,
}: {
  name: string;
  image: React.ReactNode;
  visual: ShipVisual;
}) {
  const { rank } = calculateShipRank(visual);
  return (
    <div className="flex items-center gap-3 border border-phosphor-green/50 bg-phosphor-green/5 p-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden bg-black/40">{image}</div>
      <div className="min-w-0 font-mono">
        <div className="text-[11px] font-bold uppercase tracking-wider text-phosphor-green">Reward ship received</div>
        <div className="truncate text-sm font-bold text-text-primary">{name}</div>
        <div className="text-[11px] text-text-secondary">
          {getFactionName(visual.traits.variant)} · Rank {rank} · added to your fleet
        </div>
      </div>
    </div>
  );
}

/**
 * Web3: the ship this player's win at `nodeId` minted, from the app's reward
 * ship snapshot (no log search), when the node runs Grant Ship. A
 * once-only ship shows only if it wasn't claimed before this win
 * (`claimedBeforeWin`, read during the game); if the game was already over
 * when it loaded, that's unknown and it doesn't show.
 */
export function RewardShipReceived({
  nodeId,
  claimedBeforeWin,
}: {
  nodeId: number;
  claimedBeforeWin: boolean | undefined;
}) {
  const grant = useNodeGrant(nodeId);
  const ship = useMemo(() => (grant ? shipGrantToPreviewShip(grant) : null), [grant]);
  // A grant only mints when the node's win effects include Grant Ship.
  const { data: effects } = useRoguelikeNodeWinEffects(grant ? BigInt(nodeId) : undefined);
  const runsGrantShip = !!effects?.some((a) => a.toLowerCase() === SHIP_GRANT_ADDRESS.toLowerCase());
  if (!grant || !ship || !runsGrantShip) return null;
  if (grant.oncePerAddress && claimedBeforeWin !== false) return null;
  return (
    <RewardShipReceivedView
      name={grant.name}
      visual={shipGrantToVisual(grant)}
      image={<ShipImage ship={ship} className="h-full w-full" showLoadingState={false} hideRankStars />}
    />
  );
}

/** Web2: the ship this player's win in `lobbyId` (at `nodeId`) minted, if any. */
export function RewardShipReceivedWeb2({ lobbyId, nodeId }: { lobbyId: number; nodeId: number }) {
  // Only ask when the node has a reward ship at all.
  const reward = useNodeRewardShipWeb2(nodeId > 0 ? nodeId : undefined);
  const ship = useRewardShipAwardWeb2(lobbyId, reward != null);
  if (!ship) return null;
  return (
    <RewardShipReceivedView
      name={ship.name}
      visual={ship}
      image={<ShipImageWeb2 ship={ship} className="h-full w-full" showLoadingState={false} hideRankStars />}
    />
  );
}
