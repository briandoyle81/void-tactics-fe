"use client";

import React from "react";
import { getMainWeaponName, getSpecialName } from "../../types/types";
import type { ShipGrantColors } from "../../utils/shipGrant";

// The ship spec editor's sections: equipment, traits, colors and ship data.
// Shared by ShipConstructor (web3), ShipConstructorWeb2 and the reward ship
// form (ShipGrantForm), which own the state and pass what's locked. Number
// ids and values only.

export interface ShipSpecControlsValue {
  name: string;
  mainWeapon: number;
  armor: number;
  shields: number;
  special: number;
  accuracy: number;
  hull: number;
  speed: number;
  variant: number;
  /** Only the sets listed in `colorSets` are read. */
  colors: Partial<ShipGrantColors>;
  shiny: boolean;
}

type ColorSet = 1 | 2 | 3;

const SECTION_CLASS = "border border-gunmetal bg-steel p-3 md:p-4";
const SELECT_CLASS =
  "w-full px-3 py-2 bg-near-black border text-cyan focus:outline-none focus:ring-2 focus:ring-cyan";
const FIELD_STYLE = { borderRadius: 0, borderColor: "var(--color-cyan)" } as const;
const RADIO_CLASS = "w-4 h-4 text-cyan bg-black/60 border-cyan focus:ring-cyan focus:ring-2";
const LOCKED = "opacity-50 cursor-not-allowed";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={SECTION_CLASS} style={{ borderRadius: 0 }}>
      <h3 className="text-lg font-bold text-cyan mb-4 font-mono">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Range({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm text-cyan mb-2">
        {label}: {value}
      </label>
      <input
        type="range"
        min="0"
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${disabled ? LOCKED : ""}`}
      />
    </div>
  );
}

export function ShipSpecControls({
  value,
  onChange,
  specials,
  traitMax = 2,
  variantMax,
  variantLocked = false,
  variantNote,
  colorsLocked = false,
  colorsTitle = "COLORS (Primary)",
  colorSets = [1],
  showName = true,
  nameLocked = false,
  shipDataExtra,
}: {
  value: ShipSpecControlsValue;
  onChange: (patch: Partial<ShipSpecControlsValue>) => void;
  /** Specials this variant can use; the current one is kept in the list even if it isn't. */
  specials: readonly number[];
  traitMax?: number;
  variantMax?: number;
  variantLocked?: boolean;
  /** Shown under a locked variant. */
  variantNote?: string;
  colorsLocked?: boolean;
  colorsTitle?: string;
  colorSets?: readonly ColorSet[];
  showName?: boolean;
  nameLocked?: boolean;
  /** More fields at the end of the Ship Data section. */
  shipDataExtra?: React.ReactNode;
}) {
  const { mainWeapon, armor, shields, special, variant } = value;
  const defenseRadioName = React.useId();
  const setColor = (key: keyof ShipGrantColors, v: number) => onChange({ colors: { ...value.colors, [key]: v } });
  const specialOptions = specials.includes(special) ? specials : [...specials, special];

  return (
    <>
      <Section title="EQUIPMENT">
        <div>
          <label className="block text-sm text-cyan mb-2">Main Weapon</label>
          <select
            value={mainWeapon}
            onChange={(e) => onChange({ mainWeapon: Number(e.target.value) })}
            className={SELECT_CLASS}
            style={FIELD_STYLE}
          >
            {[0, 1, 2, 3].map((v) => (
              <option key={v} value={v}>
                {getMainWeaponName(v, variant)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-cyan mb-2">Defense Type</label>
          <div className="mb-3 flex flex-wrap gap-3 sm:gap-4">
            <label className="flex items-center gap-2 text-sm text-cyan cursor-pointer">
              <input
                type="radio"
                name={defenseRadioName}
                checked={armor === 0 && shields === 0}
                onChange={() => onChange({ armor: 0, shields: 0 })}
                className={RADIO_CLASS}
              />
              <span>None</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-cyan cursor-pointer">
              <input
                type="radio"
                name={defenseRadioName}
                checked={armor > 0 && shields === 0}
                onChange={() => onChange({ armor: armor === 0 ? 1 : armor, shields: 0 })}
                className={RADIO_CLASS}
              />
              <span>Armor</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-cyan cursor-pointer">
              <input
                type="radio"
                name={defenseRadioName}
                checked={shields > 0 && armor === 0}
                onChange={() => onChange({ shields: shields === 0 ? 1 : shields, armor: 0 })}
                className={RADIO_CLASS}
              />
              <span>Shields</span>
            </label>
          </div>
          {armor > 0 && (
            <div>
              <label className="block text-xs text-cyan mb-1">Armor Level</label>
              <select
                value={armor}
                onChange={(e) => onChange({ armor: Number(e.target.value), shields: 0 })}
                className={SELECT_CLASS}
                style={FIELD_STYLE}
              >
                <option value={1}>Light</option>
                <option value={2}>Medium</option>
                <option value={3}>Heavy</option>
              </select>
            </div>
          )}
          {shields > 0 && (
            <div>
              <label className="block text-xs text-cyan mb-1">Shield Level</label>
              <select
                value={shields}
                onChange={(e) => onChange({ shields: Number(e.target.value), armor: 0 })}
                className={SELECT_CLASS}
                style={FIELD_STYLE}
              >
                <option value={1}>Basic</option>
                <option value={2}>Enhanced</option>
                <option value={3}>Advanced</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm text-cyan mb-2">Special</label>
          <select
            value={special}
            onChange={(e) => onChange({ special: Number(e.target.value) })}
            className={SELECT_CLASS}
            style={FIELD_STYLE}
          >
            {specialOptions.map((v) => (
              <option key={v} value={v}>
                {getSpecialName(v, variant)}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="TRAITS">
        <Range label="Accuracy" value={value.accuracy} max={traitMax} onChange={(v) => onChange({ accuracy: v })} />
        <Range label="Hull" value={value.hull} max={traitMax} onChange={(v) => onChange({ hull: v })} />
        <Range label="Speed" value={value.speed} max={traitMax} onChange={(v) => onChange({ speed: v })} />
        <div>
          <label className="block text-sm text-cyan mb-2">Variant: {variant}</label>
          <input
            type="number"
            min="0"
            max={variantMax}
            value={variant}
            onChange={(e) => onChange({ variant: Number(e.target.value) })}
            disabled={variantLocked}
            className={`${SELECT_CLASS} ${variantLocked ? LOCKED : ""}`}
            style={FIELD_STYLE}
          />
          {variantNote && <p className="mt-1 text-[10px] text-text-muted">{variantNote}</p>}
        </div>
      </Section>

      <Section title={colorsTitle}>
        {colorSets.map((n) => (
          <React.Fragment key={n}>
            {colorSets.length > 1 && (
              <div className="pt-1 text-xs font-bold uppercase tracking-wider text-text-secondary">Color {n}</div>
            )}
            <Range
              label={`Hue ${n}`}
              value={value.colors[`h${n}`] ?? 0}
              max={360}
              disabled={colorsLocked}
              onChange={(v) => setColor(`h${n}`, v)}
            />
            <Range
              label={`Saturation ${n}`}
              value={value.colors[`s${n}`] ?? 0}
              max={100}
              disabled={colorsLocked}
              onChange={(v) => setColor(`s${n}`, v)}
            />
            <Range
              label={`Lightness ${n}`}
              value={value.colors[`l${n}`] ?? 0}
              max={100}
              disabled={colorsLocked}
              onChange={(v) => setColor(`l${n}`, v)}
            />
          </React.Fragment>
        ))}
      </Section>

      <Section title="SHIP DATA">
        {showName && (
          <div>
            <label className="block text-sm text-cyan mb-2">Ship Name</label>
            <input
              type="text"
              value={value.name}
              onChange={(e) => onChange({ name: e.target.value })}
              disabled={nameLocked}
              className={`${SELECT_CLASS} font-mono ${nameLocked ? LOCKED : ""}`}
              style={FIELD_STYLE}
              placeholder="Enter ship name"
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-cyan cursor-pointer">
          <input
            type="checkbox"
            checked={value.shiny}
            onChange={(e) => onChange({ shiny: e.target.checked })}
            className={RADIO_CLASS}
            style={{ borderRadius: 0 }}
          />
          <span>Shiny</span>
        </label>
        {shipDataExtra}
      </Section>
    </>
  );
}
