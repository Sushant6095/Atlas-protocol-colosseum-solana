import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { TxToastHost } from "@/components/TxToast";
import { themeBootScript } from "@/components/ThemeToggle";
import { SmoothScrollProvider } from "@/components/scroll/SmoothScrollProvider";
import { GrainBackground } from "@/components/scroll/GrainBackground";

// Atlas display face — Cabinet Grotesk Variable.
//
// Self-hosted under `app/fonts/`. The variable axis covers 100..900;
// we expose 400..800 to the app (anything heavier reads as a "marketing
// shout" and is rejected in PR review). Falls through to a tuned
// system stack so the layout never collapses if the woff2 fails to
// resolve.
const cabinetGrotesk = localFont({
  src: [
    {
      path: "./fonts/Cabinet-Grotesk-Variable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["General Sans", "Neue Montreal", "system-ui", "sans-serif"],
  preload: true,
  adjustFontFallback: "Arial",
  declarations: [
    { prop: "unicode-range", value: "U+0020-007E, U+00A0-00FF, U+0030-0039, U+2010-2027, U+2030-205F, U+2070-208F" },
  ],
});

// Atlas serif italic accent — Newsreader Italic 500. Used inline in
// the hero headline ("verified by math") to break the all-sans
// rhythm Lulo's landing established. Subset to Latin so the woff2
// stays under 70 KB.
const newsreader = localFont({
  src: [
    { path: "./fonts/Newsreader-Italic-500.woff2", weight: "500", style: "italic" },
  ],
  variable: "--font-serif",
  display: "swap",
  fallback: ["Source Serif Pro", "GT Sectra", "Georgia", "serif"],
  preload: true,
});

// Atlas body face — Geist Variable. Self-hosted so the body
// typography matches the brand stack regardless of network.
const geist = localFont({
  src: [
    { path: "./fonts/Geist-Variable.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
  fallback: ["Satoshi", "Inter Tight", "system-ui", "sans-serif"],
  preload: true,
  adjustFontFallback: "Arial",
});

// Atlas mono face — IBM Plex Mono 400 + 500 (Latin subsets).
const plexMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  fallback: ["Geist Mono", "ui-monospace", "monospace"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Atlas — Verifiable AI Treasury OS for Solana",
  description:
    "Capital, models, proofs, settlement, and disclosure each have their own layer. Every claim is publicly observable.",
  metadataBase: new URL("https://atlasfi.in"),
  // Atlas mark — single source of truth for tab favicon, Apple touch
  // icon, and Open Graph thumbnail. Lives at `/public/brand/atlas-mark.png`
  // so any deployment domain serves the same logo asset.
  icons: {
    icon: [
      { url: "/brand/atlas-mark.png", type: "image/png", sizes: "any" },
      { url: "/brand/atlas-mark.svg", type: "image/svg+xml" },
    ],
    shortcut: "/brand/atlas-mark.png",
    apple: { url: "/brand/atlas-mark.png", sizes: "180x180" },
  },
  openGraph: {
    title: "Atlas — Verifiable AI Treasury OS for Solana",
    description: "Trust the math, not the team.",
    images: [{ url: "/brand/atlas-mark.png", width: 1024, height: 1024, alt: "Atlas" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Atlas",
    description: "Verifiable AI treasury OS for Solana.",
    images: ["/brand/atlas-mark.png"],
  },
};

/**
 * Root layout (Phase 22 cutover).
 *
 * Chrome lives in the per-route-group shells (MarketingShell,
 * PublicShell, IntelligenceShell, TerminalShell, DocsShell).
 * Providers own the realtime root, the command palette, the alert
 * center, and the keyboard-shortcut handler.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${cabinetGrotesk.variable} ${newsreader.variable} ${geist.variable} ${plexMono.variable}`}
    >
      <head>
        {/* Pre-hydration theme bootstrap — flips data-theme="light"
            on <html> *before* any styles paint, so light-mode users
            don't see a dark flash on first load. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen antialiased bg-[color:var(--color-surface-base)] text-[color:var(--color-ink-primary)]">
        <SmoothScrollProvider>
          <GrainBackground />
          <Providers>
            {children}
            <TxToastHost />
          </Providers>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
