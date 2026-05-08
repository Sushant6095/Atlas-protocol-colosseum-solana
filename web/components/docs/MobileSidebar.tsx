// Mobile drawer wrapper for DocsSidebar. Triggered from a hamburger
// button rendered alongside the breadcrumb on small viewports.

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/components/primitives";
import { DocsSidebar } from "./DocsSidebar";

export function MobileSidebar(): JSX.Element {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close on navigation so the user lands on the new page,
  // not on the sidebar that was showing it.
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden inline-flex items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-1.5
                   text-[12px] text-[color:var(--color-ink-secondary)]
                   hover:text-[color:var(--color-ink-primary)] transition-colors"
        style={{ borderColor: "var(--color-line-soft)" }}
        aria-label="Open navigation"
      >
        <Menu className="h-3.5 w-3.5" />
        Menu
      </button>

      <div
        className={cn("fixed inset-0 z-[80] lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
          style={{ background: "color-mix(in oklab, black 60%, transparent)" }}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 h-full w-[300px] max-w-[85vw] flex flex-col border-r",
            "transition-transform duration-200 ease-[var(--ease-glide)]",
            open ? "translate-x-0" : "-translate-x-full",
          )}
          style={{
            background: "var(--color-surface-sunken)",
            borderColor: "var(--color-line-medium)",
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-3 border-b"
            style={{ borderColor: "var(--color-line-soft)" }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--color-ink-tertiary)" }}>
              Documentation
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[var(--radius-sm)] p-1 hover:bg-[color:var(--color-surface-raised)]"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" style={{ color: "var(--color-ink-secondary)" }} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <DocsSidebar onNavigate={() => setOpen(false)} />
          </div>
        </aside>
      </div>
    </>
  );
}
