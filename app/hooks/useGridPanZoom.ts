import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface Zoom {
  scale: number;
  tx: number;
  ty: number;
}

/**
 * Wheel-to-zoom and right-click-drag-to-pan for the game grid, and on touch
 * screens two-finger pinch-to-zoom and drag-to-pan (one finger still taps
 * and drags ships as before). Extracted
 * verbatim from `GameGrid.tsx` — same math, same event wiring, no behavior
 * change. `gridContainerRef` is created here and returned so callers can
 * both apply pan/zoom to it and pass the same ref down to children that
 * need to measure grid cells (tooltips, weapon animations, etc).
 */
const WHEEL_COMMIT_DELAY_MS = 120;

function applyGridTransform(
  el: HTMLDivElement | null,
  zoom: Zoom,
) {
  if (!el) return;
  el.style.transform = `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`;
  el.style.transformOrigin = "0 0";
}

export function useGridPanZoom() {
  const outerWrapperRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<Zoom>({ scale: 1, tx: 0, ty: 0 });
  const zoomRef = useRef(zoom);

  // Right-click pan state
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const panDidMoveRef = useRef(false);
  const wheelCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // React state only feeds zoom-dependent UI (weapon selector scale). Commit
  // it once the gesture settles instead of re-rendering the board per tick.
  const commitZoomState = useCallback(() => {
    const next = zoomRef.current;
    setZoom((prev) =>
      prev.tx === next.tx && prev.ty === next.ty && prev.scale === next.scale
        ? prev
        : next,
    );
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const outer = outerWrapperRef.current;
    const el = gridContainerRef.current;
    if (!outer || !el) return;

    // Use the outer wrapper's rect (no transform applied) + the element's untransformed
    // offsetLeft/offsetTop (= padding) to get the element's natural screen position.
    const outerRect = outer.getBoundingClientRect();
    const naturalLeft = outerRect.left + el.offsetLeft;
    const naturalTop = outerRect.top + el.offsetTop;

    // Cursor in natural (pre-transform) element coordinates
    const mx = e.clientX - naturalLeft;
    const my = e.clientY - naturalTop;

    const { scale, tx, ty } = zoomRef.current;

    const ZOOM_FACTOR = 1.15;
    const MIN_SCALE = 1;
    const MAX_SCALE = 5;

    const delta = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * delta));
    if (newScale === scale) return;

    // Keep the point under the cursor fixed:
    // contentPt = (cursor - translate) / scale  →  after zoom: translate' = cursor - contentPt * newScale
    const contentX = (mx - tx) / scale;
    const contentY = (my - ty) / scale;
    let newTx = mx - contentX * newScale;
    let newTy = my - contentY * newScale;

    // Clamp so you can't pan the grid fully off-screen
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const maxTx = 0;
    const minTx = w * (1 - newScale);
    const maxTy = 0;
    const minTy = h * (1 - newScale);
    newTx = Math.min(maxTx, Math.max(minTx, newTx));
    newTy = Math.min(maxTy, Math.max(minTy, newTy));

    // Reset translate when returning to scale 1
    if (newScale === MIN_SCALE) { newTx = 0; newTy = 0; }

    const next = { scale: newScale, tx: newTx, ty: newTy };
    zoomRef.current = next;
    applyGridTransform(el, next);
    if (wheelCommitTimerRef.current) clearTimeout(wheelCommitTimerRef.current);
    wheelCommitTimerRef.current = setTimeout(() => {
      wheelCommitTimerRef.current = null;
      commitZoomState();
    }, WHEEL_COMMIT_DELAY_MS);
  }, [commitZoomState]);

  useEffect(() => {
    const el = outerWrapperRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
      panStartRef.current = { x: e.clientX, y: e.clientY, tx: zoomRef.current.tx, ty: zoomRef.current.ty };
      panDidMoveRef.current = false;
    };

    let rafId: number | null = null;
    const onMouseMove = (e: MouseEvent) => {
      if (!panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (!panDidMoveRef.current && Math.hypot(dx, dy) < 4) return;
      panDidMoveRef.current = true;

      if (rafId !== null) return; // skip if a frame is already queued
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!panStartRef.current) return;
        const { scale } = zoomRef.current;
        const gridEl = gridContainerRef.current;
        const w = gridEl?.offsetWidth ?? el.offsetWidth;
        const h = gridEl?.offsetHeight ?? el.offsetHeight;
        const tdx = e.clientX - panStartRef.current.x;
        const tdy = e.clientY - panStartRef.current.y;
        const newTx = Math.min(0, Math.max(w * (1 - scale), panStartRef.current.tx + tdx));
        const newTy = Math.min(0, Math.max(h * (1 - scale), panStartRef.current.ty + tdy));
        const next = { scale, tx: newTx, ty: newTy };
        zoomRef.current = next;
        applyGridTransform(gridEl ?? el, next);
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 2) return;
      panStartRef.current = null;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      commitZoomState();
    };

    const onContextMenu = (e: MouseEvent) => {
      if (panDidMoveRef.current) e.preventDefault();
    };

    // Two-finger pinch/pan. The point between the fingers stays under them
    // while zooming, same as the wheel keeps the cursor's point fixed.
    let pinch: { dist: number; midX: number; midY: number; zoom: Zoom } | null = null;
    const touchMid = (t: TouchList) => ({
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
      dist: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY),
    });
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const m = touchMid(e.touches);
      pinch = { dist: Math.max(1, m.dist), midX: m.x, midY: m.y, zoom: { ...zoomRef.current } };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault(); // no page zoom while pinching the board
      const gridEl = gridContainerRef.current;
      if (!gridEl) return;
      const m = touchMid(e.touches);
      const outerRect = el.getBoundingClientRect();
      const originX = outerRect.left + gridEl.offsetLeft;
      const originY = outerRect.top + gridEl.offsetTop;
      const start = pinch.zoom;
      const scale = Math.min(5, Math.max(1, start.scale * (m.dist / pinch.dist)));
      // Content point under the starting midpoint, kept under the current one.
      const contentX = (pinch.midX - originX - start.tx) / start.scale;
      const contentY = (pinch.midY - originY - start.ty) / start.scale;
      const w = gridEl.offsetWidth;
      const h = gridEl.offsetHeight;
      let tx = Math.min(0, Math.max(w * (1 - scale), m.x - originX - contentX * scale));
      let ty = Math.min(0, Math.max(h * (1 - scale), m.y - originY - contentY * scale));
      if (scale === 1) { tx = 0; ty = 0; }
      const next = { scale, tx, ty };
      zoomRef.current = next;
      applyGridTransform(gridEl, next);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!pinch || e.touches.length >= 2) return;
      pinch = null;
      commitZoomState();
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("contextmenu", onContextMenu, { capture: true });

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("contextmenu", onContextMenu, { capture: true });
      if (wheelCommitTimerRef.current) {
        clearTimeout(wheelCommitTimerRef.current);
        wheelCommitTimerRef.current = null;
      }
    };
  }, [handleWheel, commitZoomState]);

  useLayoutEffect(() => {
    applyGridTransform(gridContainerRef.current, zoomRef.current);
  }, [zoom]);

  return { outerWrapperRef, gridContainerRef, zoom };
}
