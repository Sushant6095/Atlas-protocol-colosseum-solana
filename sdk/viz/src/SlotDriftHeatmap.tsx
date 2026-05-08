// SlotDriftHeatmap — RPC × hour grid (Phase 24 §1.2).
// Used by /infra. Color-mapped to attribution count.
// Performance budget: ≤ 4ms frame at 24 × N grid.

import { memo, useState } from "react";
import { useVizA11y, type AriaDescribed } from "./a11y.js";
import { vizColor, vizFont } from "./tokens.js";

export interface DriftCell {
  source: string;
  hour: number;          // 0..=23
  outlier_count: number; // 0..=N
}

export interface SlotDriftHeatmapProps extends AriaDescribed {
  cells: DriftCell[];
  /** Optional click handler — typically opens the attribution log. */
  onSelect?: (cell: DriftCell) => void;
}

function SlotDriftHeatmapImpl({
  cells,
  onSelect,
  description = "Slot-drift attribution heatmap. Rows are RPC sources, columns are hours of the last 24h.",
  dataTable,
}: SlotDriftHeatmapProps) {
  const { describedBy, showTable, toggleTable } = useVizA11y();
  const [hovered, setHovered] = useState<DriftCell | null>(null);

  const sources = Array.from(new Set(cells.map((c) => c.source)));
  const max = Math.max(1, ...cells.map((c) => c.outlier_count));

  return (
    <figure aria-describedby={describedBy}>
      <span id={describedBy} className="sr-only">{description}</span>
      <div className="overflow-auto">
        <table style={{ font: `11px ${vizFont.mono}`, color: vizColor.ink2, borderCollapse: "separate", borderSpacing: 1 }}>
          <thead>
            <tr>
              <th />
              {Array.from({ length: 24 }).map((_, h) => (
                <th key={h} style={{ width: 14, color: vizColor.ink3, fontWeight: 400, fontSize: 9 }}>
                  {h.toString().padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s}>
                <td style={{ color: vizColor.ink2, paddingRight: 8 }}>{s}</td>
                {Array.from({ length: 24 }).map((_, h) => {
                  const cell = cells.find((c) => c.source === s && c.hour === h);
                  const v = cell?.outlier_count ?? 0;
                  const intensity = v / max;
                  return (
                    <td
                      key={h}
                      onMouseEnter={() => cell && setHovered(cell)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => cell && onSelect?.(cell)}
                      style={{
                        width: 14, height: 14, cursor: cell ? "pointer" : "default",
                        background: v === 0
                          ? "rgba(255,255,255,0.04)"
                          : `rgba(255,97,102,${0.10 + intensity * 0.65})`,
                        borderRadius: 2,
                      }}
                      aria-label={`source ${s} hour ${h}: ${v} outliers`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ font: `11px ${vizFont.mono}`, color: vizColor.ink3, marginTop: 6 }}>
        {hovered ? `${hovered.source} · h${hovered.hour.toString().padStart(2, "0")} · ${hovered.outlier_count} outliers` : "hover any cell"}
      </p>
      <button type="button" onClick={toggleTable} aria-expanded={showTable}
              style={{ font: `11px ${vizFont.body}`, color: vizColor.ink3 }}
              className="mt-2 underline-offset-2 hover:underline">
        {showTable ? "Hide data table" : "Show data table"}
      </button>
      {showTable ? (
        <div role="region" aria-label="Heatmap data table" className="mt-2">
          {dataTable ?? (
            <table style={{ width: "100%", font: `12px ${vizFont.mono}`, color: vizColor.ink2 }}>
              <thead><tr><th align="left">source</th><th align="right">hour</th><th align="right">outliers</th></tr></thead>
              <tbody>
                {cells.map((c, i) => (
                  <tr key={i}><td>{c.source}</td><td align="right">{c.hour}</td><td align="right">{c.outlier_count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </figure>
  );
}

export const SlotDriftHeatmap = memo(SlotDriftHeatmapImpl);
SlotDriftHeatmap.displayName = "SlotDriftHeatmap";
