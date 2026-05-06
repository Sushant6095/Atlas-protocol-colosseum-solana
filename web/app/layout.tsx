import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { TxToastHost } from "@/components/TxToast";

export const metadata: Metadata = {
  title: "Atlas — Verifiable AI Treasury OS for Solana",
  description:
    "Capital, models, proofs, settlement, and disclosure each have their own layer. Every claim is publicly observable.",
  metadataBase: new URL("https://atlas.fyi"),
};

/**
 * Root layout (Phase 21 §3).
 *
 * Chrome lives in the per-route-group shells (MarketingShell,
 * PublicShell, IntelligenceShell, TerminalShell, DocsShell). The
 * legacy <Navbar /> mounts here for routes that haven't been
 * migrated to a route group yet (Phase 22 will retire it). Providers
 * own the realtime root, the command palette, the alert center, and
 * the keyboard-shortcut handler.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-[color:var(--color-surface-base)] text-[color:var(--color-ink-primary)]">
        <Providers>
          <Navbar />
          {children}
          <TxToastHost />
        </Providers>
      </body>
    </html>
  );
}
