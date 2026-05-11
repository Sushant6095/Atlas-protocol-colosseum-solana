// TerminalShell (Phase 21 §4.4 + Phase 23 §1).
//
// Top status bar (40px) → header bar → three-pane content
// (left rail · center · right rail) → bottom strip (32px). Density
// 16/24, 13/18 body, mono-heavy. Keyboard-first.
//
// Phase 23 — pages can pass `statusBar` and `bottomStrip` slots so
// the chrome carries vault / treasury context without the route
// having to mount its own header.

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LiveStrip } from "@/components/marquee/LiveStrip";
import { HeaderNav } from "@/components/nav/HeaderNav";
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
  /** Optional top-status strip (Phase 23 VaultStatusBar). */
  statusBar?: ReactNode;
  /** Optional 32px bottom strip (Phase 23 BottomStrip). */
  bottomStrip?: ReactNode;
}

export function TerminalShell({ children, sidecar, statusBar, bottomStrip }: TerminalShellProps) {
  const pathname = usePathname();
  const rightRailOpen = useUiStore((s) => s.rightRailOpen);
  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--color-surface-base)]">
      <div className="relative h-14 border-b border-white/5 overflow-hidden z-30">
        <LiveStrip />
      </div>
      <HeaderNav />
      {statusBar ? statusBar : null}
      <div className="flex flex-1 max-w-[1440px] w-full mx-auto">
        <aside className="w-60 shrink-0 border-r border-[color:var(--color-line-soft)] py-6 px-2 hidden md:block">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-tertiary)] px-2 mb-3">
            terminal
          </p>
          <nav className="flex flex-col gap-1">
            {TERMINAL_NAV.map((s) => {
              const active = pathname.startsWith(s.href);
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={cn(
                    "group flex items-center justify-between px-2.5 py-2 rounded-[var(--radius-sm)] border",
                    "text-[13px] font-semibold tracking-tight transition-colors",
                    active
                      ? "border-[color:var(--color-line-medium)] bg-[color:var(--color-surface-raised)] text-[color:var(--color-ink-primary)]"
                      : "border-transparent text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink-primary)] hover:border-[color:var(--color-line-soft)] hover:bg-[color:var(--color-surface-raised)]",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 rounded-full transition-opacity",
                        active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                      )}
                      style={{ background: "var(--color-accent-electric)" }}
                    />
                    {s.label}
                  </span>
                  {s.shortcut ? (
                    <kbd
                      className={cn(
                        "font-mono text-[10px] uppercase tracking-[0.12em] rounded-[4px] border px-1.5 py-0.5",
                        active
                          ? "border-[color:var(--color-line-medium)] text-[color:var(--color-ink-secondary)]"
                          : "border-[color:var(--color-line-soft)] text-[color:var(--color-ink-tertiary)]",
                      )}
                    >
                      {s.shortcut}
                    </kbd>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0 px-4 py-4">{children}</main>
        {sidecar && rightRailOpen ? (
          <aside className="w-80 shrink-0 border-l border-[color:var(--color-line-soft)] py-4 px-3 hidden xl:block scroll-area max-h-[calc(100vh-3.5rem)] overflow-auto">
            {sidecar}
          </aside>
        ) : null}
      </div>
      {bottomStrip ? bottomStrip : null}
    </div>
  );
}
