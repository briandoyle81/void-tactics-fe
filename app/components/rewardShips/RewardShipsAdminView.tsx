"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { renderShip } from "../../utils/shipRenderer";
import { setUrlParams, useUrlParam } from "../../utils/urlState";
import {
  DEFAULT_SHIP_GRANT,
  shipGrantError,
  shipGrantToVisual,
  type ShipGrantSpec,
} from "../../utils/shipGrant";
import { ShipGrantForm } from "./ShipGrantForm";

// Ops Console › Reward Ships: every roguelike combat node with its reward
// ship (ShipGrantWinEffect grants / web2's RoguelikeShipGrant rows), and an
// editor for the selected one. Shared by RewardShipsAdmin (web3: owner
// transactions) and RewardShipsAdminWeb2 (admin API); number ids. The
// selected node is the URL's `node` param.

export interface RewardShipsAdminNode {
  id: number;
  campaignId: number;
  title: string;
  /** The node's win-effect list includes Grant Ship, so a win actually mints the reward. */
  hasGrantEffect: boolean;
}

const DISPLAY_FONT = { fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" } as const;
const BUTTON = "border-2 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50";

function GrantThumb({ grant }: { grant: ShipGrantSpec }) {
  const url = useMemo(() => {
    try {
      return renderShip(shipGrantToVisual(grant));
    } catch {
      return null;
    }
  }, [grant]);
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden border border-gunmetal bg-near-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" className="h-full w-full object-contain" />}
    </div>
  );
}

export function RewardShipsAdminView({
  nodes,
  grantsByNodeId,
  isLoading,
  canEdit,
  editBlockedReason,
  maxVariant,
  specialsForVariant,
  playerLabel,
  onSave,
  onClear,
  onResetClaim,
  onAttachEffect,
  staleNodeIds,
  header,
}: {
  nodes: RewardShipsAdminNode[];
  grantsByNodeId: Map<number, ShipGrantSpec>;
  isLoading: boolean;
  canEdit: boolean;
  /** Why edits are off (wrong wallet, not an admin). */
  editBlockedReason?: string | null;
  maxVariant: number;
  specialsForVariant: (variant: number) => readonly number[];
  /** What identifies a player for Reset claim: a wallet address or an email. */
  playerLabel: string;
  /** Each resolves to the success message (rejects to show an error). */
  onSave: (nodeId: number, grant: ShipGrantSpec) => Promise<string>;
  onClear: (nodeId: number) => Promise<string>;
  onResetClaim: (nodeId: number, player: string) => Promise<string>;
  onAttachEffect: (nodeId: number) => Promise<string>;
  /** Web3: nodes whose grant differs from the app's snapshot (marked in the list). */
  staleNodeIds?: ReadonlySet<number>;
  /** Above the list and editor (web3: the snapshot panel). */
  header?: React.ReactNode;
}) {
  const urlNode = Number(useUrlParam("node"));
  const selectedId = nodes.some((n) => n.id === urlNode) ? urlNode : null;
  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const savedGrant = selectedId != null ? grantsByNodeId.get(selectedId) : undefined;

  const [draft, setDraft] = useState<ShipGrantSpec>(DEFAULT_SHIP_GRANT);
  const [busy, setBusy] = useState<"save" | "clear" | "reset" | "attach" | null>(null);
  const [player, setPlayer] = useState("");

  // Load the node's saved grant (or a default) when the selection changes or
  // its saved grant changes. Keyed by content, so a refetch returning the
  // same grant doesn't wipe an edit in progress.
  const savedKey = JSON.stringify(savedGrant ?? null);
  useEffect(() => {
    setDraft(savedGrant ?? DEFAULT_SHIP_GRANT);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- savedKey stands in for savedGrant
  }, [selectedId, savedKey]);

  const isDirty = JSON.stringify(draft) !== savedKey;
  const validationError = shipGrantError(draft, maxVariant);

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<string>) => {
    setBusy(kind);
    try {
      toast.success(await action());
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(message.includes("User rejected") || message.includes("User denied") ? "Transaction declined" : message);
    } finally {
      setBusy(null);
    }
  };

  const campaigns = useMemo(() => {
    const byCampaign = new Map<number, RewardShipsAdminNode[]>();
    nodes.forEach((n) => byCampaign.set(n.campaignId, [...(byCampaign.get(n.campaignId) ?? []), n]));
    return [...byCampaign.entries()].sort(([a], [b]) => a - b);
  }, [nodes]);

  return (
    <div className="font-mono">
      {header}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border border-gunmetal bg-black/30 p-3" aria-label="Combat nodes">
          <h2 className="mb-1 text-lg font-bold uppercase tracking-wider text-cyan" style={DISPLAY_FONT}>
            Reward Ships
          </h2>
          <p className="mb-3 text-[11px] leading-snug text-text-muted">
            A node&apos;s ship is minted, constructed, to whoever wins there. Changes apply to the next win.
          </p>
          {isLoading ? (
            <p className="text-xs text-text-muted">Loading nodes…</p>
          ) : nodes.length === 0 ? (
            <p className="text-xs text-text-muted">No combat nodes.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map(([campaignId, list]) => (
                <div key={campaignId}>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">Campaign #{campaignId}</div>
                  <ul className="space-y-1">
                    {list.map((n) => {
                      const grant = grantsByNodeId.get(n.id);
                      const active = n.id === selectedId;
                      return (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => setUrlParams({ node: String(n.id) })}
                            className={`flex w-full items-center gap-2 border px-2 py-1.5 text-left ${
                              active ? "border-cyan bg-steel" : "border-gunmetal hover:border-cyan/60"
                            }`}
                          >
                            {grant ? (
                              <GrantThumb grant={grant} />
                            ) : (
                              <div className="h-10 w-10 shrink-0 border border-dashed border-gunmetal" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs text-text-primary">
                                #{n.id} {n.title}
                              </span>
                              <span className={`block truncate text-[11px] ${grant ? "text-phosphor-green" : "text-text-muted"}`}>
                                {grant ? grant.name : "No reward"}
                                {grant && !n.hasGrantEffect && <span className="text-warning-red"> · effect off</span>}
                                {staleNodeIds?.has(n.id) && <span className="text-amber"> · not in app copy</span>}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </aside>

        <section className="min-w-0 border border-gunmetal bg-black/30 p-3 md:p-4">
          {!selected ? (
            <p className="text-sm text-text-muted">Pick a combat node to see or set its reward ship.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl font-bold uppercase tracking-wider text-cyan" style={DISPLAY_FONT}>
                  #{selected.id} {selected.title}
                </h3>
                <span className={`text-xs ${savedGrant ? "text-phosphor-green" : "text-text-muted"}`}>
                  {savedGrant ? "Reward set" : "No reward set"}
                  {isDirty ? " · unsaved changes" : ""}
                </span>
              </div>

              {editBlockedReason && (
                <p className="border border-amber/50 bg-amber/10 px-3 py-2 text-xs text-amber">{editBlockedReason}</p>
              )}

              {!selected.hasGrantEffect && (
                <div className="flex flex-wrap items-center justify-between gap-2 border border-warning-red/60 bg-warning-red/10 px-3 py-2">
                  <span className="text-xs text-warning-red">
                    This node&apos;s win effects don&apos;t include Grant Ship, so a win won&apos;t mint this reward.
                  </span>
                  <button
                    type="button"
                    disabled={!canEdit || busy != null}
                    onClick={() => void run("attach", () => onAttachEffect(selected.id))}
                    className={`${BUTTON} border-warning-red text-warning-red hover:bg-warning-red/10`}
                  >
                    {busy === "attach" ? "[ADDING...]" : "[ADD GRANT SHIP EFFECT]"}
                  </button>
                </div>
              )}

              <fieldset disabled={!canEdit} className={canEdit ? "" : "opacity-70"}>
                <ShipGrantForm
                  value={draft}
                  onChange={setDraft}
                  maxVariant={maxVariant}
                  specials={specialsForVariant(draft.variant)}
                />
              </fieldset>

              {validationError && <p className="text-xs text-warning-red">{validationError}</p>}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canEdit || busy != null || !isDirty || validationError != null}
                  onClick={() => void run("save", () => onSave(selected.id, draft))}
                  className={`${BUTTON} border-phosphor-green text-phosphor-green hover:bg-phosphor-green/10`}
                >
                  {busy === "save" ? "[SAVING...]" : "[SAVE REWARD]"}
                </button>
                <button
                  type="button"
                  disabled={!isDirty || busy != null}
                  onClick={() => setDraft(savedGrant ?? DEFAULT_SHIP_GRANT)}
                  className={`${BUTTON} border-steel text-text-secondary hover:border-text-secondary`}
                >
                  [RESET]
                </button>
                <button
                  type="button"
                  disabled={!canEdit || busy != null || !savedGrant}
                  onClick={() => void run("clear", () => onClear(selected.id))}
                  className={`${BUTTON} border-warning-red text-warning-red hover:bg-warning-red/10`}
                >
                  {busy === "clear" ? "[CLEARING...]" : "[CLEAR REWARD]"}
                </button>
              </div>

              {savedGrant?.oncePerAddress && (
                <div className="space-y-2 border border-gunmetal p-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-text-secondary">Reset claim</div>
                  <p className="text-[11px] text-text-muted">
                    Lets one player receive this node&apos;s once-only ship again.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={player}
                      onChange={(e) => setPlayer(e.target.value)}
                      placeholder={playerLabel}
                      aria-label={playerLabel}
                      className="min-w-0 flex-1 border border-gunmetal bg-near-black px-3 py-2 text-xs text-cyan"
                    />
                    <button
                      type="button"
                      disabled={!canEdit || busy != null || !player.trim()}
                      onClick={() =>
                        void run("reset", async () => {
                          const message = await onResetClaim(selected.id, player.trim());
                          setPlayer("");
                          return message;
                        })
                      }
                      className={`${BUTTON} border-amber text-amber hover:bg-amber/10`}
                    >
                      {busy === "reset" ? "[RESETTING...]" : "[RESET CLAIM]"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
