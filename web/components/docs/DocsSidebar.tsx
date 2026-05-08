// Left sidebar. Filters its sections by the active top-tab; each
// section is collapsible. The active item gets a 2px accent.electric
// left bar so the user can locate themselves quickly.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/components/primitives";
import { SIDEBAR, tabForPath } from "./nav";

export interface DocsSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function DocsSidebar({ className, onNavigate }: DocsSidebarProps): JSX.Element {
  const pathname = usePathname() ?? "/docs";
  const tab = tabForPath(pathname);
  const sections = SIDEBAR[tab];

  const allTitles = useMemo(() => sections.map((s) => s.title), [sections]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(title: string): void {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  return (
    <nav
      className={cn(
        "h-full flex flex-col gap-4 px-3 py-6 overflow-y-auto scroll-area",
        className,
      )}
      style={{ background: "var(--color-surface-sunken)" }}
      aria-label="Documentation navigation"
    >
      {sections.map((section) => {
        const isCollapsed = collapsed[section.title] ?? false;
        return (
          <div key={section.title} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggle(section.title)}
              className="flex items-center justify-between gap-2 px-2 py-1
                         font-mono text-[10px] uppercase tracking-[0.18em]
                         text-[color:var(--color-ink-tertiary)] hover:text-[color:var(--color-ink-secondary)]
                         transition-colors"
              aria-expanded={!isCollapsed}
            >
              {section.title}
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  isCollapsed && "-rotate-90",
                )}
              />
            </button>
            <ul
              className={cn(
                "flex flex-col mt-1 gap-px overflow-hidden transition-[max-height,opacity] duration-200",
                isCollapsed ? "max-h-0 opacity-0" : "max-h-[1200px] opacity-100",
              )}
            >
              {section.items.map((it) => {
                const active = pathname === it.href;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={onNavigate}
                      className={cn(
                        "relative flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)]",
                        "text-[13px] transition-colors",
                        active
                          ? "bg-[color:var(--color-surface-raised)] text-[color:var(--color-ink-primary)] font-medium"
                          : "text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink-primary)] hover:bg-[color:var(--color-surface-raised)]",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full"
                          style={{ background: "var(--color-accent-electric)" }}
                        />
                      )}
                      <span className="pl-2">{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <div
        className="mt-auto rounded-[var(--radius-md)] border p-4"
        style={{
          borderColor: "var(--color-line-soft)",
          background: "var(--color-surface-raised)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
          Need help?
        </p>
        <p className="mt-2 text-[12px] leading-[1.45]" style={{ color: "var(--color-ink-secondary)" }}>
          Engineers are on Discord and Twitter.
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          <a
            href="https://discord.gg/atlasfi"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] hover:opacity-80"
            style={{ color: "var(--color-accent-electric)" }}
          >
            Discord →
          </a>
          <a
            href="https://x.com/atlas_fi"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] hover:opacity-80"
            style={{ color: "var(--color-accent-electric)" }}
          >
            Twitter →
          </a>
        </div>
      </div>

      <noscript>
        {/* Tab list still rendered so server response works without
            JS — collapse state simply defaults to expanded. */}
        <span hidden>{allTitles.join(" ")}</span>
      </noscript>
    </nav>
  );
}
