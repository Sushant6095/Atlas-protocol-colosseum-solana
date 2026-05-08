"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { useEffect, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  // Honour prefers-reduced-motion: skip Lenis entirely so the page
  // falls back to native scroll. Smooth scroll + GSAP scrubs are the
  // most expensive thing on the page; turning them off gives
  // accessibility users + low-end devices native perf.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  if (reduced) {
    return <>{children}</>;
  }

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,
        duration: 1.2,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      }}
    >
      <LenisGsapBridge />
      {children}
    </ReactLenis>
  );
}

// Bridges Lenis's RAF loop into GSAP's ticker so ScrollTrigger
// scrub stays in sync with the smoothed scroll position. Without
// this bridge, pinned timelines stutter because Lenis is updating
// `window.scrollY` on a different frame than GSAP reads it.
function LenisGsapBridge() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    function raf(time: number) {
      lenis!.raf(time * 1000);
    }

    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
    };
  }, [lenis]);

  return null;
}
