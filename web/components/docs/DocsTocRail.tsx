// Right rail. "On this page" outline derived from H2/H3 nodes inside
// `<article>` (the DocPage main element). IntersectionObserver
// highlights the section currently in view.

"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/components/primitives";

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function DocsTocRail(): JSX.Element | null {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const article = document.querySelector("article[data-doc-article]");
    if (!article) return;

    // Collect headings + ensure they all have an id so anchor links work.
    const nodes = Array.from(article.querySelectorAll("h2, h3")) as HTMLElement[];
    const list: Heading[] = nodes.map((el) => {
      if (!el.id) {
        el.id = (el.textContent || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60);
      }
      return {
        id: el.id,
        text: el.textContent || "",
        level: el.tagName === "H3" ? 3 : 2,
      };
    });
    setHeadings(list);

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  const onClick = useCallback((id: string) => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${id}`);
    };
  }, []);

  if (headings.length === 0) return null;

  return (
    <aside
      className="sticky top-[112px] hidden xl:flex flex-col gap-3 w-[240px] py-2"
      aria-label="On this page"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em]"
         style={{ color: "var(--color-ink-tertiary)" }}>
        On this page
      </p>
      <ul className="flex flex-col gap-px">
        {headings.map((h) => {
          const isActive = active === h.id;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                onClick={onClick(h.id)}
                className={cn(
                  "relative block py-1 text-[13px] transition-colors",
                  h.level === 3 && "pl-4",
                  isActive
                    ? "text-[color:var(--color-ink-primary)]"
                    : "text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink-primary)]",
                )}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute -left-3 top-1.5 bottom-1.5 w-[1px]"
                    style={{ background: "var(--color-accent-electric)" }}
                  />
                )}
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
