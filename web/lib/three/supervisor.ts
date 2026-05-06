// 3D Scene Supervisor (Phase 20 §5).
//
// The supervisor is the only path components use to mount a 3D
// scene. It owns:
//
//   1. viewport gating via IntersectionObserver — scenes mount when
//      the host element enters the viewport with the configured
//      rootMargin and unmount when scrolled past;
//   2. an adaptive FPS supervisor — targets 60fps by default, halves
//      update frequency to 30fps when the rolling frame time
//      exceeds the threshold, restores to 60 when stable;
//   3. a deterministic LOD tier selector keyed off device pixel
//      density + canvas pixel count;
//   4. a low-end fallback that renders the first frame and freezes
//      when the device is below the hardware-concurrency / memory
//      thresholds, or the user prefers reduced motion.
//
// The hook `useSceneSupervisor()` is what r3f scenes consume.
// Without r3f the same primitives drive a plain canvas2d / WebGL
// loop.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { threeBudget } from "../tokens";
import { prefersReducedMotion } from "../motion";

export type LodTier = "tier1" | "tier2" | "tier3";

export interface SceneState {
  /** Mount the heavy three.js / canvas pipeline iff true. */
  mounted: boolean;
  /** Update frequency multiplier (1 = 60fps target, 0.5 = 30fps). */
  updateMultiplier: number;
  /** Resolution / detail tier. */
  lod: LodTier;
  /** True when reduced motion or low-end device — render first frame and freeze. */
  freeze: boolean;
}

export interface SupervisorConfig {
  /** Surface class — affects whether 3D is allowed at all. */
  surface: "operator" | "intelligence" | "landing";
  /** Override the default rootMargin used by the IntersectionObserver. */
  intersectionMarginPx?: number;
}

export function useSceneSupervisor(
  hostRef: React.RefObject<HTMLElement | null>,
  cfg: SupervisorConfig,
): SceneState {
  const [mounted, setMounted] = useState(false);
  const [updateMultiplier, setMultiplier] = useState(1);
  const lod = useLod();
  const freeze = useLowEndFreeze();
  const longFrameSinceRef = useRef<number | null>(null);
  const goodFrameSinceRef = useRef<number | null>(null);

  // Operator surfaces never run 3D — the budget is too tight.
  const surfaceAllows3d = cfg.surface !== "operator";

  // ── Mount on viewport intersection ─────────────────────────────
  useEffect(() => {
    if (!surfaceAllows3d || !hostRef.current) return;
    const el = hostRef.current;
    const margin = `${cfg.intersectionMarginPx ?? threeBudget.intersectionMarginPx}px`;
    if (typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setMounted(true);
          else setMounted(false);
        }
      },
      { rootMargin: margin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hostRef, cfg.intersectionMarginPx, surfaceAllows3d]);

  // ── FPS supervisor ─────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || freeze) return;
    let raf = 0;
    let prev = performance.now();

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const frameMs = now - prev;
      prev = now;

      // Enter throttle when we've been over budget for the
      // sustained window; exit when we've been comfortably under.
      if (frameMs > threeBudget.throttleEnterFrameMs) {
        if (longFrameSinceRef.current === null) longFrameSinceRef.current = now;
        goodFrameSinceRef.current = null;
        if (
          updateMultiplier === 1
          && now - (longFrameSinceRef.current ?? now) > threeBudget.throttleSustainedMs
        ) {
          setMultiplier(0.5);
        }
      } else if (frameMs < threeBudget.throttleExitFrameMs) {
        if (goodFrameSinceRef.current === null) goodFrameSinceRef.current = now;
        longFrameSinceRef.current = null;
        if (
          updateMultiplier !== 1
          && now - (goodFrameSinceRef.current ?? now) > threeBudget.throttleSustainedMs
        ) {
          setMultiplier(1);
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mounted, freeze, updateMultiplier]);

  return useMemo(
    () => ({ mounted: mounted && surfaceAllows3d, updateMultiplier, lod, freeze }),
    [mounted, surfaceAllows3d, updateMultiplier, lod, freeze],
  );
}

// ─── LOD selection ───────────────────────────────────────────────────────

function useLod(): LodTier {
  const [lod, setLod] = useState<LodTier>("tier1");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const compute = () => {
      const w = window.innerWidth * (window.devicePixelRatio || 1);
      if (w >= threeBudget.lod.tier1MaxPx) setLod("tier1");
      else if (w >= threeBudget.lod.tier2MaxPx) setLod("tier2");
      else setLod("tier3");
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return lod;
}

// ─── Low-end / reduced-motion freeze ─────────────────────────────────────

function useLowEndFreeze(): boolean {
  const [freeze, setFreeze] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setFreeze(true);
      return;
    }
    if (typeof navigator === "undefined") return;
    const cores = navigator.hardwareConcurrency ?? 8;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    if (cores < 4 || memory < 4) setFreeze(true);
  }, []);
  return freeze;
}
