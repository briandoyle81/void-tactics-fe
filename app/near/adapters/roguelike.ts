/** NEAR roguelike JSON -> the app's roguelike types. */
import { RoguelikeNodeKind, RunStatus, type RoguelikeNode, type RoguelikeRun } from "../../types/roguelike";
import type { RlNode, Run } from "../generated/voidTactics";
import { toBig } from "../codec";
import { viewGame } from "../rpc";
import { fetchAllPages } from "../useNearView";

const RUN_STATUS: Record<string, RunStatus> = {
  None: RunStatus.None,
  Active: RunStatus.Active,
  Won: RunStatus.Won,
  Ended: RunStatus.Ended,
};

/** Roster entries are [ship id, persisted HP] (HP 0 = not yet damaged, i.e. full). */
function rosterEntries(run: Run): Array<[number, number]> {
  return (run.roster as unknown as Array<[number, number]>) ?? [];
}

export function toRoguelikeRun(run: Run): RoguelikeRun {
  return {
    status: RUN_STATUS[run.status] ?? RunStatus.None,
    generation: toBig(run.generation),
    campaignId: toBig(run.campaign_id),
    currentNodeId: toBig(run.current_node),
    currentCostCap: toBig(run.current_cost_cap),
    reservationFleetId: BigInt(0),
    rosterShipIds: rosterEntries(run).map(([id]) => toBig(id)),
    activeGameId: toBig(run.active_game_id),
    requiredVariantAtStart: run.required_variant_at_start,
  };
}

/** Roster ship id (string) -> persisted HP. */
export function rosterHp(run: Run): Map<string, number> {
  return new Map(rosterEntries(run).map(([id, hp]) => [String(id), hp]));
}

export function toRoguelikeNode(id: bigint, n: RlNode): RoguelikeNode {
  return {
    id,
    campaignId: toBig(n.campaign_id),
    kind: n.kind === "Resupply" ? RoguelikeNodeKind.Resupply : RoguelikeNodeKind.Combat,
    mapId: toBig(n.map_id),
    turnTime: toBig(n.turn_time),
    maxScore: toBig(n.max_score),
    creatorGoesFirst: n.creator_goes_first,
    costCapOverride: toBig(n.cost_cap_override),
    children: n.children.map((c) => toBig(c)),
    exists: true,
  };
}

/** Every node reachable from the campaign's root (breadth-first), with its raw record. */
export async function fetchCampaignGraph(campaignId: bigint): Promise<Array<{ node: RoguelikeNode; raw: RlNode }>> {
  const campaign = await viewGame("get_rl_campaign", { campaign_id: campaignId.toString() });
  if (!campaign) return [];
  const out: Array<{ node: RoguelikeNode; raw: RlNode }> = [];
  const seen = new Set<string>();
  let frontier = [String(campaign.root_node)].filter((id) => id !== "0");
  while (frontier.length > 0) {
    const batch = frontier.filter((id) => !seen.has(id));
    batch.forEach((id) => seen.add(id));
    const nodes = await Promise.all(batch.map((id) => viewGame("get_rl_node", { node_id: id })));
    const next: string[] = [];
    nodes.forEach((raw, i) => {
      if (!raw) return;
      out.push({ node: toRoguelikeNode(BigInt(batch[i]), raw), raw });
      for (const c of raw.children) if (!seen.has(String(c))) next.push(String(c));
    });
    frontier = next;
  }
  return out;
}

/**
 * Every roguelike node, linked into a graph or not (get_rl_nodes, paged).
 * The map editor and admin lists need all of them.
 */
export async function fetchAllRoguelikeNodes(): Promise<Array<{ node: RoguelikeNode; raw: RlNode }>> {
  const pairs = await fetchAllPages(
    (from, limit) => viewGame("get_rl_nodes", { from_index: from, limit }),
    100,
  );
  return pairs.map(([id, raw]) => ({ node: toRoguelikeNode(BigInt(id), raw), raw }));
}
