// Row order for the depth-column node chart (CampaignGraphCanvas in Edit
// Mode): the usual layered-graph tidy-up. A link that skips columns gets a
// placeholder slot in every column it passes, so it runs in a lane of its
// own instead of through the nodes there, and each column is ordered by
// where its neighbours sit (barycenter sweeps), so branches stay apart
// instead of crossing. Pure and number-native.

export interface ColumnOrderNode {
  id: number;
  prerequisites: number[];
}

/** A column slot: a real node id, or a placeholder for a link passing through. */
export type ColumnSlot = { kind: "node"; id: number } | { kind: "lane"; key: string };

export interface ColumnOrder {
  /** Each column's slots, top to bottom (left to right when vertical). */
  slots: ColumnSlot[][];
  /** For each link that skips columns (`${fromId}-${toId}`), its placeholder keys in column order. */
  lanes: Map<string, string[]>;
}

const SWEEPS = 4;

export const linkKey = (fromId: number, toId: number) => `${fromId}-${toId}`;
const slotKey = (s: ColumnSlot) => (s.kind === "node" ? `n${s.id}` : s.key);

export function orderColumns(columns: readonly (readonly ColumnOrderNode[] | undefined)[]): ColumnOrder {
  const colOf = new Map<number, number>();
  columns.forEach((col, c) => col?.forEach((n) => colOf.set(n.id, c)));

  const slots: ColumnSlot[][] = columns.map((col) =>
    [...(col ?? [])].sort((a, b) => a.id - b.id).map((n) => ({ kind: "node" as const, id: n.id })),
  );
  // Links between neighbouring columns, by slot key, in both directions.
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  const link = (from: string, to: string) => {
    (succs.get(from) ?? succs.set(from, []).get(from)!).push(to);
    (preds.get(to) ?? preds.set(to, []).get(to)!).push(from);
  };
  const lanes = new Map<string, string[]>();

  columns.forEach((col) =>
    col?.forEach((node) => {
      const to = colOf.get(node.id)!;
      node.prerequisites.forEach((pid) => {
        const from = colOf.get(pid);
        // Only links running forward through the columns are laid out;
        // others (a manual column override pointing back) are left alone.
        if (from == null || to <= from) return;
        let prev = `n${pid}`;
        const keys: string[] = [];
        for (let c = from + 1; c < to; c++) {
          const key = `lane:${linkKey(pid, node.id)}:${c}`;
          slots[c].push({ kind: "lane", key });
          keys.push(key);
          link(prev, key);
          prev = key;
        }
        link(prev, `n${node.id}`);
        if (keys.length > 0) lanes.set(linkKey(pid, node.id), keys);
      });
    }),
  );

  const indexIn = (c: number) => new Map(slots[c].map((s, i) => [slotKey(s), i]));
  const reorder = (c: number, neighbours: Map<string, string[]>, side: Map<string, number>) => {
    const scored = slots[c].map((s, i) => {
      const ns = (neighbours.get(slotKey(s)) ?? []).map((k) => side.get(k)).filter((v): v is number => v != null);
      return { s, i, score: ns.length > 0 ? ns.reduce((a, b) => a + b, 0) / ns.length : i };
    });
    scored.sort((a, b) => a.score - b.score || a.i - b.i);
    slots[c] = scored.map((x) => x.s);
  };
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (let c = 1; c < slots.length; c++) reorder(c, preds, indexIn(c - 1));
    for (let c = slots.length - 2; c >= 0; c--) reorder(c, succs, indexIn(c + 1));
  }
  return { slots, lanes };
}
