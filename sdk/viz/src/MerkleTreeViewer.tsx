// MerkleTreeViewer — Bubblegum proof inspector (Phase 24 §1.2).
//
// Renders the Merkle path from leaf to root with each level
// click-expandable to inspect siblings. Used by the black-box
// record verifier and proof-of-reserve surfaces.

import { memo, useState } from "react";
import { useVizA11y, type AriaDescribed } from "./a11y.js";
import { vizColor, vizFont } from "./tokens.js";

export interface MerkleStep {
  level: number;             // 0 = leaf
  hash: string;              // hex
  /** Sibling at this level (the value the proof contributes). */
  sibling: string;
  /** Direction: which side the leaf occupies at this level. */
  side: "left" | "right";
}

export interface MerkleTreeViewerProps extends AriaDescribed {
  leaf: string;
  steps: MerkleStep[];
  root: string;
}

function MerkleTreeViewerImpl({
  leaf, steps, root,
  description = "Merkle proof path from leaf to root.",
  dataTable,
}: MerkleTreeViewerProps) {
  const { describedBy, showTable, toggleTable } = useVizA11y();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <figure aria-describedby={describedBy}>
      <span id={describedBy} className="sr-only">{description}</span>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, font: `12px ${vizFont.mono}`, color: vizColor.ink2 }}>
        <li className="flex items-center gap-2 py-1">
          <span style={{ color: vizColor.ink3, width: 56 }}>leaf</span>
          <Hash value={leaf} />
        </li>
        {steps.map((s, i) => {
          const isOpen = open === i;
          return (
            <li key={i}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "4px 0", width: "100%" }}
              >
                <span style={{ color: vizColor.ink3, width: 56 }}>level {s.level}</span>
                <Hash value={s.hash} />
                <span style={{ color: vizColor.ink3, fontSize: 10 }}>· side {s.side}</span>
                <span style={{ marginLeft: "auto", color: vizColor.ink3, fontSize: 10 }}>{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen ? (
                <div style={{ paddingLeft: 64, paddingBottom: 6, color: vizColor.ink3, fontSize: 11 }}>
                  sibling · <Hash value={s.sibling} />
                </div>
              ) : null}
            </li>
          );
        })}
        <li className="flex items-center gap-2 py-1" style={{ borderTop: `1px solid ${vizColor.line}`, marginTop: 6, paddingTop: 6 }}>
          <span style={{ color: vizColor.execute, width: 56 }}>root</span>
          <Hash value={root} highlight />
        </li>
      </ol>
      <button type="button" onClick={toggleTable} aria-expanded={showTable}
              style={{ font: `11px ${vizFont.body}`, color: vizColor.ink3 }}
              className="mt-2 underline-offset-2 hover:underline">
        {showTable ? "Hide data table" : "Show data table"}
      </button>
      {showTable ? (
        <div role="region" aria-label="Merkle path table" className="mt-2">
          {dataTable ?? (
            <table style={{ width: "100%", font: `12px ${vizFont.mono}`, color: vizColor.ink2 }}>
              <thead><tr><th align="left">level</th><th align="left">hash</th><th align="left">sibling</th><th align="left">side</th></tr></thead>
              <tbody>
                <tr><td>leaf</td><td>{leaf}</td><td>—</td><td>—</td></tr>
                {steps.map((s, i) => (
                  <tr key={i}><td>{s.level}</td><td>{s.hash}</td><td>{s.sibling}</td><td>{s.side}</td></tr>
                ))}
                <tr><td>root</td><td>{root}</td><td>—</td><td>—</td></tr>
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </figure>
  );
}

function Hash({ value, highlight }: { value: string; highlight?: boolean }) {
  const short = value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
  return (
    <span style={{ color: highlight ? vizColor.execute : vizColor.ink, font: `12px ${vizFont.mono}` }} title={value}>
      {short}
    </span>
  );
}

export const MerkleTreeViewer = memo(MerkleTreeViewerImpl);
MerkleTreeViewer.displayName = "MerkleTreeViewer";
