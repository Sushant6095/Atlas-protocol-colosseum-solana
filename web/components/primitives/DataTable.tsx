// <DataTable> — sort + filter + pagination over a row array.
//
// Keeps the markup minimal (semantic <table>) so it works with the
// surrounding Panel chrome. Sorting is uncontrolled by default;
// filter is a single global string match against any column's
// `searchValue` (or the rendered string fallback).
//
// Generic over the row type so consumers stay strongly typed.

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowUp, ArrowDown, Search } from "lucide-react";
import { cn } from "./cn";

export interface DataColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortBy?: (row: T) => number | string;
  searchValue?: (row: T) => string;
  align?: "left" | "right" | "center";
  width?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T, idx: number) => string;
  pageSize?: number;
  searchable?: boolean;
  emptyState?: ReactNode;
  className?: string;
}

interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export function DataTable<T>({
  rows, columns, rowKey, pageSize = 10, searchable = true, emptyState, className,
}: DataTableProps<T>): JSX.Element {
  const [sort, setSort] = useState<SortState | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      columns.some((c) => {
        const val = c.searchValue ? c.searchValue(r) : (() => {
          const out = c.render(r);
          return typeof out === "string" || typeof out === "number" ? String(out) : "";
        })();
        return val.toLowerCase().includes(q);
      }),
    );
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortBy) return filtered;
    const fn = col.sortBy;
    const copy = filtered.slice();
    copy.sort((a, b) => {
      const av = fn(a), bv = fn(b);
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, columns, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  function toggleSort(key: string): void {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  }

  return (
    <div className={cn("w-full flex flex-col gap-3", className)}>
      {searchable && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Filter…"
            className="w-full max-w-[280px] rounded-[var(--radius-sm)] border pl-7 pr-2 py-1.5 text-[12px] font-mono outline-none"
            style={{
              background: "var(--color-surface-sunken)",
              borderColor: "var(--color-line-soft)",
              color: "var(--color-ink-primary)",
            }}
          />
        </div>
      )}
      <div className="overflow-x-auto rounded-[var(--radius-md)] border" style={{ borderColor: "var(--color-line-soft)" }}>
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr style={{ background: "var(--color-surface-sunken)" }}>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    style={{ width: c.width, color: "var(--color-ink-tertiary)" }}
                    className={cn(
                      "px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                    )}
                  >
                    {c.sortBy ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-[color:var(--color-ink-secondary)]"
                      >
                        {c.header}
                        {active && (sort!.dir === "asc"
                          ? <ArrowUp className="h-3 w-3" />
                          : <ArrowDown className="h-3 w-3" />
                        )}
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center" style={{ color: "var(--color-ink-tertiary)" }}>
                  {emptyState ?? "No rows"}
                </td>
              </tr>
            ) : visible.map((row, i) => (
              <tr key={rowKey(row, start + i)} className="border-t" style={{ borderColor: "var(--color-line-soft)" }}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 py-2",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                    )}
                    style={{ color: "var(--color-ink-primary)" }}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between font-mono text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
          <span>{sorted.length} rows · page {safePage} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="rounded-[var(--radius-sm)] border px-2 py-0.5 disabled:opacity-40 hover:bg-[color:var(--color-surface-raised)]"
              style={{ borderColor: "var(--color-line-soft)" }}
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="rounded-[var(--radius-sm)] border px-2 py-0.5 disabled:opacity-40 hover:bg-[color:var(--color-surface-raised)]"
              style={{ borderColor: "var(--color-line-soft)" }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
