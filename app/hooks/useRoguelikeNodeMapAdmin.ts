"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RoguelikeNodeKind } from "../types/roguelike";
import { useNearSession } from "../near/session";
import { viewGame } from "../near/rpc";
import { GAS_HEAVY, ROLE } from "../near/config";
import { toBig } from "../near/codec";
import { RL_GRAPH_QUERY_ROOT } from "./useGameLens";
import { nearViewPrefix } from "../near/useNearView";
import type { RlCampaign, WinEffect } from "../near/generated/voidTactics";
import { buildWinEffects } from "../near/adapters/winEffects";

/**
 * Roguelike graph editing (NODE_EDITOR role or owner). Every call resolves
 * once its transaction has executed, then drops the cached graph.
 *
 * The contract stores a campaign's settings as one record (set_rl_campaign),
 * so each single-field setter here reads the campaign and writes it back
 * with that field changed. Editing an existing node's map/turn/score/cost is
 * not in the contract yet (no update_rl_node); updateNode throws.
 */
export function useRoguelikeNodeMapAdmin() {
  const { send } = useNearSession();
  const queryClient = useQueryClient();

  const afterEdit = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [RL_GRAPH_QUERY_ROOT] });
    void queryClient.invalidateQueries({ queryKey: nearViewPrefix("get_rl_campaign") });
    void queryClient.invalidateQueries({ queryKey: nearViewPrefix("get_rl_node") });
  }, [queryClient]);

  const createCampaign = useCallback(async () => {
    const receipt = await send({ method: "create_rl_campaign", args: {} });
    afterEdit();
    return toBig(receipt.returnValue as string);
  }, [send, afterEdit]);

  const updateCampaign = useCallback(
    async (campaignId: bigint, change: Partial<RlCampaign>) => {
      const current = await viewGame("get_rl_campaign", { campaign_id: campaignId.toString() });
      const next: RlCampaign = {
        root_node: 0,
        auto_heal_percent: 0,
        required_variant: 0,
        initial_cost_cap: 0,
        ...(current ?? {}),
        ...change,
      };
      const receipt = await send({
        method: "set_rl_campaign",
        args: {
          campaign_id: campaignId.toString(),
          root_node: String(next.root_node),
          auto_heal_percent: next.auto_heal_percent,
          required_variant: next.required_variant,
          initial_cost_cap: Number(next.initial_cost_cap),
        },
      });
      afterEdit();
      return receipt;
    },
    [send, afterEdit],
  );

  const setCampaignRoot = useCallback(
    (campaignId: bigint, nodeId: bigint) => updateCampaign(campaignId, { root_node: Number(nodeId) }),
    [updateCampaign],
  );
  const setCampaignAutoHealPercent = useCallback(
    (campaignId: bigint, percent: number) => updateCampaign(campaignId, { auto_heal_percent: percent }),
    [updateCampaign],
  );
  const setCampaignRequiredVariant = useCallback(
    (campaignId: bigint, variant: number) => updateCampaign(campaignId, { required_variant: variant }),
    [updateCampaign],
  );
  const setCampaignInitialCostCap = useCallback(
    (campaignId: bigint, costCap: bigint) => updateCampaign(campaignId, { initial_cost_cap: Number(costCap) }),
    [updateCampaign],
  );

  const createNode = useCallback(
    async (
      campaignId: bigint,
      kind: RoguelikeNodeKind,
      mapId: bigint,
      turnTime: bigint,
      maxScore: bigint,
      creatorGoesFirst: boolean,
      costCapOverride: bigint,
    ) => {
      const receipt = await send({
        method: "create_rl_node",
        args: {
          campaign_id: campaignId.toString(),
          kind: kind === RoguelikeNodeKind.Resupply ? "Resupply" : "Combat",
          map_id: mapId.toString(),
          turn_time: Number(turnTime),
          max_score: Number(maxScore),
          creator_goes_first: creatorGoesFirst,
          cost_cap_override: Number(costCapOverride),
        },
      });
      afterEdit();
      return toBig(receipt.returnValue as string);
    },
    [send, afterEdit],
  );

  /** update_rl_node: the node's own fields (children and win effects have their own setters). */
  const updateNode = useCallback(
    async (
      nodeId: bigint,
      campaignId: bigint,
      kind: RoguelikeNodeKind,
      mapId: bigint,
      turnTime: bigint,
      maxScore: bigint,
      creatorGoesFirst: boolean,
      costCapOverride: bigint,
    ) => {
      const receipt = await send({
        method: "update_rl_node",
        args: {
          node_id: nodeId.toString(),
          campaign_id: campaignId.toString(),
          kind: kind === RoguelikeNodeKind.Resupply ? "Resupply" : "Combat",
          map_id: mapId.toString(),
          turn_time: Number(turnTime),
          max_score: Number(maxScore),
          creator_goes_first: creatorGoesFirst,
          cost_cap_override: Number(costCapOverride),
        },
      });
      afterEdit();
      return receipt.hash;
    },
    [send, afterEdit],
  );

  const addChild = useCallback(
    async (parentId: bigint, childId: bigint) => {
      const receipt = await send({
        method: "add_rl_child",
        args: { parent_id: parentId.toString(), child_id: childId.toString() },
      });
      afterEdit();
      return receipt;
    },
    [send, afterEdit],
  );

  const removeChild = useCallback(
    async (parentId: bigint, childId: bigint) => {
      const receipt = await send({
        method: "remove_rl_child",
        args: { parent_id: parentId.toString(), child_id: childId.toString() },
      });
      afterEdit();
      return receipt;
    },
    [send, afterEdit],
  );

  /**
   * A node's win effects, in order: either the effects with their values,
   * or effect ids (useWinEffectAddresses), which keep each kept effect's
   * current values and give a new one the campaign default.
   */
  const setNodeWinEffects = useCallback(
    async (nodeId: bigint, effects: WinEffect[] | readonly string[]) => {
      let list: WinEffect[];
      if (effects.length > 0 && typeof effects[0] === "string") {
        const node = await viewGame("get_rl_node", { node_id: nodeId.toString() });
        list = buildWinEffects(effects as readonly string[], node?.win_effects ?? []);
      } else {
        list = effects as WinEffect[];
      }
      const receipt = await send({
        method: "set_rl_node_win_effects",
        args: { node_id: nodeId.toString(), effects: list },
        gas: GAS_HEAVY,
      });
      afterEdit();
      return receipt;
    },
    [send, afterEdit],
  );

  /** Grants or revokes NODE_EDITOR (keeps the account's other roles). Owner only. */
  const setNodeEditor = useCallback(
    async (editor: string, allowed: boolean) => {
      const roles = await viewGame("get_roles", { account_id: editor });
      const next = allowed ? roles | ROLE.NODE_EDITOR : roles & ~ROLE.NODE_EDITOR;
      return send({ method: "set_role", args: { account_id: editor, role_bits: next } });
    },
    [send],
  );

  /** Repair cost per missing HP, in UTC (18 decimals). */
  const setRepairCostPerHP = useCallback(
    (cost: bigint) => send({ method: "set_repair_cost_per_hp", args: { cost: cost.toString() } }),
    [send],
  );

  /** Resupply fees are UTC the contract collected; withdraws the given amount (all, when omitted, isn't known on NEAR). */
  const withdrawResupplyFees = useCallback(
    (to: string, amount?: bigint) =>
      send({ method: "withdraw_utc", args: { amount: (amount ?? BigInt(0)).toString(), to } }),
    [send],
  );

  return {
    createCampaign,
    setCampaignRoot,
    setCampaignAutoHealPercent,
    setCampaignRequiredVariant,
    setCampaignInitialCostCap,
    createNode,
    updateNode,
    addChild,
    removeChild,
    setNodeWinEffects,
    setNodeEditor,
    setRepairCostPerHP,
    withdrawResupplyFees,
  };
}
