// <CommandPalette> — ⌘K / Ctrl-K fuzzy nav surface.
//
// Renders a centered overlay with a search input and a flat result
// list. Items are grouped by `section`. Keyboard: ↑/↓ to move,
// Enter to invoke, Escape to dismiss. Fuzzy match is sub-sequence
// based — small enough to stay in this file, big enough to feel
// snappy on a 200-item list.

"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type KeyboardEvent, type ReactNode,
} from "react";
import { Search } from "lucide-react";
import { cn } from "./cn";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  section?: string;
  icon?: ReactNode;
  keywords?: string[];
  onRun: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
}

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

export function CommandPalette({
  open, onOpenChange, items, placeholder = "Search Atlas…",
}: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const ranked = useMemo(() => {
    const scored = items.map((it) => {
      const fields = [it.label, ...(it.keywords ?? [])];
      const s = fields.reduce((acc, f) => Math.max(acc, fuzzyScore(query, f)), 0);
      return { item: it, score: s };
    });
    return scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);
  }, [items, query]);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      setActive(0);
      setQuery("");
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(ranked.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = ranked[active];
      if (it) {
        it.onRun();
        onOpenChange(false);
      }
    }
  }, [ranked, active, onOpenChange]);

  if (!open) return null;

  const grouped = ranked.reduce<Record<string, CommandItem[]>>((acc, it) => {
    const k = it.section ?? "Actions";
    (acc[k] ??= []).push(it);
    return acc;
  }, {});

  let flatIdx = -1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4"
      onClick={() => onOpenChange(false)}
    >
      <div className="absolute inset-0" style={{ background: "color-mix(in oklab, black 60%, transparent)", backdropFilter: "blur(4px)" }} />
      <div
        role="combobox"
        aria-expanded="true"
        aria-controls="cmdk-listbox"
        className={cn(
          "relative z-10 w-full max-w-[560px] rounded-[var(--radius-md)] border overflow-hidden",
          "shadow-[0_24px_64px_rgba(0,0,0,0.45)]",
        )}
        style={{
          background: "var(--color-surface-raised)",
          borderColor: "var(--color-line-medium)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 border-b" style={{ borderColor: "var(--color-line-soft)" }}>
          <Search className="h-4 w-4" style={{ color: "var(--color-ink-tertiary)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent py-3 outline-none text-[14px]"
            style={{ color: "var(--color-ink-primary)" }}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--color-ink-tertiary)" }}>
            Esc
          </span>
        </div>
        <ul id="cmdk-listbox" role="listbox" className="max-h-[60vh] overflow-y-auto py-1">
          {ranked.length === 0 && (
            <li className="px-3 py-6 text-center text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
              No matches
            </li>
          )}
          {Object.entries(grouped).map(([section, list]) => (
            <li key={section}>
              <div
                className="px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.12em]"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                {section}
              </div>
              <ul>
                {list.map((it) => {
                  flatIdx += 1;
                  const isActive = flatIdx === active;
                  return (
                    <li
                      key={it.id}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(flatIdx)}
                      onClick={() => { it.onRun(); onOpenChange(false); }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 cursor-pointer text-[13px]",
                        isActive && "bg-[color:var(--color-surface-base)]",
                      )}
                      style={{ color: "var(--color-ink-primary)" }}
                    >
                      {it.icon && <span className="opacity-70">{it.icon}</span>}
                      <span className="flex-1">{it.label}</span>
                      {it.hint && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--color-ink-tertiary)" }}>
                          {it.hint}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
