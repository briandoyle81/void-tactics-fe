import { prisma } from "@/app/lib/prisma";
import { isCurrentNodeCleared } from "@/app/utils/runMapAction";

/**
 * Whether a web2 run may move on from its current node: the same rule as
 * the run map (isCurrentNodeCleared) — a resupply stop, or a combat mission
 * already won, with no match in progress. Used by the enter-combat and
 * enter-resupply routes for any move away from the current node.
 */
export async function canLeaveCurrentNodeWeb2(run: {
  id: number;
  currentNodeId: number;
  activeLobbyId: number | null;
}): Promise<boolean> {
  const current = await prisma.roguelikeNode.findUnique({
    where: { id: run.currentNodeId },
    select: { kind: true },
  });
  if (!current) return false;
  const kind = current.kind === 1 ? "resupply" : "combat";
  const defeat =
    kind === "combat"
      ? await prisma.roguelikeNodeDefeat.findUnique({
          where: { runId_nodeId: { runId: run.id, nodeId: run.currentNodeId } },
          select: { nodeId: true },
        })
      : null;
  return isCurrentNodeCleared({
    kind,
    isDefeated: defeat != null,
    hasActiveGame: run.activeLobbyId != null,
  });
}

export const FINISH_CURRENT_MISSION_ERROR = "Finish your current mission first";
