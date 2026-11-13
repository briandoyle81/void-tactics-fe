"use client";

import React from "react";

/**
 * A one-time title card over the placement map when a roguelike combat
 * node's fleet placement opens: says that the player is setting where their
 * ships start the battle. It fades on its own and never takes clicks, so the
 * player can start dragging ships straight away.
 */
export function DeployFleetTitleCard() {
  const [done, setDone] = React.useState(false);
  if (done) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
    >
      <div
        className="animate-deploy-title-card relative flex w-full flex-col items-center gap-2 bg-near-black/85 px-4 py-5 text-center md:gap-3 md:py-8"
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) setDone(true);
        }}
      >
        <div className="absolute inset-x-0 top-0 flex justify-center">
          <div className="animate-deploy-title-wipe h-0.5 bg-amber" />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          <div className="animate-deploy-title-wipe h-0.5 bg-amber" />
        </div>
        <span className="font-sans text-3xl font-bold leading-none tracking-[0.12em] text-amber md:text-6xl">
          DEPLOY YOUR FLEET
        </span>
        <span className="text-sm text-text-bright md:text-base">
          Place your ships where you want them when the battle starts.
        </span>
      </div>
    </div>
  );
}
