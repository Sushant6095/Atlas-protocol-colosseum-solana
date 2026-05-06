// AlertCenter — flyout list of alerts (Phase 21 §11).
//
// Reads recent alert events from the realtime store; opens via the
// header bell button. Permission prompt for browser push fires only
// after the user has opened this surface at least once — no surprise
// prompts.

"use client";

import { memo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useUiStore } from "@/lib/ui-store";
import { useRealtimeStore } from "@/lib/realtime";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/components/primitives";
import { AlertPill } from "@/components/primitives/AlertPill";
import { transitions } from "@/lib/motion";

function AlertCenterImpl() {
  const open = useUiStore((s) => s.alertCenterOpen);
  const close = useUiStore((s) => s.setAlertCenterOpen);

  const alerts = useRealtimeStore(
    useShallow((s) => {
      const items: { topic: string; ts: number; text: string }[] = [];
      for (const [topic, t] of Object.entries(s.topics)) {
        if (!topic.endsWith(".alert") || !t.snapshot) continue;
        const payload = t.snapshot.payload as { text?: string } | undefined;
        items.push({
          topic,
          ts: t.snapshot.emitted_at_ms ?? 0,
          text: payload?.text ?? "(alert)",
        });
      }
      return items.sort((a, b) => b.ts - a.ts).slice(0, 50);
    }),
  );

  // Mark "user opened" so the next push-permission prompt is allowed.
  useEffect(() => {
    if (open && typeof window !== "undefined") {
      window.localStorage.setItem("atlas.push.userOpenedAlerts", "1");
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: transitions.quickPress }}
            exit={{ opacity: 0, transition: transitions.quickPress }}
            className="fixed inset-0 bg-[color:var(--color-surface-base)]/40 z-[var(--z-drawer,200)]"
            onClick={() => close(false)}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0, transition: transitions.slowPanel }}
            exit={{ x: "100%", transition: transitions.quickPress }}
            className={cn(
              "fixed right-0 top-0 bottom-0 w-[360px] z-[var(--z-drawer,200)]",
              "border-l border-[color:var(--color-line-medium)] bg-[color:var(--color-surface-raised)]",
              "flex flex-col",
            )}
            role="dialog"
            aria-label="Alert center"
          >
            <header className="flex items-center justify-between px-4 h-12 border-b border-[color:var(--color-line-soft)]">
              <span className="text-[12px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                alert center
              </span>
              <button
                type="button"
                onClick={() => close(false)}
                aria-label="Close alert center"
                className="h-7 w-7 grid place-items-center rounded-[var(--radius-xs)] text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 overflow-auto scroll-area px-3 py-3 space-y-2">
              {alerts.length === 0 ? (
                <p className="text-[12px] text-[color:var(--color-ink-tertiary)] px-2 py-4">
                  No recent alerts. Subscribe a vault to start receiving them.
                </p>
              ) : (
                alerts.map((a) => (
                  <article
                    key={`${a.topic}:${a.ts}`}
                    className="rounded-[var(--radius-sm)] border border-[color:var(--color-line-soft)] bg-[color:var(--color-surface-base)] p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <AlertPill severity="warn">alert</AlertPill>
                      <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
                        {a.topic}
                      </span>
                    </div>
                    <p className="text-[13px] text-[color:var(--color-ink-secondary)]">
                      {a.text}
                    </p>
                  </article>
                ))
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export const AlertCenter = memo(AlertCenterImpl);
AlertCenter.displayName = "AlertCenter";
