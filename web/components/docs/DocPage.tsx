// Standard doc page chrome: breadcrumb → H1 row (with copy button)
// → optional description → body → ask-question bar.
//
// Pages opt into this by exporting a server component that delegates
// to DocPage:
//
//   <DocPage title="..." description="..." markdown={mdSource}>
//     ...body...
//   </DocPage>

"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import { itemForPath, FLAT_ITEMS, TABS, tabForPath } from "./nav";
import { CopyPageButton } from "./CopyPageButton";
import { AskQuestionBar } from "./AskQuestionBar";

export interface DocPageProps {
  title: string;
  description?: ReactNode;
  /** Plain markdown source for the Copy page button. */
  markdown: string;
  children: ReactNode;
}

interface Crumb { label: string; href?: string; }

function buildCrumbs(pathname: string): Crumb[] {
  const tabId = tabForPath(pathname);
  const tab = TABS.find((t) => t.id === tabId);
  const item = itemForPath(pathname);
  const out: Crumb[] = [{ label: "Docs", href: "/docs" }];
  if (tab && tabId !== "overview") out.push({ label: tab.label });
  if (item && item.href !== "/docs") out.push({ label: item.label });
  return out;
}

export function DocPage({ title, description, markdown, children }: DocPageProps): JSX.Element {
  const pathname = usePathname() ?? "/docs";
  const crumbs = useMemo(() => buildCrumbs(pathname), [pathname]);

  return (
    <>
      <article
        data-doc-article
        className="prose prose-invert max-w-none flex flex-col"
      >
        <nav aria-label="Breadcrumb" className="not-prose flex items-center gap-1.5 text-[13px] mb-6"
             style={{ color: "var(--color-ink-tertiary)" }}>
          {crumbs.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              {c.href ? (
                <Link href={c.href} className="hover:text-[color:var(--color-ink-secondary)] transition-colors">
                  {c.label}
                </Link>
              ) : (
                <span style={{ color: "var(--color-ink-secondary)" }}>{c.label}</span>
              )}
            </span>
          ))}
        </nav>

        <header className="not-prose flex items-start justify-between gap-6 mb-4">
          <h1
            className="font-display font-semibold tracking-tight leading-[1.1] text-[clamp(2rem,4vw,2.5rem)]"
            style={{ color: "var(--color-ink-primary)" }}
          >
            {title}
          </h1>
          <CopyPageButton markdown={markdown} className="shrink-0 mt-2" />
        </header>

        {description && (
          <p
            className="not-prose font-body text-[18px] leading-[1.55] mb-10"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            {description}
          </p>
        )}

        <div className="prose-content text-[15px] leading-[1.65]" style={{ color: "var(--color-ink-secondary)" }}>
          {children}
        </div>
      </article>

      <AskQuestionBar />
    </>
  );
}

/** Collect related pages from the current tab — used by DocStub. */
export function siblingsFor(pathname: string): { tabLabel: string; siblings: typeof FLAT_ITEMS } {
  const tabId = tabForPath(pathname);
  const tab = TABS.find((t) => t.id === tabId);
  const siblings = FLAT_ITEMS.filter((it) => it.tab === tabId && it.href !== pathname);
  return { tabLabel: tab?.label ?? "Docs", siblings };
}
