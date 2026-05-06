// Atlas Frontend Design Tokens (Phase 20 §1).
//
// Single source of truth for the entire web app. Every color, font,
// space, radius, easing, and duration referenced from app code must
// resolve through this file. Tailwind reads from it (via globals.css
// CSS variables); Storybook documents it; the ESLint rule
// `no-raw-hex-outside-tokens` blocks any hex string elsewhere.
//
// Hard rules:
//   1. No raw hex strings outside this file.
//   2. No new accent colors without a written rationale.
//   3. Glass surfaces are reserved for command palette, modal
//      overlays, and contextual popovers; never on hero or
//      always-on panels.

// ─── Color ──────────────────────────────────────────────────────────────

export const color = {
  surface: {
    base:    "#06070A",
    raised:  "#0B0D12",
    sunken:  "#04050A",
    inset:   "#03040A",
    glass:   "rgba(11,13,18,0.55)",
    glass_t: "rgba(11,13,18,0.30)",
  },
  ink: {
    primary:   "#E6EAF2",
    secondary: "#9AA3B5",
    tertiary:  "#5D6577",
    inverted:  "#06070A",
    accent:    "#7DB7FF",
  },
  line: {
    soft:    "rgba(255,255,255,0.04)",
    medium:  "rgba(255,255,255,0.08)",
    strong:  "rgba(255,255,255,0.16)",
    grid:    "rgba(110,140,200,0.08)",
  },
  accent: {
    electric: "#3F8CFF", // primary action
    zk:       "#A682FF", // proof / zk surfaces
    proof:    "#F478C6", // proof events
    execute:  "#3CE39A", // execution success
    warn:     "#F7B955",
    danger:   "#FF6166",
  },
  glow: {
    electric: "0 0 24px rgba(63,140,255,0.35)",
    zk:       "0 0 24px rgba(166,130,255,0.35)",
    proof:    "0 0 24px rgba(244,120,198,0.30)",
    execute:  "0 0 24px rgba(60,227,154,0.30)",
  },
} as const;

export type Color = typeof color;

// ─── Typography ────────────────────────────────────────────────────────

export const font = {
  display: '"Cabinet Grotesk", "General Sans", "Neue Montreal", system-ui, sans-serif',
  body:    '"Geist", "Satoshi", "Inter Tight", system-ui, sans-serif',
  mono:    '"IBM Plex Mono", "Geist Mono", ui-monospace, monospace',
} as const;

// Perfect-fourth ramp anchored at 14px body.
// Each entry: [size_px, line_height_px, family_key].
export const text = {
  xs:  { size: 11, leading: 15, family: "body" },
  sm:  { size: 13, leading: 18, family: "body" },
  md:  { size: 14, leading: 20, family: "body" }, // default
  lg:  { size: 16, leading: 22, family: "body" },
  xl:  { size: 20, leading: 28, family: "display" },
  "2xl": { size: 28, leading: 36, family: "display" },
  "3xl": { size: 40, leading: 48, family: "display" },
  "4xl": { size: 56, leading: 64, family: "display" },
  "5xl": { size: 80, leading: 88, family: "display" }, // hero only
} as const;

export type TextScale = keyof typeof text;

// ─── Spacing (4px grid) ────────────────────────────────────────────────

export const space = {
  0:  0,
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export type Space = keyof typeof space;

export const density = {
  /** operator terminals, tables, dashboards */
  dense:     { padInline: space[4], padBlock: space[6] },
  /** intelligence surfaces, content pages */
  default:   { padInline: space[6], padBlock: space[10] },
  /** landing, hero sections */
  cinematic: { padInline: space[20], padBlock: space[24] },
} as const;

// ─── Layout grid ───────────────────────────────────────────────────────

export const grid = {
  desktopMaxPx:    1440,
  terminalMaxPx:   1280,
  documentMaxPx:    768,
  columns:           12,
  gutterPx:         24,
} as const;

// ─── Radius / border / shadow ──────────────────────────────────────────

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 20,
} as const;

export const border = {
  hairline: `1px solid ${color.line.soft}`,
  subtle:   `1px solid ${color.line.medium}`,
  strong:   `1px solid ${color.line.strong}`,
} as const;

/**
 * Shadows are reserved. Most surfaces use borders + glow, not drop
 * shadows. Drop shadows appear only on elevated surfaces (command
 * palette, modals).
 */
export const shadow = {
  none:   "none",
  modal:  "0 20px 64px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35)",
  popover:"0 12px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)",
} as const;

// ─── Motion ────────────────────────────────────────────────────────────

/**
 * Cubic-bezier easing tokens. Anything outside these four is rejected
 * in PR. `expressive` is for sparing success moments; abuse turns the
 * UI into a toy.
 */
export const ease = {
  glide:      "cubic-bezier(0.20, 0.80, 0.20, 1.00)", // entrance, hover settle
  precise:    "cubic-bezier(0.40, 0.00, 0.20, 1.00)", // disclosure, dropdown
  expressive: "cubic-bezier(0.34, 1.56, 0.64, 1.00)", // sparingly: success
  inertial:   "cubic-bezier(0.10, 0.00, 0.00, 1.00)", // drag release
} as const;

/**
 * Duration tokens in milliseconds. Anything > 400ms goes through PR
 * review; the only token that exceeds it is `cinema` for hero +
 * route transitions.
 */
export const duration = {
  instant: 60,
  quick:   140,
  medium:  220,
  slow:    340,
  cinema:  720,
} as const;

export type Duration = keyof typeof duration;
export type Ease = keyof typeof ease;

// ─── Animation budgets (Phase 20 §2.3) ────────────────────────────────

export type SurfaceClass = "operator" | "intelligence" | "landing";

export const animationBudget: Record<
  SurfaceClass,
  { concurrentAnimations: number; rafCallbacks: number; allows3d: boolean }
> = {
  operator:     { concurrentAnimations: 3,  rafCallbacks: 1, allows3d: false },
  intelligence: { concurrentAnimations: 6,  rafCallbacks: 2, allows3d: true },
  landing:      { concurrentAnimations: 12, rafCallbacks: 4, allows3d: true },
};

// ─── Performance budgets (Phase 20 §9) ────────────────────────────────

export const perfBudget = {
  vitals: {
    marketing:    { lcpMs: 1_800, inpMs: 200, cls: 0.05 },
    intelligence: { lcpMs: 2_400, inpMs: 200, cls: 0.05 },
    operator:     { lcpMs: 2_800, inpMs: 200, cls: 0.02 },
  },
  bundleKbGzip: {
    initialRoute:        220,
    perRouteCodeSplit:   120,
    threeDImport:        380,
    firstInteraction:    600,
  },
  runtime: {
    targetFps:                 60,
    longTaskThresholdMs:       50,
    sustainedLongTaskPer5sMax: 1,
    memoryMbAfterTenMin:       220,
  },
} as const;

// ─── Realtime budgets (Phase 20 §4) ───────────────────────────────────

export const realtimeBudget = {
  /** Maximum recent-event LRU size for dedup. */
  dedupLruEntries:        4_096,
  /** Out-of-order tolerance (depth). */
  reorderTolerance:       32,
  /** Max events buffered before backpressure drops oldest non-critical. */
  backpressureBufferMax:  1_024,
  /** Topic auto-pause delay after viewport offscreen (ms). */
  offscreenPauseMs:       1_500,
  /** Reconnect failures before "live updates paused" pill shows. */
  reconnectAttemptsBeforePill: 3,
} as const;

// ─── 3D / Canvas budgets (Phase 20 §5) ────────────────────────────────

export const threeBudget = {
  targetFps:               60,
  throttleEnterFrameMs:    22,
  throttleExitFrameMs:     18,
  throttleSustainedMs:     1_000,
  /** rootMargin used by IntersectionObserver to mount scenes. */
  intersectionMarginPx:    200,
  /** instanced rendering threshold — anything rendered ≥ this many times. */
  instancingThreshold:     50,
  lod: { tier1MaxPx: 1080, tier2MaxPx: 720, tier3MaxPx: 360 },
} as const;

// ─── Z-index ladder ────────────────────────────────────────────────────

export const z = {
  base:        0,
  raised:      10,
  nav:         100,
  drawer:      200,
  popover:     300,
  modal:       400,
  toast:       500,
  commandPalette: 600,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Resolve a CSS custom-property name for a token path. Used by the
 * Tailwind generator + the runtime CSS bridge.
 */
export function cssVar(path: string): string {
  return `--atlas-${path.replace(/\./g, "-")}`;
}
