"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True while the element is at least partly on screen. Gate decorative
 * animations and timers on it (with usePageVisible) so they stop working
 * when nobody can see them. Starts true, so first paint is unaffected.
 */
export function useInView(ref: RefObject<Element | null>, rootMargin = "0px"): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);
  return inView;
}
