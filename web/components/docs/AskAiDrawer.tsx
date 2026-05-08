// Right-side drawer that the bottom "Ask a question" input opens.
// Backend is intentionally not wired — the drawer surfaces a
// "coming soon" state so the visual chrome lands now and the AI
// integration drops in behind it later.

"use client";

import { memo, useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/components/primitives";

export interface AskAiDrawerProps {
  open: boolean;
  onClose: () => void;
  initialPrompt?: string;
  children?: ReactNode;
}

function AskAiDrawerImpl({ open, onClose, initialPrompt }: AskAiDrawerProps): JSX.Element {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-[85] pointer-events-none",
        open && "pointer-events-auto",
      )}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
        style={{ background: "color-mix(in oklab, black 50%, transparent)", backdropFilter: "blur(2px)" }}
      />
      <aside
        role="dialog"
        aria-label="Ask the Atlas AI"
        className={cn(
          "absolute right-0 top-0 h-full w-full sm:w-[420px] flex flex-col",
          "border-l shadow-[0_24px_64px_rgba(0,0,0,0.45)]",
          "transition-transform duration-200 ease-[var(--ease-glide)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{
          background: "var(--color-surface-raised)",
          borderColor: "var(--color-line-medium)",
        }}
      >
        <header
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--color-line-soft)" }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
            Atlas assistant
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-[var(--radius-sm)] p-1 hover:bg-[color:var(--color-surface-base)]"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-4">
          {initialPrompt && (
            <div
              className="rounded-[var(--radius-md)] border px-3 py-2 text-[13px]"
              style={{
                borderColor: "var(--color-line-soft)",
                background: "var(--color-surface-sunken)",
                color: "var(--color-ink-secondary)",
              }}
            >
              {initialPrompt}
            </div>
          )}
          <div
            className="rounded-[var(--radius-md)] border p-5"
            style={{
              borderColor: "var(--color-line-soft)",
              background: "var(--color-surface-sunken)",
              color: "var(--color-ink-secondary)",
            }}
          >
            <p className="font-display text-[18px] leading-[1.3] text-[color:var(--color-ink-primary)] mb-2">
              AI assistant coming soon.
            </p>
            <p className="text-[13px] leading-[1.55]">
              The chat surface is wired to the docs index, but the
              backend retrieval pipeline ships in a follow-up. In the
              meantime, search the sidebar with{" "}
              <kbd className="font-mono text-[11px] rounded-[3px] border px-1 py-px" style={{ borderColor: "var(--color-line-soft)" }}>⌘K</kbd>
              .
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

export const AskAiDrawer = memo(AskAiDrawerImpl);
