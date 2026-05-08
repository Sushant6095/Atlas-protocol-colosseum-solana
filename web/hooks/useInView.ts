// useInView — intersection-observer hook used to gate expensive
// sub-trees (3D canvas, video, charts) on viewport visibility.
//
// Returns a stable boolean that is `true` while the observed element
// is intersecting the viewport (with optional rootMargin for early
// mount). Falls back to `true` on the server so hydration-sensitive
// children render their initial skeleton instead of disappearing.

"use client";

import { type RefObject, useEffect, useState } from "react";

export interface UseInViewOptions {
  /** Same semantics as IntersectionObserver `rootMargin`. */
  rootMargin?: string;
  /** Threshold passed to IntersectionObserver. */
  threshold?: number | number[];
  /** Once `true`, stay `true`. Default `true`. Set false to track on/off. */
  once?: boolean;
}

export function useInView<T extends Element>(
  ref: RefObject<T | null>,
  { rootMargin = "0px", threshold = 0, once = true }: UseInViewOptions = {},
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) obs.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, rootMargin, threshold, once]);

  return inView;
}
