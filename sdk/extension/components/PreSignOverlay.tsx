// Pre-sign overlay (Phase 24 §4.5).
//
// The user-facing card that explains a transaction before they sign
// it. Renders the `ExplanationView` we receive from the content
// script + Atlas /api/v1/explain. Approve / Reject are routed back
// to the host page through the background worker.

import type { ExplanationView } from "../lib/messaging";

export interface PreSignOverlayProps {
  origin: string;
  explanation: ExplanationView;
  onApprove: () => void;
  onReject: () => void;
}

export function PreSignOverlay({
  origin, explanation, onApprove, onReject,
}: PreSignOverlayProps): JSX.Element {
  return (
    <section role="dialog" aria-modal="true" aria-label="Pre-sign explanation"
             style={{
               border: "1px solid #1d2230", borderRadius: 6,
               padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12,
             }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 10, color: "#8893a8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          pre-sign · {origin}
        </span>
        <span style={{ font: "11px ui-monospace, Menlo, monospace", color: "#6aa6ff" }}>
          {explanation.explanationHash}
        </span>
      </header>

      <p style={{ margin: 0, fontSize: 14 }}>{explanation.headline}</p>

      <Section label="programs">
        {explanation.programs.length === 0 ? <Empty /> : (
          <ul style={listStyle}>
            {explanation.programs.map((p) => <li key={p} style={liStyle}>{p}</li>)}
          </ul>
        )}
      </Section>

      <Section label="balance deltas">
        {explanation.balanceDeltas.length === 0 ? <Empty /> : (
          <ul style={listStyle}>
            {explanation.balanceDeltas.map((d) => (
              <li key={d.mint} style={{ ...liStyle, display: "flex", justifyContent: "space-between" }}>
                <span>{d.mint}</span>
                <span style={{ font: "12px ui-monospace, Menlo, monospace", color: d.delta.startsWith("-") ? "#ff8b8b" : "#5be1a0" }}>
                  {d.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {explanation.risks.length > 0 && (
        <Section label="risks">
          <ul style={listStyle}>
            {explanation.risks.map((r) => (
              <li key={r} style={{ ...liStyle, color: "#ff8b8b" }}>{r}</li>
            ))}
          </ul>
        </Section>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={onReject} style={btn("ghost")}>Reject</button>
        <button onClick={onApprove} style={btn(explanation.risks.length > 0 ? "danger" : "primary")}>
          {explanation.risks.length > 0 ? "Approve anyway" : "Approve"}
        </button>
      </div>
    </section>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#8893a8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Empty(): JSX.Element { return <div style={{ color: "#8893a8" }}>—</div>; }

const listStyle: React.CSSProperties = { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 };
const liStyle: React.CSSProperties = { fontSize: 13 };

function btn(kind: "primary" | "ghost" | "danger"): React.CSSProperties {
  const palette = {
    primary: { border: "#6aa6ff", bg: "#143052", fg: "#e7eaf0" },
    ghost:   { border: "#1d2230", bg: "transparent", fg: "#c8d0dd" },
    danger:  { border: "#ff8b8b", bg: "#3a1c1c", fg: "#ffd5d5" },
  }[kind];
  return {
    flex: 1, border: `1px solid ${palette.border}`, background: palette.bg, color: palette.fg,
    borderRadius: 4, padding: "8px 10px", font: "12px -apple-system, system-ui, sans-serif", cursor: "pointer",
  };
}
