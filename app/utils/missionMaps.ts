// Which map each mission node uses, as the Operations run map last saw it,
// so a web3 battle can draw its mission's preset map while the game's own
// map state (getGameMapState) is still loading: a game starts on an exact
// copy of its node's preset map. Web3 battles know their node (from the
// run), not their map. Kept for the browser session, so a refresh mid-battle
// still has it. Web2 battles carry their map id and don't need this.

const STORAGE_KEY = "vt-node-maps-v1";

let byNode: Map<number, number> | null = null;

function load(): Map<number, number> {
  if (byNode) return byNode;
  byNode = new Map();
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, number>;
    for (const [nodeId, mapId] of Object.entries(saved)) byNode.set(Number(nodeId), mapId);
  } catch {
    // Storage unavailable: this page's memory only.
  }
  return byNode;
}

/** Records each node's map (combat nodes; a resupply has no map). */
export function rememberNodeMaps(nodes: readonly { nodeId: number; mapId: number }[]): void {
  const map = load();
  let changed = false;
  for (const { nodeId, mapId } of nodes) {
    if (mapId > 0 && map.get(nodeId) !== mapId) {
      map.set(nodeId, mapId);
      changed = true;
    }
  }
  if (!changed) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {
    // Storage unavailable: this page's memory only.
  }
}

/** The map a node uses, if the run map has seen it this session. */
export function nodeMapId(nodeId: number): number | null {
  return load().get(nodeId) ?? null;
}

/**
 * The missions worth preloading: where the run is and the missions that
 * come next from it (with no run, the campaign's start).
 */
export function upcomingMissionNodeIds(
  nodes: readonly { id: number; childIds: readonly number[] }[],
  currentNodeId: number | null,
  rootNodeId: number | null,
): number[] {
  const from = currentNodeId ?? rootNodeId;
  if (from == null) return [];
  const node = nodes.find((n) => n.id === from);
  return [from, ...(node?.childIds ?? [])];
}
