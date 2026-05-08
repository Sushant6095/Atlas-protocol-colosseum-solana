// Search bar in the top nav. ⌘K opens a fuzzy palette over the
// flat doc index — same data the sidebar consumes, so search and
// nav can never drift.

"use client";

import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/components/primitives";
import { FLAT_ITEMS } from "./nav";

function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 2 + (1 - q.length / Math.max(t.length, 1));
  let i = 0, score = 0;
  for (const ch of t) {
    if (ch === q[i]) {
      score += 1;
      i++;
      if (i === q.length) return 0.5 + score / Math.max(t.length, 1);
    }
  }
  return 0;
}

function DocsSearchImpl(): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent): void {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      setActive(0);
      setQuery("");
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const ranked = useMemo(() => {
    const scored = FLAT_ITEMS.map((it) => {
      const fields = [it.label, it.blurb ?? "", it.href];
      const s = fields.reduce((acc, f) => Math.max(acc, fuzzyScore(query, f)), 0);
      return { item: it, score: s };
    });
    return scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 24)
      .map((x) => x.item);
  }, [query]);

  function go(href: string): void {
    setOpen(false);
    router.push(href);
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(ranked.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = ranked[active];
      if (it) go(it.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 w-full max-w-[480px] h-9 rounded-[var(--radius-md)] border px-3",
          "text-[13px] text-[color:var(--color-ink-tertiary)] hover:text-[color:var(--color-ink-secondary)]",
          "border-[color:var(--color-line-soft)] hover:border-[color:var(--color-line-medium)]",
          "bg-[color:var(--color-surface-sunken)] transition-colors",
        )}
        aria-label="Search documentation"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search docs...</span>
        <kbd
          className="font-mono text-[10px] uppercase tracking-[0.12em] rounded-[4px] border px-1.5 py-0.5"
          style={{
            borderColor: "var(--color-line-soft)",
            color: "var(--color-ink-tertiary)",
          }}
        >
          ⌘ K
        </kbd>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-0"
            style={{ background: "color-mix(in oklab, black 60%, transparent)", backdropFilter: "blur(4px)" }}
          />
          <div
            className="relative z-10 w-full max-w-[600px] rounded-[var(--radius-md)] border overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
            style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-line-medium)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 border-b" style={{ borderColor: "var(--color-line-soft)" }}>
              <Search className="h-4 w-4" style={{ color: "var(--color-ink-tertiary)" }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onInputKey}
                placeholder="Search docs..."
                className="flex-1 bg-transparent py-3 outline-none text-[14px]"
                style={{ color: "var(--color-ink-primary)" }}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--color-ink-tertiary)" }}>
                Esc
              </span>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {ranked.length === 0 && (
                <li className="px-3 py-6 text-center text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
                  No matches
                </li>
              )}
              {ranked.map((it, i) => (
                <li
                  key={it.href}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(it.href)}
                  className={cn(
                    "px-3 py-2 cursor-pointer text-[13px] flex flex-col gap-0.5",
                    i === active && "bg-[color:var(--color-surface-base)]",
                  )}
                  style={{ color: "var(--color-ink-primary)" }}
                >
                  <span className="font-medium">{it.label}</span>
                  {it.blurb && (
                    <span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                      {it.blurb}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

export const DocsSearch = memo(DocsSearchImpl);
