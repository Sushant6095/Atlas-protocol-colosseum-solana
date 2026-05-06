// DocsShell (Phase 21 §4.5).
//
// Three-column: nav, content, on-page TOC. 768px content max width.
// Mono code blocks dominant.

"use client";

import Link from "next/link";
import type { ShellProps } from "./types";
import { HeaderBar } from "./HeaderBar";
import { cn } from "@/components/primitives";
import { usePathname } from "next/navigation";

const DOCS_NAV = [
  { label: "Overview",        href: "/docs" },
  { label: "API reference",   href: "/docs/api" },
  { label: "SDK reference",   href: "/docs/sdk" },
  { label: "Shortcuts",       href: "/docs/shortcuts" },
  { label: "Playground",      href: "/playground" },
  { label: "Webhooks",        href: "/webhooks" },
];

export function DocsShell({ children }: ShellProps) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)]">
      <HeaderBar />
      <div className="flex max-w-[1440px] mx-auto">
        <aside className="w-56 shrink-0 border-r border-[color:var(--color-line-soft)] py-8 px-3 hidden md:block">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] px-2 mb-2">
            documentation
          </p>
          <nav className="flex flex-col gap-0.5">
            {DOCS_NAV.map((s) => {
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
        <main className="flex-1 min-w-0 px-8 py-10">
          <article className="max-w-[768px] mx-auto">{children}</article>
        </main>
      </div>
    </div>
  );
}
