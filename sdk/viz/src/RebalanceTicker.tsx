// RebalanceTicker — auto-scrolling mono ticker (Phase 24 §1.2).
//
// Used by landing + /decision-engine. Hover-pause; click-row →
// caller-supplied handler. Fully memoised.

import { memo, useState } from "react";
import { useVizA11y, type AriaDescribed } from "./a11y.js";
import { vizColor, vizFont } from "./tokens.js";

export interface TickerEvent {
  slot: number;
  vault_id: string;
  public_input_hash: string;
  ratio_diff_summary: string;
  proof_status: "verified" | "pending" | "rejected";
}

export interface RebalanceTickerProps extends AriaDescribed {
  events: TickerEvent[];
  onSelect?: (event: TickerEvent) => void;
}

function RebalanceTickerImpl({
  events, onSelect,
  description = "Live rebalance ticker.",
  dataTable,
}: RebalanceTickerProps) {
  const { describedBy, showTable, toggleTable } = useVizA11y();
  const [paused, setPaused] = useState(false);

  return (
    <figure aria-describedby={describedBy}
            onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <span id={describedBy} className="sr-only">{description}</span>
      <div role="log" aria-live="polite" aria-relevant="additions"
           style={{
             border: `1px solid ${vizColor.line}`, borderRadius: 6,
             background: vizColor.raised,
             font: `12px ${vizFont.mono}`, color: vizColor.ink2,
             maxHeight: 320, overflow: "auto",
           }}>
        {events.length === 0 ? (
          <div style={{ padding: 16, color: vizColor.ink3 }}>no events</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {events.map((e) => (
              <li key={e.public_input_hash}
                  onClick={() => onSelect?.(e)}
                  style={{
                    display: "grid", gridTemplateColumns: "100px 96px 1fr 100px",
                    gap: 12, padding: "8px 12px",
                    borderTop: `1px solid ${vizColor.line}`,
                    cursor: onSelect ? "pointer" : "default",
                    opacity: paused ? 1 : 0.96,
                  }}>
                <span style={{ color: vizColor.ink3 }}>{e.slot.toLocaleString()}</span>
                <span title={e.vault_id}>{shorten(e.vault_id)}</span>
                <span style={{ color: vizColor.ink2 }}>{e.ratio_diff_summary}</span>
                <span style={{
                  textAlign: "right",
                  color: e.proof_status === "verified" ? vizColor.execute
                       : e.proof_status === "pending"  ? vizColor.warn
                       :                                   vizColor.danger,
                }}>
                  {e.proof_status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" onClick={toggleTable} aria-expanded={showTable}
              style={{ font: `11px ${vizFont.body}`, color: vizColor.ink3 }}
              className="mt-2 underline-offset-2 hover:underline">
        {showTable ? "Hide data table" : "Show data table"}
      </button>
      {showTable ? (
        <div role="region" aria-label="Ticker data table" className="mt-2">
          {dataTable ?? (
            <table style={{ width: "100%", font: `12px ${vizFont.mono}`, color: vizColor.ink2 }}>
              <thead><tr><th align="left">slot</th><th align="left">vault</th><th align="left">diff</th><th align="left">status</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.public_input_hash}>
                    <td>{e.slot}</td><td>{shorten(e.vault_id)}</td><td>{e.ratio_diff_summary}</td><td>{e.proof_status}</td>
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

function shorten(s: string): string {
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

export const RebalanceTicker = memo(RebalanceTickerImpl);
RebalanceTicker.displayName = "RebalanceTicker";
