// ProofLifecycle — horizontal animated SVG diagram of the 8-stage
// pipeline (Phase 22 §1.3). Pure SVG; no 3D. Animation budget:
// one RAF, fits the operator-surface ceiling.

"use client";

import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/components/primitives";
import { transitions } from "@/lib/motion";

export const PROOF_STAGES = [
  { id: "ingest",    label: "ingest",    sloMs: 1_500,  doc: "Phase 02 §3 — quorum read budget" },
  { id: "infer",     label: "infer",     sloMs: 250,    doc: "Phase 01 §13 — ranker p99" },
  { id: "consensus", label: "consensus", sloMs: 250,    doc: "Phase 01 §5 — 7-agent consensus" },
  { id: "allocate",  label: "allocate",  sloMs: 100,    doc: "Phase 01 §6 — bounded LIE allocator" },
  { id: "explain",   label: "explain",   sloMs: 50,     doc: "Phase 01 §7 — canonical explanation" },
  { id: "prove",     label: "prove",     sloMs: 75_000, doc: "Phase 01 §10 — SP1 proof gen p99 75s" },
  { id: "verify",    label: "verify",    sloMs: 150,    doc: "Phase 01 §13 — verifier p99 280k CU" },
  { id: "settle",    label: "settle",    sloMs: 4_000,  doc: "Phase 07 §10 — bundle land p99 4s" },
] as const;

export interface ProofLifecycleProps {
  className?: string;
  /** Auto-cycle the pulse across stages. Pauses on hover. */
  autoplay?: boolean;
  /** Stage to highlight (overrides autoplay). */
  highlight?: typeof PROOF_STAGES[number]["id"];
}

function ProofLifecycleImpl({ className, autoplay = true, highlight }: ProofLifecycleProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!autoplay || paused) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % PROOF_STAGES.length);
    }, 1_000);
    return () => clearInterval(id);
  }, [autoplay, paused]);

  const overriddenIdx = highlight
    ? PROOF_STAGES.findIndex((s) => s.id === highlight)
    : -1;
  const idx = overriddenIdx >= 0 ? overriddenIdx : active;

  return (
    <div
      className={cn("w-full", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="grid grid-cols-8 gap-2 items-center">
        {PROOF_STAGES.map((s, i) => {
          const lit = i === idx;
          return (
            <div key={s.id} className="flex flex-col items-center gap-2 group">
              <motion.div
                className={cn(
                  "h-12 w-12 rounded-full grid place-items-center",
                  "border border-[color:var(--color-line-medium)] bg-[color:var(--color-surface-raised)]",
                )}
                animate={
                  lit
                    ? {
                        boxShadow: "0 0 24px rgba(166,130,255,0.45)",
                        borderColor: "rgba(166,130,255,0.65)",
                        transition: transitions.mediumReveal,
                      }
                    : {
                        boxShadow: "none",
                        borderColor: "rgba(255,255,255,0.08)",
                        transition: transitions.quickPress,
                      }
                }
              >
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-[0.08em] font-mono",
                    lit
                      ? "text-[color:var(--color-accent-zk)]"
                      : "text-[color:var(--color-ink-tertiary)]",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </motion.div>
              <span
                className={cn(
                  "text-[11px]",
                  lit
                    ? "text-[color:var(--color-ink-primary)]"
                    : "text-[color:var(--color-ink-secondary)]",
                )}
              >
                {s.label}
              </span>
              <span className="hidden group-hover:block absolute mt-20 px-2 py-1 rounded-[var(--radius-xs)] bg-[color:var(--color-surface-raised)] border border-[color:var(--color-line-medium)] text-[10px] font-mono text-[color:var(--color-ink-secondary)] z-10">
                p99 ≤ {fmtMs(s.sloMs)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="relative mt-4 h-px bg-[color:var(--color-line-soft)]">
        <motion.div
          className="absolute top-0 h-px bg-[color:var(--color-accent-zk)]"
          animate={{
            width: `${((idx + 1) / PROOF_STAGES.length) * 100}%`,
            transition: transitions.mediumReveal,
          }}
        />
      </div>
    </div>
  );
}

function fmtMs(ms: number): string {
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(ms >= 10_000 ? 0 : 1)}s`;
  return `${ms}ms`;
}

export const ProofLifecycle = memo(ProofLifecycleImpl);
ProofLifecycle.displayName = "ProofLifecycle";
