"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChainAccount } from "../near/useChainAccount";
import { useNearSession } from "../near/session";
import { viewGame } from "../near/rpc";
import { GAS_HEAVY } from "../near/config";
import { ADMIN_DATA_STALE_MS } from "../config/queryTiming";
import type { NodeRewardShip, ShipGrantSpec } from "../utils/shipGrant";
import { REWARD_SHIP_SNAPSHOT, SNAPSHOT_REWARD_SHIPS } from "../config/rewardShips";
import { isSnapshotForContract } from "../utils/rewardShipSnapshot";
import { RL_GRAPH_QUERY_ROOT } from "./useGameLens";
import { useIsRoguelikeNodeEditor } from "./useRoguelikeNodeMap";
import { useMaxVariant } from "./useShipAttributesContract";
import { useNearView } from "../near/useNearView";
import {
  WIN_EFFECT_IDS,
  fromShipGrantSpec,
  shipGrantOf,
  toShipGrantSpec,
} from "../near/adapters/winEffects";
import type { WinEffect } from "../near/generated/voidTactics";

// A roguelike node's reward ship is its ShipGrant win effect
// (app/near/adapters/winEffects.ts): the grant only exists while the node
// runs the effect. The contract's ShipGrant converts to the shared
// number-native ShipGrantSpec here and nowhere else.

/** The id the reward ship snapshot and admin screens use for the grant effect. */
export const SHIP_GRANT_ADDRESS = WIN_EFFECT_IDS.SHIP_GRANT_WIN_EFFECT;

/** The reward ship configured for each node, keyed by node id; nodes without one are absent. */
export function useShipGrants(nodeIds: readonly number[], enabled = true) {
  const key = nodeIds.join(",");
  const result = useQuery({
    queryKey: [RL_GRAPH_QUERY_ROOT, "grants", key],
    queryFn: async () => {
      const nodes = await Promise.all(nodeIds.map((id) => viewGame("get_rl_node", { node_id: String(id) })));
      const map = new Map<number, ShipGrantSpec>();
      nodes.forEach((n, i) => {
        const grant = shipGrantOf(n?.win_effects);
        if (grant) map.set(nodeIds[i], toShipGrantSpec(grant));
      });
      return map;
    },
    enabled: enabled && nodeIds.length > 0,
    staleTime: ADMIN_DATA_STALE_MS,
  });
  const grantsByNodeId = useMemo(() => result.data ?? new Map<number, ShipGrantSpec>(), [result.data]);
  return { grantsByNodeId, isLoading: result.isLoading, refetch: result.refetch };
}

/** Whether the app's reward ship snapshot was read from this deploy's contract. */
export const SNAPSHOT_IS_CURRENT = isSnapshotForContract(REWARD_SHIP_SNAPSHOT, SHIP_GRANT_ADDRESS);

/**
 * A node's reward ship as players see it: from the app's snapshot
 * (app/data/content/rewardShips.json, no RPC) when it's from this deploy,
 * otherwise read from the node.
 */
export function useNodeGrant(nodeId: number | undefined): ShipGrantSpec | undefined {
  const ids = useMemo(() => (nodeId != null && !SNAPSHOT_IS_CURRENT ? [nodeId] : []), [nodeId]);
  const { grantsByNodeId } = useShipGrants(ids, ids.length > 0);
  if (nodeId == null) return undefined;
  return SNAPSHOT_IS_CURRENT ? SNAPSHOT_REWARD_SHIPS.get(nodeId) : grantsByNodeId.get(nodeId);
}

/** is_rl_grant_claimed for the signed-in player: whether a once-per-player grant was paid out. */
function useHasClaimed(nodeId: number | undefined, enabled: boolean, staleTime = 30_000) {
  const { address } = useChainAccount();
  const args = useMemo(
    () => (nodeId != null && address && enabled ? { node_id: String(nodeId), account_id: address } : null),
    [nodeId, address, enabled],
  );
  return useNearView("is_rl_grant_claimed", args, { staleTime });
}

/** One node's reward ship for the signed-in player, with whether a once-only grant was already claimed. */
export function useNodeRewardShip(nodeId: number | undefined): NodeRewardShip | null {
  const grant = useNodeGrant(nodeId);
  const { data: claimed } = useHasClaimed(nodeId, !!grant?.oncePerAddress);
  return useMemo(() => (grant ? { grant, claimed: claimed === true } : null), [grant, claimed]);
}

/**
 * Whether the player had already claimed a once-only reward ship before this
 * game ended: read while the game is still live (`gameLive`) and then kept,
 * so the result screen can tell whether the win minted one. undefined when
 * the game was already over when it loaded.
 */
export function useRewardClaimedBeforeWin(nodeId: number | undefined, gameLive: boolean): boolean | undefined {
  const grant = useNodeGrant(nodeId);
  const { data } = useHasClaimed(nodeId, gameLive && !!grant?.oncePerAddress, Infinity);
  // Keep the first answer read during the game: the same query reads true
  // once the win's grant lands, which mustn't hide the reward.
  const [beforeWin, setBeforeWin] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (gameLive && beforeWin === undefined && typeof data === "boolean") setBeforeWin(data);
  }, [gameLive, beforeWin, data]);
  return grant && !grant.oncePerAddress ? false : beforeWin;
}

/** The highest variant a grant may use (get_settings.max_variant). */
export function useShipsMaxVariant() {
  return useMaxVariant().data;
}

/** Whether the signed-in player may set grants (owner or NODE_EDITOR). */
export function useIsShipGrantOwner() {
  const { address } = useChainAccount();
  const { data, isLoading } = useIsRoguelikeNodeEditor(address);
  return { isOwner: data === true, isLoading };
}

/** Grant writes: set a node's ship (adds the effect when missing), clear it, reset a player's claim. */
export function useShipGrantAdmin() {
  const { send } = useNearSession();
  const queryClient = useQueryClient();

  const writeEffects = useCallback(
    async (nodeId: number, change: (current: WinEffect[]) => WinEffect[]) => {
      const node = await viewGame("get_rl_node", { node_id: String(nodeId) });
      if (!node) throw new Error(`No roguelike node ${nodeId}`);
      const receipt = await send({
        method: "set_rl_node_win_effects",
        args: { node_id: String(nodeId), effects: change(node.win_effects) },
        gas: GAS_HEAVY,
      });
      void queryClient.invalidateQueries({ queryKey: [RL_GRAPH_QUERY_ROOT] });
      return receipt.hash;
    },
    [send, queryClient],
  );

  const setGrant = useCallback(
    (nodeId: number, spec: ShipGrantSpec) =>
      writeEffects(nodeId, (current) => {
        const grant: WinEffect = { ShipGrant: fromShipGrantSpec(spec) };
        const i = current.findIndex((e) => "ShipGrant" in e);
        return i < 0 ? [...current, grant] : current.map((e, j) => (j === i ? grant : e));
      }),
    [writeEffects],
  );
  const clearGrant = useCallback(
    (nodeId: number) => writeEffects(nodeId, (current) => current.filter((e) => !("ShipGrant" in e))),
    [writeEffects],
  );
  const resetClaim = useCallback(
    async (nodeId: number, player: string) => {
      const receipt = await send({
        method: "reset_rl_grant_claim",
        args: { node_id: String(nodeId), account_id: player },
      });
      return receipt.hash;
    },
    [send],
  );
  return { setGrant, clearGrant, resetClaim };
}
