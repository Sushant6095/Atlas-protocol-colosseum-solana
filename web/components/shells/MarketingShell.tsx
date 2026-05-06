// MarketingShell (Phase 21 §4.1).
//
// Sticky transparent → solid header on scroll, hero canvas optional,
// footer. No sidebar. Cinema density.

import type { ShellProps } from "./types";
import { HeaderBar } from "./HeaderBar";

export function MarketingShell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)]">
      <HeaderBar
        nav={[
          { label: "Architecture",   href: "/architecture" },
          { label: "Security",       href: "/security" },
          { label: "Decision Engine", href: "/decision-engine" },
          { label: "Docs",           href: "/docs" },
        ]}
      />
      <main>{children}</main>
      <footer className="border-t border-[color:var(--color-line-soft)] mt-32 px-20 py-16">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[12px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              atlas — verifiable AI treasury OS for Solana
            </p>
            <p className="text-[12px] text-[color:var(--color-ink-tertiary)] mt-1">
              every claim is publicly observable. every commitment is proof-bound.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[color:var(--color-ink-secondary)]">
            <a href="/legal">legal</a>
            <a href="/security">security</a>
            <a href="/docs">docs</a>
            <a href="/infra">infra</a>
            <a href="/proofs/live">proofs</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
