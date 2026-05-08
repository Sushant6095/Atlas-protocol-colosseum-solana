// Viz-side token bridge. Every visualization resolves colors and
// motion through these CSS variables; the host app declares them
// once via `lib/tokens.ts` (Phase 20 §1).

export const vizColor = {
  bg:        "var(--color-surface-base, #06070A)",
  raised:    "var(--color-surface-raised, #0B0D12)",
  ink:       "var(--color-ink-primary, #E6EAF2)",
  ink2:      "var(--color-ink-secondary, #9AA3B5)",
  ink3:      "var(--color-ink-tertiary, #5D6577)",
  line:      "var(--color-line-medium, rgba(255,255,255,0.08))",
  line2:     "var(--color-line-strong, rgba(255,255,255,0.16))",
  electric:  "var(--color-accent-electric, #3F8CFF)",
  zk:        "var(--color-accent-zk, #A682FF)",
  proof:     "var(--color-accent-proof, #F478C6)",
  execute:   "var(--color-accent-execute, #3CE39A)",
  warn:      "var(--color-accent-warn, #F7B955)",
  danger:    "var(--color-accent-danger, #FF6166)",
} as const;

export const vizFont = {
  mono:    "var(--font-mono, 'IBM Plex Mono', ui-monospace, monospace)",
  display: "var(--font-display, 'Cabinet Grotesk', system-ui, sans-serif)",
  body:    "var(--font-body, 'Geist', system-ui, sans-serif)",
} as const;

export const vizDuration = {
  instant: 60,
  quick:   140,
  medium:  220,
  slow:    340,
} as const;

/** Default categorical palette for series / nodes / arcs. */
export const VIZ_PALETTE = [
  vizColor.electric,
  vizColor.zk,
  vizColor.proof,
  vizColor.execute,
  vizColor.warn,
  vizColor.danger,
];
