"use client";

import React, { useMemo } from "react";
import { renderShip } from "../../utils/shipRenderer";
import { shipGrantToVisual, type ShipGrantSpec } from "../../utils/shipGrant";
import { rewardShipsAdminHref } from "../../config/routes";

// The node editor's view of a node's reward ship: what a win mints, or that
// none is set, with a link to edit it in Ops Console › Reward Ships. Shared
// by RoguelikeNodeEditPanel and RoguelikeNodeEditPanelWeb2.

export function NodeRewardShipSummary({
  nodeId,
  grant,
  hasGrantEffect,
}: {
  nodeId: number;
  grant: ShipGrantSpec | undefined;
  /** The node's saved win effects include Grant Ship. */
  hasGrantEffect: boolean;
}) {
  const imageUrl = useMemo(() => {
    if (!grant) return null;
    try {
      return renderShip(shipGrantToVisual(grant));
    } catch {
      return null;
    }
  }, [grant]);

  return (
    <div className="flex items-center gap-3 border border-gunmetal p-2">
      <div className="h-12 w-12 shrink-0 overflow-hidden border border-gunmetal bg-near-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {imageUrl && <img src={imageUrl} alt="" className="h-full w-full object-contain" />}
      </div>
      <div className="min-w-0 flex-1 text-xs">
        <div className="text-text-secondary">Reward ship</div>
        <div className={`truncate ${grant ? "text-text-primary" : "text-text-muted"}`}>
          {grant ? grant.name : "None set"}
        </div>
        {hasGrantEffect && !grant && (
          <div className="text-warning-red">Grant Ship is on but no ship is set, so wins mint nothing.</div>
        )}
        {!hasGrantEffect && grant && (
          <div className="text-amber">Grant Ship is off, so wins don&apos;t mint this ship.</div>
        )}
      </div>
      <a
        href={rewardShipsAdminHref(nodeId)}
        className="shrink-0 border border-cyan px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan hover:bg-cyan/10"
      >
        [EDIT]
      </a>
    </div>
  );
}
