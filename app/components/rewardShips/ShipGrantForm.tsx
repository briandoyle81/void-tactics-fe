"use client";

import React, { useMemo } from "react";
import { renderShip } from "../../utils/shipRenderer";
import { calculateShipRank } from "../../utils/shipLevel";
import { getRankConfig } from "../../utils/rankConfigCache";
import { getFactionName } from "../../config/factions";
import { SHIP_GRANT_TRAIT_MAX, shipGrantToVisual, type ShipGrantSpec } from "../../utils/shipGrant";
import { ShipSpecControls, type ShipSpecControlsValue } from "../ship/ShipSpecControls";

// The reward ship editor: the shared ship spec sections plus the grant-only
// fields (kills for rank, free ship, once per player), with a live preview.
// Number-native; web3 and web2 both use it through RewardShipsAdminView.

const CHECKBOX_CLASS = "w-4 h-4 text-cyan bg-black/60 border-cyan focus:ring-cyan focus:ring-2";

export function ShipGrantForm({
  value,
  onChange,
  maxVariant,
  specials,
}: {
  value: ShipGrantSpec;
  onChange: (next: ShipGrantSpec) => void;
  maxVariant: number;
  /** Specials the current variant can use. */
  specials: readonly number[];
}) {
  const visual = useMemo(() => shipGrantToVisual(value), [value]);
  const imageUrl = useMemo(() => {
    try {
      return renderShip(visual);
    } catch {
      return null;
    }
  }, [visual]);
  const { rank } = calculateShipRank(visual);
  // Kill counts that reach each rank: rank 1 needs none.
  const rankKills = useMemo(() => [0, ...getRankConfig(value.variant).thresholds], [value.variant]);

  const specValue: ShipSpecControlsValue = {
    name: value.name,
    ...value.equipment,
    accuracy: value.accuracy,
    hull: value.hull,
    speed: value.speed,
    variant: value.variant,
    colors: value.colors,
    shiny: value.shiny,
  };

  const applySpecPatch = (patch: Partial<ShipSpecControlsValue>) => {
    const { mainWeapon, armor, shields, special, colors, ...rest } = patch;
    onChange({
      ...value,
      ...rest,
      equipment: {
        mainWeapon: mainWeapon ?? value.equipment.mainWeapon,
        armor: armor ?? value.equipment.armor,
        shields: shields ?? value.equipment.shields,
        special: special ?? value.equipment.special,
      },
      colors: colors ? { ...value.colors, ...colors } : value.colors,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
      <div className="space-y-4">
        <ShipSpecControls
          value={specValue}
          onChange={applySpecPatch}
          specials={specials}
          traitMax={SHIP_GRANT_TRAIT_MAX}
          variantMax={maxVariant}
          colorsTitle="COLORS"
          colorSets={[1, 2, 3]}
          shipDataExtra={
            <>
              <div>
                <label className="block text-sm text-cyan mb-2">
                  Kills: {value.shipsDestroyed} (rank {rank})
                </label>
                <input
                  type="number"
                  min={0}
                  value={value.shipsDestroyed}
                  onChange={(e) => onChange({ ...value, shipsDestroyed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  className="w-full px-3 py-2 bg-near-black border text-cyan focus:outline-none focus:ring-2 focus:ring-cyan"
                  style={{ borderRadius: 0, borderColor: "var(--color-cyan)" }}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {rankKills.map((kills, i) => (
                    <button
                      key={kills}
                      type="button"
                      onClick={() => onChange({ ...value, shipsDestroyed: kills })}
                      className={`border px-2 py-1 font-mono text-[11px] ${
                        rank === i + 1 ? "border-amber text-amber" : "border-gunmetal text-text-secondary hover:border-cyan hover:text-cyan"
                      }`}
                    >
                      R{i + 1}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-cyan cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.isFreeShip}
                  onChange={(e) => onChange({ ...value, isFreeShip: e.target.checked })}
                  className={CHECKBOX_CLASS}
                />
                <span>Free ship (can&apos;t be recycled, pays no kill UTC)</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-cyan cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.oncePerAddress}
                  onChange={(e) => onChange({ ...value, oncePerAddress: e.target.checked })}
                  className={CHECKBOX_CLASS}
                />
                <span>Once per player (otherwise every win grants another)</span>
              </label>
            </>
          }
        />
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="border border-gunmetal bg-black/40 p-3">
          <div className="aspect-square w-full overflow-hidden border border-gunmetal bg-near-black">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={value.name} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-text-muted">No preview</div>
            )}
          </div>
          <div className="mt-3 font-mono text-sm font-bold text-cyan">{value.name || "Unnamed"}</div>
          <div className="mt-1 font-mono text-xs text-text-secondary">
            {getFactionName(value.variant)} · Rank {rank}
            {value.shiny ? " · Shiny" : ""}
          </div>
          <div className="mt-1 font-mono text-xs text-text-muted">
            {value.oncePerAddress ? "Once per player" : "Every win"}
            {value.isFreeShip ? " · Free ship" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
