import { useCallback, useEffect, useRef } from "react";
import { getUrlParam, setUrlParams, useUrlParam } from "../utils/urlState";

/**
 * Keeps a map's selected node in the URL (`node=<id>`, see urlState.ts) so a
 * refresh reselects it. Replaces the history entry rather than pushing one:
 * Back leaves the map, it doesn't step through clicks. Only writes while
 * `tabSlug` is the open tab (the Operations map stays mounted, hidden, on
 * other tabs). Shared by RoguelikeGraph.tsx and RoguelikeGraphWeb2.tsx.
 *
 * Returns `takeInitialUrlNode`: the node the URL named at load, once (null
 * after the first call). The map's snap-to-current effect uses it for its
 * first snap, so a refresh doesn't jump back to the current node.
 */
export function useUrlSelectedNode(selectedNodeId: number | null, tabSlug: string) {
  const initialRef = useRef<number | null | undefined>(undefined);
  if (initialRef.current === undefined) {
    const value = getUrlParam("node");
    initialRef.current = value && /^\d+$/.test(value) ? Number(value) : null;
  }
  const tab = useUrlParam("tab");
  useEffect(() => {
    if (tab !== tabSlug) return;
    setUrlParams({ node: selectedNodeId }, { replace: true });
  }, [tab, tabSlug, selectedNodeId]);

  return useCallback((): number | null => {
    const value = initialRef.current ?? null;
    initialRef.current = null;
    return value;
  }, []);
}
