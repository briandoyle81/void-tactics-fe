import { prisma } from "./prisma";
import { calcShipCost } from "./shipGen";
import { getCurrentCosts } from "./getCurrentCosts";
import { MAX_FACTION_VARIANT } from "../config/factions";
import { parseShipGrant, shipGrantError, type ShipGrantSpec } from "../utils/shipGrant";
import type { Web2ShipEquipment, Web2ShipTraits } from "../types/web2Ship";

// Web2 counterpart to ShipGrantWinEffect (docs/frontend-handoff-2026-10-19.md
// §2): a reward ship per roguelike node (RoguelikeShipGrant), minted
// constructed on a win (RoguelikeShipGrantAward), with the same rules:
// setGrant's validation, once-per-player claims that a reset clears, and a
// repeat win on a once-only grant minting nothing without an error.

/** Every stored grant (or those for `nodeIds`), keyed by node id. Unreadable rows are skipped. */
export async function getShipGrants(nodeIds?: readonly number[]): Promise<Map<number, ShipGrantSpec>> {
  const rows = await prisma.roguelikeShipGrant.findMany({
    where: nodeIds ? { nodeId: { in: [...nodeIds] } } : undefined,
  });
  const map = new Map<number, ShipGrantSpec>();
  rows.forEach((row) => {
    const grant = parseShipGrant(row.grant);
    if (grant) map.set(row.nodeId, grant);
  });
  return map;
}

/** The validation error for an untrusted grant body, or the parsed grant. */
export function validateShipGrant(value: unknown): { grant: ShipGrantSpec; error: null } | { grant: null; error: string } {
  const grant = parseShipGrant(value);
  if (!grant) return { grant: null, error: "Invalid grant" };
  const error = shipGrantError(grant, MAX_FACTION_VARIANT);
  return error ? { grant: null, error } : { grant: { ...grant, name: grant.name.trim() }, error: null };
}

export async function setShipGrant(nodeId: number, grant: ShipGrantSpec): Promise<void> {
  await prisma.roguelikeShipGrant.upsert({
    where: { nodeId },
    update: { grant: grant as object },
    create: { nodeId, grant: grant as object },
  });
}

export async function clearShipGrant(nodeId: number): Promise<void> {
  await prisma.roguelikeShipGrant.deleteMany({ where: { nodeId } });
}

/** resetClaim: the player can receive this node's once-only ship again. */
export async function resetShipGrantClaim(nodeId: number, userId: string): Promise<number> {
  const { count } = await prisma.roguelikeShipGrantAward.updateMany({
    where: { nodeId, userId, countsAsClaim: true },
    data: { countsAsClaim: false },
  });
  return count;
}

/** The nodes among `nodeIds` whose once-only ship this player already received. */
export async function claimedNodeIds(userId: string, nodeIds: readonly number[]): Promise<Set<number>> {
  if (nodeIds.length === 0) return new Set();
  const rows = await prisma.roguelikeShipGrantAward.findMany({
    where: { userId, nodeId: { in: [...nodeIds] }, countsAsClaim: true },
    select: { nodeId: true },
  });
  return new Set(rows.map((r) => r.nodeId));
}

/**
 * Mints the node's reward ship to the winner, constructed, and records the
 * award. Returns the new ship id, or null when nothing mints: no grant
 * configured (on-chain that's a WinEffectFailed; the win still counts) or a
 * once-only grant this player already claimed.
 */
export async function grantRewardShip(nodeId: number, winnerId: string, lobbyId: number): Promise<number | null> {
  const grant = (await getShipGrants([nodeId])).get(nodeId);
  if (!grant) {
    console.warn(`Roguelike node ${nodeId} has Grant Ship but no reward ship configured`);
    return null;
  }

  const equipment: Web2ShipEquipment = { ...grant.equipment };
  const { h1, s1, l1, h2, s2, l2 } = grant.colors;
  const traits: Web2ShipTraits = {
    serialNumber: Date.now(),
    colors: { h1, s1, l1, h2, s2, l2 },
    variant: grant.variant,
    accuracy: grant.accuracy,
    hull: grant.hull,
    speed: grant.speed,
  };
  const costs = await getCurrentCosts(grant.variant);

  return prisma.$transaction(async (tx) => {
    if (grant.oncePerAddress) {
      const claimed = await tx.roguelikeShipGrantAward.findFirst({
        where: { nodeId, userId: winnerId, countsAsClaim: true },
        select: { id: true },
      });
      if (claimed) return null;
    }
    const ship = await tx.ship.create({
      data: {
        ownerId: winnerId,
        name: grant.name,
        equipment: equipment as object,
        traits: traits as object,
        cost: calcShipCost(equipment, traits, costs),
        costsVersion: costs.version,
        constructed: true,
        isFree: grant.isFreeShip,
        shiny: grant.shiny,
        shipsDestroyed: grant.shipsDestroyed,
      },
    });
    await tx.roguelikeShipGrantAward.create({
      data: { nodeId, userId: winnerId, shipId: ship.id, lobbyId, countsAsClaim: grant.oncePerAddress },
    });
    return ship.id;
  });
}
