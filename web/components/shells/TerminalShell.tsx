// TerminalShell (Phase 21 §4.4).
//
// Top status bar (slot, current vault, defensive flag, alert badge).
// Three-pane layout: left rail (vault selector + nav), center
// (primary surface), right rail (sidecar metrics, agents, alerts).
// Dense density. Designed for keyboard-driven use.

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { HeaderBar } from "./HeaderBar";
import { cn } from "@/components/primitives";
import { useUiStore } from "@/lib/ui-store";
import { usePathname } from "next/navigation";

const TERMINAL_NAV = [
  { label: "Vaults",          href: "/vaults",          shortcut: "g v" },
  { label: "Live rebalance",  href: "/rebalance/live",  shortcut: "g r" },
  { label: "Triggers",        href: "/triggers" },
  { label: "Recurring",       href: "/recurring" },
  { label: "Hedging",         href: "/hedging" },
  { label: "Treasury",        href: "/treasury",        shortcut: "g t" },
  { label: "Governance",      href: "/governance" },
];

export interface TerminalShellProps {
  children: ReactNode;
  /** Optional sidecar / right rail content. */
  sidecar?: ReactNode;
}

export function TerminalShell({ children, sidecar }: TerminalShellProps) {
  const pathname = usePathname();
  const rightRailOpen = useUiStore((s) => s.rightRailOpen);
  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)]">
      <HeaderBar showRightRailToggle />
      <div className="flex max-w-[1280px] mx-auto">
        <aside className="w-56 shrink-0 border-r border-[color:var(--color-line-soft)] py-6 px-2 hidden md:block">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] px-2 mb-2">
            terminal
          </p>
          <nav className="flex flex-col gap-0.5">
            {TERMINAL_NAV.map((s) => {
              const active = pathname.startsWith(s.href);
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={cn(
                    "flex items-center justify-between px-2 py-1.5 rounded-[var(--radius-sm)] text-[12px]",
                    active
                      ? "bg-[color:var(--color-line-soft)] text-[color:var(--color-ink-primary)]"
                      : "text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink-primary)] hover:bg-[color:var(--color-line-soft)]",
                  )}
                >
                  <span>{s.label}</span>
                  {s.shortcut ? (
                    <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
                      {s.shortcut}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0 px-4 py-6 surface-grid">{children}</main>
        {sidecar && rightRailOpen ? (
          <aside className="w-72 shrink-0 border-l border-[color:var(--color-line-soft)] py-6 px-3 hidden xl:block scroll-area max-h-screen overflow-auto">
            {sidecar}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
