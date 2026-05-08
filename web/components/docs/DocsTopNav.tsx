// Top of every /docs/* page. Logo + wordmark + /docs badge on the
// left, search in the centre, "Ask AI" + theme toggle + "Open App"
// on the right. Below this row sits the 7-tab strip that switches
// the sidebar context.
//
// The active tab is derived from the current pathname via
// `tabForPath`, so deep-linking to any doc page lands on the right
// tab without needing controlled state.

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PleiadesIcon, cn } from "@/components/primitives";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TABS, tabForPath, type DocTabId } from "./nav";
import { DocsSearch } from "./DocsSearch";

export function DocsTopNav(): JSX.Element {
  const pathname = usePathname() ?? "/docs";
  const router = useRouter();
  const activeTab = tabForPath(pathname);

  function onTab(id: DocTabId): void {
    // Tab click jumps to the canonical first-item href for that tab.
    // The sidebar then renders that tab's section list. We avoid
    // routing to a nonexistent "tab home" route — stay declarative.
    const TAB_HOME: Record<DocTabId, string> = {
      overview:     "/docs",
      protocol:     "/docs/protocol",
      vault:        "/docs/vault",
      treasury:     "/docs/treasury",
      developers:   "/docs/api",
      integrations: "/docs/integrations",
      philosophy:   "/docs/philosophy",
    };
    router.push(TAB_HOME[id]);
  }

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{
        background: "color-mix(in oklab, var(--color-surface-base) 88%, transparent)",
        borderColor: "var(--color-line-soft)",
      }}
    >
      <div className="mx-auto max-w-[1440px] px-4 lg:px-6">
        <div className="flex items-center gap-4 h-14">
          <Link href="/docs" className="flex items-center gap-2.5 shrink-0" aria-label="Atlas docs home">
            <PleiadesIcon className="h-6 w-6" />
            <span className="font-display font-semibold text-[15px] tracking-tight text-[color:var(--color-ink-primary)]">
              Atlas
            </span>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.16em] rounded-[4px] border px-1.5 py-0.5"
              style={{
                borderColor: "var(--color-line-soft)",
                color: "var(--color-ink-tertiary)",
              }}
            >
              /docs
            </span>
          </Link>

          <div className="flex-1 flex justify-center">
            <DocsSearch />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                // Open Ask drawer via custom event so the sticky bar
                // owns the drawer mount and we don't re-instantiate
                // it from two places.
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("atlas:ask-ai-open"));
                }
              }}
              className="hidden md:inline-flex items-center gap-1.5 rounded-[var(--radius-md)] h-9 px-3 text-[13px]
                         text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink-primary)]
                         hover:bg-[color:var(--color-surface-raised)] transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Ask AI
            </button>
            <ThemeToggle />
            <Link
              href="/vaults"
              className="inline-flex items-center h-9 px-3.5 rounded-[var(--radius-md)] text-[13px] font-medium text-white
                         bg-[linear-gradient(90deg,var(--color-accent-zk),var(--color-accent-electric))]
                         shadow-[0_0_24px_rgba(46,160,255,0.20)] hover:opacity-95 transition-opacity"
            >
              Open App
            </Link>
          </div>
        </div>

        <nav className="flex items-center gap-1 -mb-px overflow-x-auto scroll-area">
          {TABS.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTab(t.id)}
                className={cn(
                  "relative h-10 px-3 text-[13px] font-medium transition-colors flex-none",
                  isActive
                    ? "text-[color:var(--color-ink-primary)]"
                    : "text-[color:var(--color-ink-tertiary)] hover:text-[color:var(--color-ink-secondary)]",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {t.label}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-3 right-3 bottom-0 h-[2px]"
                    style={{ background: "var(--color-accent-electric)" }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
