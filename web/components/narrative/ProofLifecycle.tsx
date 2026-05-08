// ProofLifecycle — eight-stage proof pipeline ribbon (Phase 22 §1.3).
//
// Each stage is one numbered circle on a horizontal line. The
// surface is the centerpiece of the "proof lifecycle" section on
// the landing — it has to read as alive without becoming a
// distraction.
//
// Choreography:
//   1. Mount: stagger fade+rise (40ms per circle, 8px → 0).
//   2. Auto-advance: 800ms between active stages, 0 → 7 → loop.
//      Pauses on hover anywhere in the ribbon.
//   3. Active circle: zk border, radial-gradient fill, 24px zk
//      box-shadow, scale 1.08, label & numeral fully opaque.
//   4. Inactive circles: line.strong border, surface.raised bg,
//      opacity 0.6.
//   5. Connector lines: the segment between previous-active and
//      active glows zk→electric at full; others sit at 0.4 opacity
//      in line.soft.
//   6. Hover a circle: tooltip with name (mono), p99 latency
//      budget, and the public-input commitment the stage produces.

"use client";

import { memo, useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/components/primitives";

interface Stage {
  id: string;
  label: string;
  /** p99 latency budget in ms (Phase 01 §13). */
  sloMs: number;
  /** Public-input commitment field this stage emits. */
  pubInputField: string;
  doc: string;
}

export const PROOF_STAGES: readonly Stage[] = [
  { id: "ingest",    label: "ingest",    sloMs: 1_500,  pubInputField: "quorum_inputs_root",      doc: "Phase 02 §3 — quorum read budget" },
  { id: "features",  label: "features",  sloMs: 250,    pubInputField: "features_commitment",     doc: "Phase 03 §4 — deterministic feature pipeline" },
  { id: "consensus", label: "consensus", sloMs: 250,    pubInputField: "ensemble_commitment",     doc: "Phase 01 §5 — 7-agent consensus" },
  { id: "allocate",  label: "allocate",  sloMs: 100,    pubInputField: "target_ratios",           doc: "Phase 01 §6 — bounded LIE allocator" },
  { id: "explain",   label: "explain",   sloMs: 50,     pubInputField: "explanation_hash",        doc: "Phase 01 §7 — canonical explanation" },
  { id: "prove",     label: "prove",     sloMs: 75_000, pubInputField: "proof_root",              doc: "Phase 01 §10 — SP1 proof gen p99 75s" },
  { id: "verify",    label: "verify",    sloMs: 150,    pubInputField: "settlement_postcondition",doc: "Phase 01 §13 — verifier p99 280k CU" },
  { id: "settle",    label: "settle",    sloMs: 4_000,  pubInputField: "bundle_signature",        doc: "Phase 07 §10 — bundle land p99 4s" },
] as const;

export interface ProofLifecycleProps {
  className?: string;
  /** Auto-cycle the active stage. Pauses on hover. Default true. */
  autoplay?: boolean;
  /** Force-pin a stage as active (overrides autoplay). */
  highlight?: typeof PROOF_STAGES[number]["id"];
}

const ENTRY_STAGGER_S = 0.04;
const TICK_MS = 800;

const enterVariants: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: {
      delay: i * ENTRY_STAGGER_S,
      duration: 0.32,
      ease: [0.20, 0.80, 0.20, 1.00],
    },
  }),
};

function ProofLifecycleImpl({
  className, autoplay = true, highlight,
}: ProofLifecycleProps): JSX.Element {
  const [active, setActive] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const paused = hoveredIdx != null;

  useEffect(() => {
    if (!autoplay || paused || highlight) return;
    const t = setInterval(() => {
      setActive((i) => (i + 1) % PROOF_STAGES.length);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [autoplay, paused, highlight]);

  const pinned = highlight ? PROOF_STAGES.findIndex((s) => s.id === highlight) : -1;
  const idx = pinned >= 0 ? pinned : active;
  const previousIdx = (idx - 1 + PROOF_STAGES.length) % PROOF_STAGES.length;

  return (
    <div className={cn("w-full select-none", className)}>
      {/* Connector + circles share the same grid so the line slips
          exactly through the centre of every node. */}
      <div className="relative">
        {/* Base connector — sits behind every circle. */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px"
          style={{ background: "color-mix(in oklab, var(--color-line-soft) 40%, transparent)" }}
        />

        {/* Active connector — gradient zk → electric over the
            previous-to-current span. Wraps around when looping. */}
        <ActiveConnector idx={idx} previousIdx={previousIdx} />

        <ol className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${PROOF_STAGES.length}, minmax(0, 1fr))` }}>
          {PROOF_STAGES.map((s, i) => (
            <StageNode
              key={s.id}
              stage={s}
              index={i}
              active={i === idx}
              dim={i !== idx}
              onHoverStart={() => setHoveredIdx(i)}
              onHoverEnd={() => setHoveredIdx((cur) => (cur === i ? null : cur))}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

function StageNode({
  stage, index, active, dim, onHoverStart, onHoverEnd,
}: {
  stage: Stage;
  index: number;
  active: boolean;
  dim: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}): JSX.Element {
  const numeral = String(index + 1).padStart(2, "0");

  return (
    <li className="relative flex flex-col items-center gap-3">
      <motion.div
        className="group relative"
        custom={index}
        initial="hidden"
        animate="visible"
        variants={enterVariants}
        onHoverStart={onHoverStart}
        onHoverEnd={onHoverEnd}
      >
        <motion.button
          type="button"
          aria-label={`${stage.label} — ${fmtMs(stage.sloMs)} p99`}
          className={cn(
            "h-14 w-14 rounded-full grid place-items-center",
            "border focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-zk)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-base)]",
            "transition-[box-shadow,opacity] duration-[var(--duration-medium)] ease-[var(--ease-glide)]",
          )}
          animate={
            active
              ? {
                  borderColor: "rgba(166,130,255,1)",
                  boxShadow: "0 0 24px rgba(166,130,255,0.55)",
                  scale: 1.08,
                  opacity: 1,
                  background:
                    "radial-gradient(circle at 50% 50%, rgba(166,130,255,0.30) 0%, rgba(166,130,255,0.10) 30%, transparent 70%)",
                }
              : {
                  borderColor: "rgba(255,255,255,0.16)",
                  boxShadow: "0 0 0 rgba(166,130,255,0)",
                  scale: 1,
                  opacity: dim ? 0.6 : 1,
                  background: "var(--color-surface-raised)",
                }
          }
          transition={{ duration: 0.30, ease: [0.20, 0.80, 0.20, 1.00] }}
        >
          <span
            className={cn(
              "font-mono text-[11px] tracking-[0.08em] uppercase",
              active
                ? "text-[color:var(--color-accent-zk)]"
                : "text-[color:var(--color-ink-tertiary)]",
            )}
          >
            {numeral}
          </span>
        </motion.button>

        {/* Tooltip — visible on hover/focus only. */}
        <StageTooltip stage={stage} />
      </motion.div>

      <span
        className={cn(
          "font-mono text-[11px] lowercase tracking-[0.04em]",
          active
            ? "text-[color:var(--color-ink-primary)]"
            : "text-[color:var(--color-ink-secondary)]",
        )}
      >
        {stage.label}
      </span>
    </li>
  );
}

function StageTooltip({ stage }: { stage: Stage }): JSX.Element {
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-10",
        "min-w-[220px] max-w-[260px] px-3 py-2.5 rounded-[var(--radius-md)]",
        "border border-[color:var(--color-line-medium)] bg-[color:var(--color-surface-raised)]",
        "shadow-[0_12px_32px_rgba(0,0,0,0.45)]",
        "opacity-0 translate-y-1 transition-[opacity,transform] duration-[var(--duration-medium)] ease-[var(--ease-glide)]",
        "group-hover:opacity-100 group-hover:translate-y-0",
        "group-focus-within:opacity-100 group-focus-within:translate-y-0",
      )}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-accent-zk)]">
        {stage.label}
      </p>
      <dl className="mt-2 space-y-1 text-[11px] font-mono">
        <div className="flex justify-between gap-2">
          <dt className="text-[color:var(--color-ink-tertiary)]">p99 ≤</dt>
          <dd className="text-[color:var(--color-ink-primary)] tabular-nums">{fmtMs(stage.sloMs)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[color:var(--color-ink-tertiary)]">commits</dt>
          <dd className="text-[color:var(--color-accent-electric)] truncate">{stage.pubInputField}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-[color:var(--color-ink-tertiary)] not-italic">
        {stage.doc}
      </p>
    </div>
  );
}

function ActiveConnector({ idx, previousIdx }: { idx: number; previousIdx: number }): JSX.Element {
  // The active span is from the previous index to the current.
  // When the loop wraps (current=0, previous=last) we just glow
  // the very first segment instead of bridging the whole row.
  const wrapped = previousIdx > idx;
  const startIdx = wrapped ? idx : previousIdx;
  const endIdx = wrapped ? idx + 1 : idx;

  // Segment widths in percent of the row.
  const N = PROOF_STAGES.length;
  const segPct = 100 / (N - 1);
  const left  = (startIdx / (N - 1)) * 100;
  const width = (endIdx - startIdx) * segPct;

  return (
    <motion.div
      aria-hidden
      className="absolute top-1/2 -translate-y-1/2 h-[2px] rounded-full"
      style={{
        background: "linear-gradient(90deg, var(--color-accent-zk) 0%, var(--color-accent-electric) 100%)",
        boxShadow: "0 0 12px rgba(166,130,255,0.45)",
      }}
      animate={{ left: `${left}%`, width: `${width}%` }}
      transition={{ duration: 0.45, ease: [0.20, 0.80, 0.20, 1.00] }}
    />
  );
}

function fmtMs(ms: number): string {
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(ms >= 10_000 ? 0 : 1)}s`;
  return `${ms}ms`;
}

export const ProofLifecycle = memo(ProofLifecycleImpl);
ProofLifecycle.displayName = "ProofLifecycle";
