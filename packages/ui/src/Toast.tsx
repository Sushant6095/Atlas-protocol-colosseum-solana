// <Toast> — one-shot status pill in the bottom-right corner.
//
// Imperative API via `useToast()`. Stacks vertically, auto-dismisses
// after 3.6s, accent-driven by tone. ToastProvider mounts a single
// portal-style host; pages wrap children with it once at the shell
// level (Providers / RootLayout).

"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "./cn";

export type ToastTone = "success" | "warn" | "error" | "info";

export interface ToastInput {
  title: string;
  body?: string;
  tone?: ToastTone;
  durationMs?: number;
  href?: { label: string; url: string };
}

interface Toast extends Required<Pick<ToastInput, "title">> {
  id: number;
  body?: string;
  tone: ToastTone;
  durationMs: number;
  href?: { label: string; url: string };
}

interface ToastApi {
  push: (t: ToastInput) => number;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastApi | null>(null);

const TONE: Record<ToastTone, { fg: string; ring: string; Icon: typeof CheckCircle2 }> = {
  success: { fg: "var(--color-accent-execute)",  ring: "rgba(60,227,154,0.30)",  Icon: CheckCircle2 },
  warn:    { fg: "var(--color-accent-warn)",     ring: "rgba(247,185,85,0.30)",  Icon: AlertTriangle },
  error:   { fg: "var(--color-accent-danger)",   ring: "rgba(255,97,102,0.30)",  Icon: XCircle },
  info:    { fg: "var(--color-accent-electric)", ring: "rgba(46,160,255,0.30)",  Icon: Info },
};

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [items, setItems] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((input: ToastInput): number => {
    const id = ++idRef.current;
    const toast: Toast = {
      id,
      title: input.title,
      body: input.body,
      tone: input.tone ?? "info",
      durationMs: input.durationMs ?? 3600,
      href: input.href,
    };
    setItems((xs) => [...xs, toast]);
    return id;
  }, []);

  const api = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <ToastHost items={items} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      push: () => {
        if (typeof console !== "undefined") console.warn("useToast() called outside ToastProvider");
        return -1;
      },
      dismiss: () => {},
    };
  }
  return ctx;
}

function ToastHost({ items, onDismiss }: { items: Toast[]; onDismiss: (id: number) => void }): JSX.Element {
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none"
    >
      {items.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }): JSX.Element {
  const tone = TONE[toast.tone];
  useEffect(() => {
    const id = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(id);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto min-w-[260px] max-w-[360px] rounded-[var(--radius-md)] border",
        "px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.32)]",
        "animate-[atlas-toast-in_180ms_ease-out]",
      )}
      style={{
        background: "var(--color-surface-raised)",
        borderColor: tone.ring,
      }}
    >
      <div className="flex items-start gap-2">
        <tone.Icon className="h-4 w-4 mt-0.5" style={{ color: tone.fg }} />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: tone.fg }}>
            {toast.title}
          </div>
          {toast.body && (
            <div className="mt-0.5 text-[12px] leading-[16px]" style={{ color: "var(--color-ink-secondary)" }}>
              {toast.body}
            </div>
          )}
          {toast.href && (
            <a
              href={toast.href.url}
              className="mt-1 inline-flex font-mono text-[10px] uppercase tracking-[0.12em] hover:opacity-80"
              style={{ color: tone.fg }}
            >
              {toast.href.label} →
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="text-[10px] uppercase tracking-[0.12em] opacity-60 hover:opacity-100"
          style={{ color: "var(--color-ink-tertiary)" }}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export const toastKeyframes = `
@keyframes atlas-toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
`.trim();
