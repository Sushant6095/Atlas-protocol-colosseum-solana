// Atlas motion system (Phase 20 §2).
//
// All animation in the app routes through this module. Framer Motion
// variants here; CSS transitions reach for the same tokens via the
// `tokens.ts` bridge. Custom `cubic-bezier(...)` strings inside
// component code are forbidden — point at one of the four `ease`
// keys here.
//
// Reduced-motion: every variant collapses to its rest state with
// `duration.instant` when `prefers-reduced-motion: reduce` is set.
// The hook `useReducedMotionContract()` provides a single entry to
// query this in JS.

import type { Transition, Variants } from "framer-motion";
import { duration, ease } from "./tokens";

const sec = (ms: number) => ms / 1000;

// ─── Transitions ────────────────────────────────────────────────────────

export const transitions = {
  instantGlide: { duration: sec(duration.instant), ease: ease.glide },
  quickPress:   { duration: sec(duration.quick),   ease: ease.precise },
  mediumReveal: { duration: sec(duration.medium),  ease: ease.precise },
  slowPanel:    { duration: sec(duration.slow),    ease: ease.glide },
  cinemaHero:   { duration: sec(duration.cinema),  ease: ease.glide },
  /** Reserved for success moments only. */
  expressive:   { duration: sec(duration.medium),  ease: ease.expressive },
  /** Used by drag-release and fling primitives. */
  inertial:     { duration: sec(duration.medium),  ease: ease.inertial },
} as const satisfies Record<string, Transition>;

export type TransitionToken = keyof typeof transitions;

// ─── Variants — entrance ────────────────────────────────────────────────

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: transitions.mediumReveal },
};

export const liftIn: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitions.mediumReveal },
};

export const heroLift: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: transitions.cinemaHero },
};

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transitions.slowPanel },
  exit:    { opacity: 0, scale: 0.96, transition: transitions.quickPress },
};

// ─── Variants — disclosure ──────────────────────────────────────────────

export const disclosureCollapse: Variants = {
  collapsed: { height: 0,    opacity: 0, transition: transitions.mediumReveal },
  expanded:  { height: "auto", opacity: 1, transition: transitions.mediumReveal },
};

// ─── Variants — interactive ─────────────────────────────────────────────

export const pressTap = {
  whileTap: { scale: 0.98, transition: transitions.quickPress },
};

export const hoverGlow = {
  whileHover: { transition: transitions.instantGlide },
};

// ─── Stagger (lists) ────────────────────────────────────────────────────

/** Stagger-children for list reveals. Children should use `liftIn`. */
export const listStagger: Variants = {
  visible: {
    transition: {
      staggerChildren: sec(duration.instant) / 2,
      delayChildren:   sec(duration.instant),
    },
  },
};

// ─── Page transition (route changes) ────────────────────────────────────

export const routeTransition: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: transitions.cinemaHero },
  exit:    { opacity: 0, y: -6, transition: transitions.quickPress },
};

// ─── Reduced motion ─────────────────────────────────────────────────────

/**
 * Returns true if the user has requested reduced motion (or the env
 * is non-DOM). Components can collapse variants to their rest state
 * without importing framer-motion's hook everywhere.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Wrap a Variants object so all transitions collapse to instant when
 * the user has reduced-motion enabled. The variant keys/values are
 * preserved; only `transition` is overridden.
 */
export function reducedMotionAware(variants: Variants): Variants {
  if (!prefersReducedMotion()) return variants;
  const out: Variants = {};
  for (const [k, v] of Object.entries(variants)) {
    if (typeof v === "object" && v !== null) {
      out[k] = { ...v, transition: { duration: sec(duration.instant) } };
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── Telemetry-friendly counters ────────────────────────────────────────

/**
 * Surface-level animation budget tracker. Pages register their
 * surface class; high-cardinality animation hooks (3D scenes,
 * streaming charts) check `isAtBudget()` before spinning up.
 *
 * Implementation is process-local (no Zustand dep so motion stays
 * leaf-importable). The store ticks on each `enter`/`exit`.
 */
let activeAnimations = 0;

export function enterAnimationSlot(): void {
  activeAnimations += 1;
}

export function exitAnimationSlot(): void {
  if (activeAnimations > 0) activeAnimations -= 1;
}

export function activeAnimationCount(): number {
  return activeAnimations;
}
