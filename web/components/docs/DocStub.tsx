// Default body for a stubbed doc page. Wraps DocPage with the
// "Documentation in progress" callout the spec mandates and links
// to the rest of the active tab so the page never feels like a
// dead-end.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { DocPage, siblingsFor } from "./DocPage";

export interface DocStubProps {
  title: string;
  description: string;
  /** Optional one-paragraph intro shown above the callout. */
  intro?: string;
}

export function DocStub({ title, description, intro }: DocStubProps): JSX.Element {
  const pathname = usePathname() ?? "/docs";
  const { tabLabel, siblings } = siblingsFor(pathname);
  const md = `---\ntitle: "${title}"\ndescription: "${description}"\n---\n# ${title}\n\n> Documentation in progress. Real content ships in the next PR.\n\n${intro ?? description}\n`;

  return (
    <DocPage title={title} description={description} markdown={md}>
      {intro && (
        <p className="mb-6">{intro}</p>
      )}

      <div
        className="not-prose flex items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 my-2"
        style={{
          borderColor: "color-mix(in oklab, var(--color-accent-warn) 35%, transparent)",
          background: "color-mix(in oklab, var(--color-accent-warn) 8%, transparent)",
        }}
      >
        <Clock className="h-4 w-4 mt-0.5" style={{ color: "var(--color-accent-warn)" }} />
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em]"
             style={{ color: "var(--color-accent-warn)" }}>
            Documentation in progress
          </p>
          <p className="text-[13px] leading-[1.5]" style={{ color: "var(--color-ink-secondary)" }}>
            Real content ships in the next PR. The page outline and
            placement are stable — bookmark this URL.
          </p>
        </div>
      </div>

      {siblings.length > 0 && (
        <section className="not-prose mt-12">
          <h2 className="font-display font-semibold text-[18px] mb-4"
              style={{ color: "var(--color-ink-primary)" }}>
            Other pages in {tabLabel}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {siblings.slice(0, 8).map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="group flex items-start gap-3 rounded-[var(--radius-md)] border px-3 py-2.5
                             transition-colors hover:border-[color:var(--color-line-medium)]"
                  style={{
                    borderColor: "var(--color-line-soft)",
                    background: "var(--color-surface-raised)",
                  }}
                >
                  <ArrowRight
                    className="h-3.5 w-3.5 mt-1 transition-transform duration-200 group-hover:translate-x-0.5"
                    style={{ color: "var(--color-accent-electric)" }}
                  />
                  <span className="flex flex-col">
                    <span className="text-[13px] font-medium" style={{ color: "var(--color-ink-primary)" }}>
                      {s.label}
                    </span>
                    {s.blurb && (
                      <span className="text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
                        {s.blurb}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </DocPage>
  );
}
