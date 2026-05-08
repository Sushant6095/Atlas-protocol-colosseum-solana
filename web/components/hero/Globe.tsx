// Hero globe — Canvas wrapper.
//
// Owns the responsive sizing, viewport-mount gate, reduced-motion
// detection, low-end-device detection, and Page Visibility pause.
// The actual r3f scene lives in `Globe.scene.tsx` and is loaded
// dynamically so the three-bundle ships off the critical path.

"use client";

import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import { useInView } from "@/hooks/useInView";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const GlobeScene = dynamic(() => import("./Globe.scene"), { ssr: false });

function detectSimplified(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const cores = (navigator.hardwareConcurrency ?? 8) < 4;
  const memory =
    typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === "number"
      ? ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) < 4
      : false;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 767px)").matches;
  return cores || memory || touch || narrow;
}

export function Globe(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { rootMargin: "200px" });
  const reducedMotion = useReducedMotion();
  const [simplified, setSimplified] = useState(false);
  const [docHidden, setDocHidden] = useState(false);

  useEffect(() => {
    setSimplified(detectSimplified());
    if (typeof document === "undefined") return;
    const onVis = (): void => setDocHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const shouldRender = inView && !docHidden;

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full
                 max-w-[280px] sm:max-w-[360px] lg:max-w-[480px]"
      aria-label="Atlas integration globe with five orbiting partner logos"
    >
      {shouldRender && (
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          // `frameloop="demand"` would pause until invalidate() — we
          // want continuous animation, so leave the default.
        >
          <Suspense fallback={null}>
            <GlobeScene
              reducedMotion={reducedMotion}
              simplified={simplified}
              containerRef={containerRef}
            />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
