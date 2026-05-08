// PreSignExplainerModal — Phase 24 §6.1.
//
// Renders the @atlas/qvac local explanation in front of the user-
// signing flow. The model is invoked locally (browser worker hosting
// llama.cpp via @qvac/llm-llamacpp); a template fallback ships
// always-on so signing is never blocked by a local model failure.

"use client";

import { useEffect, useState } from "react";
import {
  explainPreSign,
  type ExplainerOutcome,
  type ExplainerRunner,
} from "@atlas/qvac";
import type { PreSignPayloadView } from "@atlas/qvac/explainer";

export interface PreSignExplainerModalProps {
  payload: PreSignPayloadView;
  /** Local QVAC runner (browser worker, llama.cpp, etc). */
  runner: ExplainerRunner;
  open: boolean;
  onApprove: () => void;
  onReject: () => void;
  /** Optional escape — caller controls dismiss-without-decision. */
  onClose?: () => void;
}

interface State {
  text: string | null;
  outcome: ExplainerOutcome | null;
  loading: boolean;
}

export function PreSignExplainerModal({
  payload, runner, open, onApprove, onReject, onClose,
}: PreSignExplainerModalProps): JSX.Element | null {
  const [state, setState] = useState<State>({ text: null, outcome: null, loading: false });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState({ text: null, outcome: null, loading: true });
    void explainPreSign(payload, runner).then((r) => {
      if (cancelled) return;
      setState({ text: r.text, outcome: r.outcome, loading: false });
    });
    return () => { cancelled = true; };
  }, [open, payload, runner]);

  if (!open) return null;

  const hasWarnings = payload.warnings.length > 0;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="atlas-presign-title"
         className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ background: "rgba(8,10,14,0.6)", backdropFilter: "blur(2px)" }}>
      <div className="w-full max-w-md mx-4 rounded-md"
           style={{
             background: "var(--color-surface-raised)",
             border: "1px solid var(--color-line)",
             padding: 18,
           }}>
        <header className="flex items-baseline justify-between">
          <h2 id="atlas-presign-title" className="text-[14px] font-semibold tracking-tight"
              style={{ color: "var(--color-ink-primary)" }}>
            Confirm before signing
          </h2>
          <span className="font-mono text-[11px]"
                style={{ color: state.outcome === "local_llm" ? "var(--color-execute)" : "var(--color-ink-tertiary)" }}>
            {state.outcome === "local_llm" ? "local LLM" : state.outcome === "template_fallback" ? "verified template" : "loading"}
          </span>
        </header>

        <p className="mt-3 text-[14px]" style={{ color: "var(--color-ink-secondary)" }}>
          {state.loading ? "Running local explanation…" : state.text}
        </p>

        {hasWarnings && (
          <ul className="mt-3 space-y-1">
            {payload.warnings.map((w) => (
              <li key={w} className="text-[12px]" style={{ color: "var(--color-warn)" }}>
                ⚠ {w}
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]"
            style={{ color: "var(--color-ink-secondary)" }}>
          <Row k="Projected share" v={payload.projected_share_balance} />
          <Row k="APY" v={`${payload.projected_apy_bps} bps`} />
          <Row k="Risk Δ" v={`${payload.risk_delta_bps >= 0 ? "+" : ""}${payload.risk_delta_bps} bps`} />
          <Row k="Fee" v={`${payload.fees_total_lamports.toLocaleString()} lamports`} />
        </dl>

        <div className="mt-5 flex gap-2">
          <button onClick={onReject}
                  className="flex-1 rounded px-3 py-2 text-[12px]"
                  style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-secondary)" }}>
            Reject
          </button>
          <button onClick={onApprove}
                  className="flex-1 rounded px-3 py-2 text-[12px] font-medium"
                  style={{
                    border: `1px solid ${hasWarnings ? "var(--color-danger)" : "var(--color-electric)"}`,
                    background: hasWarnings ? "color-mix(in oklab, var(--color-danger) 18%, transparent)" : "color-mix(in oklab, var(--color-electric) 18%, transparent)",
                    color: hasWarnings ? "var(--color-danger)" : "var(--color-electric)",
                  }}>
            {hasWarnings ? "Approve anyway" : "Approve"}
          </button>
        </div>

        {onClose && (
          <button onClick={onClose}
                  className="mt-3 text-[11px] underline-offset-2 hover:underline"
                  style={{ color: "var(--color-ink-tertiary)" }}>
            close without deciding
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--color-ink-tertiary)" }}>{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}
