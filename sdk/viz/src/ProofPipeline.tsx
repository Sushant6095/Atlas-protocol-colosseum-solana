// ProofPipeline — 8-stage Atlas pipeline with live progress (Phase 24 §1.2).
// Shared between landing hero, /proofs/live, and the vault terminal's
// last-rebalance card.

import { memo, useEffect, useState } from "react";
import { useVizA11y, type AriaDescribed } from "./a11y.js";
import { vizColor, vizFont } from "./tokens.js";

export const PROOF_STAGES = [
  { id: "ingest",    label: "ingest",    sloMs: 1_500 },
  { id: "infer",     label: "infer",     sloMs:   250 },
  { id: "consensus", label: "consensus", sloMs:   250 },
  { id: "allocate",  label: "allocate",  sloMs:   100 },
  { id: "explain",   label: "explain",   sloMs:    50 },
  { id: "prove",     label: "prove",     sloMs: 75_000 },
  { id: "verify",    label: "verify",    sloMs:   150 },
  { id: "settle",    label: "settle",    sloMs: 4_000 },
] as const;

export interface ProofPipelineProps extends AriaDescribed {
  /** Stage to highlight; overrides autoplay. */
  current?: typeof PROOF_STAGES[number]["id"];
  autoplay?: boolean;
  /** Per-stage observed timings; renders alongside the SLO. */
  observedMs?: Partial<Record<typeof PROOF_STAGES[number]["id"], number>>;
}

function ProofPipelineImpl({
  current,
  autoplay = true,
  observedMs,
  description = "Atlas 8-stage proof pipeline.",
  dataTable,
}: ProofPipelineProps) {
  const { describedBy, showTable, toggleTable } = useVizA11y();
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!autoplay || current) return;
    const id = setInterval(() => setActiveIdx((i) => (i + 1) % PROOF_STAGES.length), 900);
    return () => clearInterval(id);
  }, [autoplay, current]);

  const idx = current ? PROOF_STAGES.findIndex((s) => s.id === current) : activeIdx;

  return (
    <figure aria-describedby={describedBy}>
      <span id={describedBy} className="sr-only">{description}</span>
      <ol className="grid grid-cols-8 gap-2 list-none p-0 m-0">
        {PROOF_STAGES.map((s, i) => (
          <li key={s.id} className="flex flex-col items-center gap-1.5">
            <span
              className="grid place-items-center h-9 w-9 rounded-full border"
              style={{
                borderColor: i === idx ? vizColor.zk : vizColor.line,
                background: i === idx ? "rgba(166,130,255,0.15)" : vizColor.raised,
                boxShadow: i === idx ? "0 0 18px rgba(166,130,255,0.35)" : "none",
                font: `10px ${vizFont.mono}`,
                color: i === idx ? vizColor.zk : vizColor.ink3,
                transition: "all 220ms cubic-bezier(0.20,0.80,0.20,1.00)",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ font: `11px ${vizFont.body}`, color: i === idx ? vizColor.ink : vizColor.ink2 }}>
              {s.label}
            </span>
            <span style={{ font: `10px ${vizFont.mono}`, color: vizColor.ink3 }}>
              {observedMs?.[s.id] != null ? fmt(observedMs[s.id]!) : `≤ ${fmt(s.sloMs)}`}
            </span>
          </li>
        ))}
      </ol>
      <div className="relative mt-3 h-px" style={{ background: vizColor.line }}>
        <div
          className="absolute top-0 h-px"
          style={{
            width: `${((idx + 1) / PROOF_STAGES.length) * 100}%`,
            background: vizColor.zk,
            transition: "width 220ms cubic-bezier(0.40,0.00,0.20,1.00)",
          }}
        />
      </div>
      <button type="button" onClick={toggleTable} aria-expanded={showTable}
              style={{ font: `11px ${vizFont.body}`, color: vizColor.ink3 }}
              className="mt-2 underline-offset-2 hover:underline">
        {showTable ? "Hide data table" : "Show data table"}
      </button>
      {showTable ? (
        <div role="region" aria-label="Pipeline stages" className="mt-2">
          {dataTable ?? (
            <table style={{ width: "100%", font: `12px ${vizFont.mono}`, color: vizColor.ink2 }}>
              <thead><tr><th align="left">stage</th><th align="right">slo</th><th align="right">observed</th></tr></thead>
              <tbody>
                {PROOF_STAGES.map((s) => (
                  <tr key={s.id}>
                    <td>{s.label}</td>
                    <td align="right">{fmt(s.sloMs)}</td>
                    <td align="right">{observedMs?.[s.id] != null ? fmt(observedMs[s.id]!) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </figure>
  );
}

function fmt(ms: number): string {
  if (ms >= 10_000) return `${(ms / 1_000).toFixed(0)}s`;
  if (ms >= 1_000)  return `${(ms / 1_000).toFixed(1)}s`;
  return `${ms}ms`;
}

export const ProofPipeline = memo(ProofPipelineImpl);
ProofPipeline.displayName = "ProofPipeline";
