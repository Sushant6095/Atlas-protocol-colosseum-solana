// SecondOpinionAnalyst — Phase 24 §6.4.
//
// Local second-pass review for an in-flight rebalance. Surfaces the
// AnalystSummary (recommendation + concerns + diff vs. last 30 days)
// alongside the operator-facing approve / reject buttons. Atlas does
// not auto-approve from this card; even an "approve" recommendation
// with zero concerns still requires explicit operator click.

"use client";

import { useEffect, useState } from "react";
import {
  summariseAssessment,
  type AnalystAssessment, type AnalystSummary, type AnalystRecommendation,
} from "@atlas/qvac";

export type AnalystRunner = () => Promise<AnalystAssessment>;

export interface SecondOpinionAnalystProps {
  /** Re-runs whenever this changes — e.g. the proposal hash. */
  proposalKey: string;
  runner: AnalystRunner;
  className?: string;
}

interface State {
  loading: boolean;
  summary: AnalystSummary | null;
  error: string | null;
}

export function SecondOpinionAnalyst({
  proposalKey, runner, className,
}: SecondOpinionAnalystProps): JSX.Element {
  const [state, setState] = useState<State>({ loading: true, summary: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, summary: null, error: null });
    void runner()
      .then((a) => { if (!cancelled) setState({ loading: false, summary: summariseAssessment(a), error: null }); })
      .catch((e: Error) => { if (!cancelled) setState({ loading: false, summary: null, error: e.message }); });
    return () => { cancelled = true; };
  }, [proposalKey, runner]);

  return (
    <section aria-label="Second-opinion analyst"
             className={className}
             style={{
               border: "1px solid var(--color-line)",
               borderRadius: 6,
               padding: 14,
               background: "var(--color-surface-raised)",
             }}>
      <header className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.06em]"
              style={{ color: "var(--color-ink-tertiary)" }}>
          local analyst · second opinion
        </span>
        {state.summary && (
          <RecommendationPill rec={state.summary.assessment.recommendation}
                              confidenceBps={state.summary.assessment.confidence_bps} />
        )}
      </header>

      {state.loading && <p className="mt-2 text-[12px]"
                           style={{ color: "var(--color-ink-tertiary)" }}>
        Running locally…
      </p>}

      {state.error && <p className="mt-2 text-[12px]"
                         style={{ color: "var(--color-danger)" }}>
        {state.error}
      </p>}

      {state.summary && (
        <>
          {state.summary.assessment.concerns.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {state.summary.assessment.concerns.map((c) => {
                const recognised = !state.summary!.unrecognised_concerns.some((u) => u.raw_text === c);
                return (
                  <li key={c}
                      className="text-[12px]"
                      style={{ color: recognised ? "var(--color-warn)" : "var(--color-danger)" }}>
                    {recognised ? "⚠" : "✗"} {c}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-[12px]"
               style={{ color: "var(--color-execute)" }}>
              No concerns flagged.
            </p>
          )}

          {state.summary.assessment.fields_to_double_check.length > 0 && (
            <div className="mt-3">
              <span className="text-[10px] uppercase tracking-[0.06em]"
                    style={{ color: "var(--color-ink-tertiary)" }}>
                double-check
              </span>
              <ul className="mt-1 grid grid-cols-2 gap-1 text-[12px] font-mono"
                  style={{ color: "var(--color-ink-secondary)" }}>
                {state.summary.assessment.fields_to_double_check.map((f) =>
                  <li key={f}>{f}</li>)}
              </ul>
            </div>
          )}

          <p className="mt-3 text-[12px]"
             style={{ color: "var(--color-ink-secondary)" }}>
            <span className="text-[10px] uppercase tracking-[0.06em] mr-1"
                  style={{ color: "var(--color-ink-tertiary)" }}>
              vs. last 30d
            </span>
            {state.summary.assessment.comparison_to_last_30d}
          </p>

          {!state.summary.clears_for_signing && (
            <p className="mt-3 text-[11px]"
               style={{ color: "var(--color-warn)" }}>
              Operator decision still required — Atlas never auto-signs.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function RecommendationPill({
  rec, confidenceBps,
}: { rec: AnalystRecommendation; confidenceBps: number }): JSX.Element {
  const colour = rec === "approve" ? "var(--color-execute)"
              : rec === "reject"  ? "var(--color-danger)"
              :                     "var(--color-warn)";
  return (
    <span className="text-[10px] uppercase tracking-[0.08em] font-mono"
          style={{
            color: colour,
            border: `1px solid ${colour}`,
            padding: "2px 6px",
            borderRadius: 3,
          }}>
      {rec} · {(confidenceBps / 100).toFixed(0)}%
    </span>
  );
}
