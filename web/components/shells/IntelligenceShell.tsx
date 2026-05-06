// IntelligenceShell (Phase 21 §4.3).
//
// Top-bar with search + locale + theme. Left rail with sections.
// Default density.

"use client";

import Link from "next/link";
import type { ShellProps } from "./types";
import { HeaderBar } from "./HeaderBar";
import { cn } from "@/components/primitives";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { label: "Overview",            href: "/intelligence" },
  { label: "Wallet intelligence", href: "/wallet-intelligence" },
  { label: "Capital flow",        href: "/intelligence#heatmap" },
  { label: "Exposure graph",      href: "/intelligence#exposure" },
  { label: "Market",              href: "/market" },
  { label: "Cross-protocol risk", href: "/risk" },
];

export function IntelligenceShell({ children }: ShellProps) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)]">
      <HeaderBar />
      <div className="flex max-w-[1440px] mx-auto">
        <aside className="w-56 border-r border-[color:var(--color-line-soft)] py-8 px-3 hidden lg:block">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] px-2 mb-2">
            intelligence
          </p>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => {
              const active = pathname === s.href;
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={cn(
                    "px-2 py-1.5 rounded-[var(--radius-sm)] text-[13px]",
                    active
                      ? "bg-[color:var(--color-line-soft)] text-[color:var(--color-ink-primary)]"
                      : "text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink-primary)] hover:bg-[color:var(--color-line-soft)]",
                  )}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 px-6 py-10 min-w-0">{children}</main>
      </div>
    </div>
  );
}
