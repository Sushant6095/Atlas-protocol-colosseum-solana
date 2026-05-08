// @atlas/tokens — single source of truth for the design language.
//
// Mirrors atlas/web/lib/tokens.ts. New apps (apps/web, apps/app,
// apps/dev) should import from here so token drift can't happen
// across surfaces. atlas/web continues to ship its own copy until
// the migration commits.

export const color = {
  surface: {
    base:    "#06070A",
    raised:  "#0B0D12",
    sunken:  "#04050A",
    inset:   "#03040A",
    glass:   "rgba(11,13,18,0.55)",
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
    electric: "#3F8CFF",
    zk:       "#A682FF",
    proof:    "#F478C6",
    execute:  "#3CE39A",
    warn:     "#F7B955",
    danger:   "#FF6166",
  },
  solana: {
    violet: "#9945FF",
    cyan:   "#19B5FE",
    green:  "#14F195",
  },
} as const;

export const font = {
  display: '"Cabinet Grotesk", "General Sans", "Neue Montreal", system-ui, sans-serif',
  body:    '"Geist", "Satoshi", "Inter Tight", system-ui, sans-serif',
  mono:    '"IBM Plex Mono", "Geist Mono", ui-monospace, monospace',
  serif:   '"Newsreader", "Source Serif Pro", "GT Sectra", Georgia, serif',
} as const;

export const radius = {
  xs: 4, sm: 6, md: 8, lg: 12, xl: 20,
} as const;

export const ease = {
  glide:      [0.20, 0.80, 0.20, 1.00],
  precise:    [0.40, 0.00, 0.20, 1.00],
  expressive: [0.34, 1.56, 0.64, 1.00],
  inertial:   [0.10, 0.00, 0.00, 1.00],
} as const;

export const duration = {
  instant: 60, quick: 140, medium: 220, slow: 340, cinema: 720,
} as const;
